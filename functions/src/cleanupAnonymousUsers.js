const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Cleans up inactive anonymous user documents from Firestore.
 * Runs daily to delete anonymous users inactive for more than 90 days.
 */
exports.cleanupInactiveAnonymousUsers = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const INACTIVITY_THRESHOLD_DAYS = 90; // Define inactivity period
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVITY_THRESHOLD_DAYS);

    console.log(`Starting cleanup of anonymous users inactive before: ${cutoff.toISOString()}`);

    try {
        const inactiveUsersSnapshot = await db.collection('users')
            .where('isAnonymous', '==', true)
            .where('lastActiveAt', '<', cutoff)
            .get();

        if (inactiveUsersSnapshot.empty) {
            console.log('No inactive anonymous users found for cleanup.');
            return null;
        }

        const batch = db.batch();
        inactiveUsersSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Successfully deleted ${inactiveUsersSnapshot.size} inactive anonymous user documents.`);
        return null;

    } catch (error) {
        console.error('Error during inactive anonymous user cleanup:', error);
        return null;
    }
});