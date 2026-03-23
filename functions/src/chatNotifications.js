const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Sends notifications for chat messages, handling @mentions and admin alerts.
 */
exports.sendChatNotifications = functions.firestore
    .document('chatRooms/{programId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        const messageData = snapshot.data();
        const programId = context.params.programId;
        const messageId = context.params.messageId;

        const senderId = messageData.userId;
        const senderName = messageData.userName || 'Anonymous';
        const messageContent = messageData.messageContent;

        // Skip notifications for messages sent by admins (if you don't want admins to notify other admins for their own messages)
        // Or if you want to skip notifications for messages that are just system messages or lottie emojis
        if (messageData.isAdminMessage || messageData.isLottieEmoji || messageData.isExpression) {
            console.log('Skipping notification for admin message, lottie emoji, or expression.');
            return null;
        }

        const mentionedUserIds = new Set();
        const adminUserIds = new Set();
        const allRecipientTokens = [];

        // 1. Handle @mentions
        const mentionRegex = /@(\w+)/g; // Matches @username
        let match;
        while ((match = mentionRegex.exec(messageContent)) !== null) {
            const mentionedUsername = match[1];
            try {
                // Query users collection to find the userId for the mentioned username
                const userQuerySnapshot = await db.collection('users').where('userName', '==', mentionedUsername).limit(1).get();
                if (!userQuerySnapshot.empty) {
                    const mentionedUserDoc = userQuerySnapshot.docs[0];
                    const mentionedUserId = mentionedUserDoc.id;
                    if (mentionedUserId !== senderId) { // Don't notify sender for self-mention
                        mentionedUserIds.add(mentionedUserId);
                    }
                } else {
                    console.log(`Mentioned username "${mentionedUsername}" not found.`);
                }
            } catch (error) {
                console.error(`Error looking up mentioned user ${mentionedUsername}:`, error);
            }
        }

        // 2. Handle Admin Notifications (for all user messages)
        try {
            const adminUsersSnapshot = await db.collection('users').where('isAdmin', '==', true).get();
            adminUsersSnapshot.forEach(doc => {
                const adminId = doc.id;
                if (adminId !== senderId) { // Don't notify admin for their own messages
                    adminUserIds.add(adminId);
                }
            });
        } catch (error) {
            console.error('Error fetching admin users:', error);
        }

        // Combine all unique recipient user IDs
        const allTargetUserIds = new Set([...mentionedUserIds, ...adminUserIds]);

        if (allTargetUserIds.size === 0) {
            console.log('No target users for notifications.');
            return null;
        }

        // 3. Fetch FCM tokens for all target users
        const userPromises = Array.from(allTargetUserIds).map(async (userId) => {
            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    // Assuming FCM tokens are stored in an array field named 'fcmTokens'
                    return userData.fcmTokens || [];
                }
                return [];
            } catch (error) {
                console.error(`Error fetching FCM tokens for user ${userId}:`, error);
                return [];
            }
        });

        const tokensArrays = await Promise.all(userPromises);
        tokensArrays.forEach(tokens => {
            allRecipientTokens.push(...tokens);
        });

        // Filter out duplicate tokens and empty tokens
        const uniqueRecipientTokens = [...new Set(allRecipientTokens.filter(token => token && token.length > 0))];

        if (uniqueRecipientTokens.length === 0) {
            console.log('No valid FCM tokens found for recipients.');
            return null;
        }

        // 4. Construct and Send Notifications
        const messagesToSend = [];

        // Get program name (optional, but good for notification title)
        let programName = programName; // Default
        try {
            const programDoc = await db.collection('chatRooms').doc(programId).get();
            if (programDoc.exists && programDoc.data() && programDoc.data().name) {
                programName = programDoc.data().name;
            } else {
                // Try tvChatRooms if not found in chatRooms
                const tvProgramDoc = await db.collection('tvChatRooms').doc(programId).get();
                if (tvProgramDoc.exists && tvProgramDoc.data() && tvProgramDoc.data().name) {
                    programName = tvProgramDoc.data().name;
                }
            }
        } catch (error) {
            console.error(`Error fetching program name for ${programId}:`, error);
        }


        // Create notification for mentioned users
        if (mentionedUserIds.size > 0) {
            const mentionNotification = {
                notification: {
                    title: `New mention in ${programName}`,
                    body: `${senderName} mentioned you: "${messageContent}"`,
                },
                data: {
                    type: 'mention',
                    programId: programId,
                    messageId: messageId,
                    senderId: senderId,
                    senderName: senderName,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK', // Required for Flutter foreground notifications
                },
            };
            messagesToSend.push(mentionNotification);
        }

        // Create notification for admin users (if not already covered by mention)
        if (adminUserIds.size > 0) {
            const adminNotification = {
                notification: {
                    title: `New User Message in ${programName}`,
                    body: `${senderName}: "${messageContent}"`,
                },
                data: {
                    type: 'admin_alert',
                    programId: programId,
                    messageId: messageId,
                    senderId: senderId,
                    senderName: senderName,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK',
                },
            };
            // Only add admin notification if there are admins who are not also mentioned users
            // This avoids sending two notifications to an admin who was also mentioned.
            const adminsNotMentioned = Array.from(adminUserIds).filter(adminId => !mentionedUserIds.has(adminId));
            if (adminsNotMentioned.length > 0) {
                 messagesToSend.push(adminNotification);
            }
        }

        if (messagesToSend.length === 0) {
            console.log('No specific notifications to send after filtering.');
            return null;
        }

        // Send notifications
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: uniqueRecipientTokens,
                notification: messagesToSend[0].notification, // Use the first notification's content for all
                data: messagesToSend[0].data, // Use the first notification's data for all
            });

            console.log('Successfully sent messages:', response.successCount);
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`Failed to send message to token ${uniqueRecipientTokens[idx]}:`, resp.error);
                        // TODO: Optionally, remove invalid tokens from Firestore here
                    }
                });
            }
            return null;
        } catch (error) {
            console.error('Error sending messages:', error);
            return null;
        }
    });

// Add a similar trigger for tvChatRooms
exports.sendTVChatNotifications = functions.firestore
    .document('tvChatRooms/{programId}/messages/{messageId}')
    .onCreate(async (snapshot, context) => {
        // Re-use the logic from sendChatNotifications by calling it
        // This assumes the logic is generic enough for both chatRooms and tvChatRooms
        // If there are specific differences in how TV chat notifications should be handled,
        // you might need to duplicate and modify the logic, or pass a flag.
        // For now, we'll just call the main function.
        return exports.sendChatNotifications(snapshot, context);
    });
