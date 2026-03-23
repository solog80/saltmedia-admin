const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

const db = admin.firestore();

exports.createSubscription = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  // Get the data from the request.
  const userId = context.auth.uid;
  const { channelName, price, validity, transactionId, phoneNumber } = data;

  // Create a new subscription in Firestore.
  const subscriptionId = uuidv4();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + validity);

  await db.collection('subscriptions').doc(subscriptionId).set({
    code: subscriptionId,
    userId: userId,
    channel: channelName,
    price: price,
    purchaseDate: new Date(),
    expiryDate: expiryDate,
    isActive: true,
    lastActivatedUser: userId,
    transactionId: transactionId,
    phoneNumber: phoneNumber,
    linkedUsers: [userId],
  });

  return { subscriptionId: subscriptionId };
});

exports.validateSubscription = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const userId = context.auth.uid;
  const { channelName } = data;

  let query = db.collection('subscriptions')
    .where('linkedUsers', 'array-contains', userId)
    .where('isActive', '==', true);

  if (channelName) {
    query = query.where('channel', '==', channelName);
  }

  const querySnapshot = await query.get();

  if (querySnapshot.empty) {
    return { isValid: false };
  }

  const subscription = querySnapshot.docs[0].data();
  const expiryDate = subscription.expiryDate.toDate();

  if (expiryDate < new Date()) {
    // Subscription has expired, so deactivate it.
    await querySnapshot.docs[0].ref.update({ isActive: false });
    return { isValid: false };
  }

  return { isValid: true };
});

exports.linkSlaveDevice = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const slaveUserId = context.auth.uid;
  const { masterSubscriptionCode } = data;

  const masterDoc = await db.collection('subscriptions').doc(masterSubscriptionCode).get();

  if (!masterDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Master subscription not found.');
  }

  const masterData = masterDoc.data();

  if (!masterData.isActive) {
    throw new functions.https.HttpsError('failed-precondition', 'Master subscription is not active.');
  }

  const linkedUsers = masterData.linkedUsers || [];

  if (linkedUsers.includes(slaveUserId)) {
    return { success: true, message: 'Slave user already linked.' };
  }

  if (linkedUsers.length >= 2) {
    throw new functions.https.HttpsError('failed-precondition', 'User limit reached for this subscription.');
  }

  linkedUsers.push(slaveUserId);

  await masterDoc.ref.update({
    linkedUsers: linkedUsers,
  });

  return { success: true, message: 'Slave user linked successfully.' };
});

exports.getSubscriptionsPaginated = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const userId = context.auth.uid;
  const { limit, lastDocument } = data;

  let query = db.collection('subscriptions')
    .where('linkedUsers', 'array-contains', userId)
    .orderBy('purchaseDate', 'desc')
    .limit(limit);

  if (lastDocument) {
    query = query.startAfter(lastDocument);
  }

  const querySnapshot = await query.get();

  const subscriptions = querySnapshot.docs.map(doc => {
    const data = doc.data();
    // Convert Timestamps to milliseconds since epoch
    data.purchaseDate = data.purchaseDate.toMillis();
    data.expiryDate = data.expiryDate.toMillis();
    return { ...data, id: doc.id };
  });

  const lastDoc = querySnapshot.docs.length === limit ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

  return {
    subscriptions,
    lastDocument: lastDoc,
  };
});

exports.checkExpiredSubscriptions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = new Date();
  const querySnapshot = await db.collection('subscriptions')
    .where('isActive', '==', true)
    .where('expiryDate', '<', now)
    .get();

  if (querySnapshot.empty) {
    console.log('No expired subscriptions found.');
    return null;
  }

  const batch = db.batch();
  querySnapshot.forEach(doc => {
    batch.update(doc.ref, { isActive: false });
  });

  await batch.commit();
  console.log(`Deactivated ${querySnapshot.size} expired subscriptions.`);
  return null;
});
