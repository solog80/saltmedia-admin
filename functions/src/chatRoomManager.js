const functions = require('firebase-functions');
const admin = require('firebase-admin');

const firestore = admin.firestore();

// Helper function to delete all documents in a subcollection
async function deleteCollection(db, collectionPath, batchSize) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve, reject);
    });
}

async function deleteQueryBatch(db, query, resolve, reject) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid hitting stack limits
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve, reject);
    });
}


exports.manageProgramChatRooms = functions.firestore
    .document('fm_program_lineup/Live_Radio')
    .onUpdate(async (change, context) => {
        const newProgramLineupData = change.after.data();
        const programLineup = newProgramLineupData.programLineup;

        console.log('--- Cloud Function Execution Start ---');
        console.log('Received update for Live_Radio document.');

        if (!programLineup || programLineup.length === 0) {
            console.log('No program lineup found or lineup is empty. Exiting.');
            return null;
        }

        const nowUtc = admin.firestore.Timestamp.now().toDate();
        const currentDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(nowUtc);
        console.log(`Current UTC Time: ${nowUtc.toISOString()}, Current Day: ${currentDay}`);

        let activeProgram = null;
        let activeProgramId = null;

        console.log('Iterating through program lineup to find active program...');
        for (const program of programLineup) {
            console.log(`  Processing program: ${program.programName}`);
            if (program.shouldShow === false) {
                console.log(`    Program ${program.programName} is marked as shouldShow: false. Skipping.`);
                continue; // Skip programs that should not be shown
            }

            const programDays = program.days.split(',').map(d => d.trim());
            const startTimeParts = program.startTime.split(':').map(Number);
            let [startHour, startMinute] = startTimeParts;

            const endTimeParts = program.endTime.split(':').map(Number);
            let [endHour, endMinute] = endTimeParts;

            let startTimeUtc = new Date(Date.UTC(nowUtc.getFullYear(), nowUtc.getMonth(), nowUtc.getDate(), startHour, startMinute));
            let endTimeUtc = new Date(Date.UTC(nowUtc.getFullYear(), nowUtc.getMonth(), nowUtc.getDate(), endHour, endMinute));

            // Handle programs that cross midnight
            if (endTimeUtc < startTimeUtc) {
                endTimeUtc.setDate(endTimeUtc.getDate() + 1);
            }

            console.log(`    Program Days: ${programDays.join(', ')}, Start Time UTC: ${startTimeUtc.toISOString()}, End Time UTC: ${endTimeUtc.toISOString()}`);
            console.log(`    Condition: programDays.includes(${currentDay}) && nowUtc >= ${startTimeUtc.toISOString()} && nowUtc < ${endTimeUtc.toISOString()}`);

            if (programDays.includes(currentDay) && nowUtc >= startTimeUtc && nowUtc < endTimeUtc) {
                activeProgram = program;
                activeProgramId = (program.programName || 'unknown_program').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                console.log(`    MATCH! Active program found: ${activeProgram.programName}, ID: ${activeProgramId}`);
                break; // Found the active program, exit loop
            } else {
                console.log(`    NO MATCH for ${program.programName}.`);
            }
        }

        const batch = firestore.batch();

        // --- Step 1: Activate/Create the current program's chat room ---
        if (activeProgram && activeProgramId) {
            const chatRoomRef = firestore.collection('chatRooms').doc(activeProgramId);
            console.log(`Activating/Creating chat room for: ${activeProgram.programName} with ID: ${activeProgramId}`);
            batch.set(chatRoomRef, {
                programName: activeProgram.programName,
                programStartTime: admin.firestore.Timestamp.fromDate(new Date(Date.UTC(nowUtc.getFullYear(), nowUtc.getMonth(), nowUtc.getDate(), activeProgram.startTime.split(':')[0], activeProgram.startTime.split(':')[1]))),
                programEndTime: admin.firestore.Timestamp.fromDate(new Date(Date.UTC(nowUtc.getFullYear(), nowUtc.getMonth(), nowUtc.getDate(), activeProgram.endTime.split(':')[0], activeProgram.endTime.split(':')[1]))),
                isActive: true,
                lastMessageAt: admin.firestore.FieldValue.serverTimestamp(), // Update last message time on program change
                createdAt: admin.firestore.FieldValue.serverTimestamp(), // Set on creation, will not overwrite existing
            }, { merge: true });
        } else {
            console.log('No active program found. All chat rooms will be deactivated.');
        }

        // --- Step 2: Deactivate all other chat rooms and delete their participants---
        console.log('Fetching all existing chat room documents for deactivation...');
        const chatRoomsSnapshot = await firestore.collection('chatRooms').get();

        console.log('Processing existing chat rooms for deactivation...');
        for (const doc of chatRoomsSnapshot.docs) {
            const currentChatRoomId = doc.id;
            const currentChatRoomData = doc.data();

            if (currentChatRoomId !== activeProgramId && currentChatRoomData.isActive !== false) {
                console.log(`  Deactivating chat room: ${currentChatRoomId} (was active or undefined isActive)`);
                batch.update(doc.ref, { isActive: false });

                // Delete the participants subcollection
                console.log(`  Deleting participants for chat room: ${currentChatRoomId}`);
                await deleteCollection(firestore, `chatRooms/${currentChatRoomId}/participants`, 50);

            } else if (currentChatRoomId === activeProgramId) {
                console.log(`  Skipping active chat room: ${currentChatRoomId}`);
            } else {
                console.log(`  Skipping already inactive chat room: ${currentChatRoomId}`);
            }
        }

        console.log('Committing batch updates to Firestore...');
        await batch.commit();
        console.log('Chat room management complete. --- Cloud Function Execution End ---');
        return null;
    });