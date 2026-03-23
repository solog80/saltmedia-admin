const functions = require('firebase-functions');
const admin = require('firebase-admin');
const firestore = admin.firestore();

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


// This function runs every minute to manage chat room status
exports.scheduledChatRoomManager = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    console.log('--- Scheduled Chat Room Manager Execution Start ---');

    const liveRadioDocRef = firestore.collection('fm_program_lineup').doc('Live_Radio');
    const liveRadioSnapshot = await liveRadioDocRef.get();

    if (!liveRadioSnapshot.exists) {
        console.log('Live_Radio document does not exist. Exiting.');
        return null;
    }

    const programLineup = liveRadioSnapshot.data().programLineup || [];
    if (programLineup.length === 0) {
        console.log('No program lineup found or lineup is empty. Exiting.');
        return null;
    }

    const nowUtc = new Date();
    const currentDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(nowUtc);
    const todayStr = nowUtc.toISOString().slice(0, 10); // YYYY-MM-DD format

    console.log(`Current UTC Time: ${nowUtc.toISOString()}, Day: ${currentDay}, Date: ${todayStr}`);

    let activeProgram = null;
    let activeProgramId = null;

    for (const program of programLineup) {
        if (program.shouldShow === false) continue;

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
           effectiveStartTime.setDate(effectiveStartTime.getDate() -1);
           endTimeUtc.setDate(endTimeUtc.getDate() -1);
        }


        if (programDays.includes(currentDay) && nowUtc >= effectiveStartTime && nowUtc < endTimeUtc) {
            activeProgram = program;
            activeProgramId = (program.programName || 'unknown_program').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            console.log(`MATCH! Active program found: ${activeProgram.programName}, ID: ${activeProgramId}`);
            break;
        }
    }

    const batch = firestore.batch();

    // --- Activate current program's chat and clean if it's the first run of the day ---
    if (activeProgram && activeProgramId) {
        const chatRoomRef = firestore.collection('chatRooms').doc(activeProgramId);
        const chatRoomSnap = await chatRoomRef.get();
        const chatRoomData = chatRoomSnap.data();

        if (chatRoomData?.lastCleanedAt !== todayStr) {
            // Check if deleteChat is explicitly false
            if (activeProgram.deleteChat === false) {
                console.log(`New day for ${activeProgramId}. Chat not cleared due to deleteChat: false.`);
            } else {
                console.log(`New day for ${activeProgramId}. Cleaning old messages...`);
                const messagesPath = `chatRooms/${activeProgramId}/messages`;
                await deleteCollection(firestore, messagesPath, 100);
                console.log(`Finished cleaning messages for ${activeProgramId}.`);
            }
            
            batch.set(chatRoomRef, {
                programName: activeProgram.programName,
                isActive: true,
                lastCleanedAt: todayStr, // Set the last cleaned date
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

        } else {
            // Already cleaned today, just ensure it's active
            console.log(`${activeProgramId} already cleaned today. Ensuring it remains active.`);
            if (!chatRoomData.isActive) {
                batch.update(chatRoomRef, { isActive: true });
            }
        }
    } else {
        console.log('No active program found.');
    }

    // --- Deactivate all other chat rooms ---
    const allChatRoomsSnapshot = await firestore.collection('chatRooms').get();
    for (const doc of allChatRoomsSnapshot.docs) {
        if (doc.id !== activeProgramId && doc.data().isActive) {
            console.log(`Deactivating chat room: ${doc.id}`);
            batch.update(doc.ref, { isActive: false });
        }
    }

    console.log('Committing batch updates...');
    await batch.commit();
    console.log('Chat room management complete. --- Scheduled Chat Room Manager Execution End ---');
    return null;
});
