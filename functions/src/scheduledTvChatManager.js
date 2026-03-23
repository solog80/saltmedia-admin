const functions = require('firebase-functions');
const admin = require('firebase-admin');
const firestore = admin.firestore();
const { v4: uuidv4 } = require('uuid');

/**
 * Deletes all documents in a collection in batches.
 * @param {admin.firestore.Firestore} db The Firestore database instance.
 * @param {string} collectionPath The path to the collection to delete.
 * @param {number} batchSize The number of documents to delete in each batch.
 */
async function deleteCollection(db, collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve, reject);
    });
}

async function deleteQueryBatch(db, query, resolve, reject) {
    try {
        const snapshot = await query.get();

        if (snapshot.size === 0) {
            return resolve();
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Recurse on the next process tick, to avoid hitting stack limits.
        process.nextTick(() => {
            deleteQueryBatch(db, query, resolve, reject);
        });
    } catch (error) {
        console.error('Error deleting collection batch:', error);
        reject(error);
    }
}

// This function runs every minute to manage TV chat room status
exports.scheduledTvChatRoomManager = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    console.log('--- Scheduled TV Chat Room Manager Execution Start ---');

    const liveTvDocRef = firestore.collection('fm_program_lineup').doc('Live_TV');
    const liveTvSnapshot = await liveTvDocRef.get();

    if (!liveTvSnapshot.exists) {
        console.log('Live_TV document does not exist. Exiting.');
        return null;
    }

    const stationsData = liveTvSnapshot.data();
    if (!stationsData || Object.keys(stationsData).length === 0) {
        console.log('No stations data found or data is empty. Exiting.');
        return null;
    }

    const nowUtc = new Date();
    const currentDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(nowUtc);
    const todayStr = nowUtc.toISOString().slice(0, 10); // YYYY-MM-DD format

    console.log(`Current UTC Time: ${nowUtc.toISOString()}, Day: ${currentDay}, Date: ${todayStr}`);

    const activeProgramIds = new Set();
    const batch = firestore.batch();

    for (const stationName in stationsData) {
        const stationData = stationsData[stationName];
        const programLineup = stationData.ProgramLineup || [];

        let activeProgramForStation = null;

        for (const program of programLineup) {
            // Ensure program has necessary fields
            if (!program.programName || !program.startTime || !program.endTime || !program.days) {
                console.warn(`Skipping malformed program in ${stationName}:`, program);
                continue;
            }

            const programDays = program.days.split(',').map(d => d.trim());
            const [startHour, startMinute] = program.startTime.split(':').map(Number);
            const [endHour, endMinute] = program.endTime.split(':').map(Number);

            const startTimeUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), startHour, startMinute));
            let endTimeUtc = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), endHour, endMinute));

            if (endTimeUtc <= startTimeUtc) {
                endTimeUtc.setDate(endTimeUtc.getDate() + 1);
            }

            // Adjust start time for programs that started yesterday but are still running
            let effectiveStartTime = startTimeUtc;
            if (nowUtc < startTimeUtc) {
                effectiveStartTime.setDate(effectiveStartTime.getDate() - 1);
                endTimeUtc.setDate(endTimeUtc.getDate() - 1);
            }

            if (programDays.includes(currentDay) && nowUtc >= effectiveStartTime && nowUtc < endTimeUtc) {
                activeProgramForStation = program;
                break; // Found the active program for this station
            }
        }

        if (activeProgramForStation) {
            // Generate a unique tvProgramId for the active program
            // Combine stationName, programName, and start time for a robust ID
            const tvProgramId = `${stationName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${activeProgramForStation.programName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${activeProgramForStation.startTime.replace(':', '')}`;
            activeProgramIds.add(tvProgramId);

            const chatRoomRef = firestore.collection('tvChatRooms').doc(tvProgramId);
            const chatRoomSnap = await chatRoomRef.get();
            const chatRoomData = chatRoomSnap.data();

            

            // Update EPG data with tvProgramId
            const programLineupWithId = stationData.ProgramLineup.map(p => {
                if (p.programName === activeProgramForStation.programName && p.startTime === activeProgramForStation.startTime) {
                    return { ...p, tvProgramId: tvProgramId };
                }
                return p;
            });
            batch.update(liveTvDocRef, { [stationName]: { ...stationData, ProgramLineup: programLineupWithId } });

            if (chatRoomData?.lastCleanedAt !== todayStr) {
                // Check if deleteChat is explicitly false for TV programs
                if (activeProgramForStation.deleteChat === false) {
                    console.log(`New day for ${tvProgramId}. TV Chat not cleared due to deleteChat: false.`);
                } else {
                    console.log(`New day for ${tvProgramId}. Cleaning old messages...`);
                    const messagesPath = `tvChatRooms/${tvProgramId}/messages`;
                    await deleteCollection(firestore, messagesPath, 100);
                    console.log(`Finished cleaning messages for ${tvProgramId}.`);
                }

                batch.set(chatRoomRef, {
                    stationName: stationName,
                    programName: activeProgramForStation.programName,
                    isActive: true,
                    lastCleanedAt: todayStr,
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });

            } else {
                console.log(`${tvProgramId} already cleaned today. Ensuring it remains active.`);
                if (!chatRoomData.isActive) {
                    batch.update(chatRoomRef, { isActive: true });
                }
            }
        } else {
            console.log(`No active program found for station: ${stationName}`);
        }
    }

    // Deactivate all other chat rooms that are not currently active
    const allChatRoomsSnapshot = await firestore.collection('tvChatRooms').get();
    for (const doc of allChatRoomsSnapshot.docs) {
        if (!activeProgramIds.has(doc.id) && doc.data().isActive) {
            console.log(`Deactivating TV chat room: ${doc.id}`);
            batch.update(doc.ref, { isActive: false });
        }
    }

    console.log('Committing batch updates...');
    await batch.commit();
    console.log('TV Chat room management complete. --- Scheduled TV Chat Room Manager Execution End ---');
    return null;
});
