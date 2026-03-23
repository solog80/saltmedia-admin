const functions = require('firebase-functions');
const admin = require('firebase-admin');

const firestore = admin.firestore();

exports.updateChatParticipants = functions.firestore
    .document('chatRooms/{chatRoomId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const chatRoomId = context.params.chatRoomId;
        const userId = messageData.userId;

        if (!userId) {
            console.log('Message has no userId. Exiting.');
            return null;
        }

        const participantRef = firestore
            .collection('chatRooms')
            .doc(chatRoomId)
            .collection('participants')
            .doc(userId);

        const participantSnapshot = await participantRef.get();

        if (participantSnapshot.exists) {
            // User is already a participant, no need to do anything.
            console.log(`User ${userId} is already a participant in chatRoom ${chatRoomId}.`);
            return null;
        }

        // Get user profile information
        const userProfileDoc = await firestore.collection('users').doc(userId).get();
        const userProfileData = userProfileDoc.data() || {};

        console.log(`Adding user ${userId} to participants in chatRoom ${chatRoomId}.`);

        await participantRef.set({
            userId: userId,
            userName: userProfileData.name || 'Anonymous',
            profileImageUrl: userProfileData.profileImageUrl || null,
            firstJoinedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });
