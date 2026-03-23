
const admin = require("firebase-admin");

// You'''ll need to download your service account key from the Firebase console
// and set the path to it here.
const serviceAccount = require("/Users/solomacbookair/Downloads/salt-media-app1-firebase-adminsdk-ruyjd-91df4c232c.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function updateUserRoles() {
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();

  if (snapshot.empty) {
    console.log("No users found.");
    return;
  }

  const batch = db.batch();
  snapshot.forEach((doc) => {
    const user = doc.data();
    const userRef = usersRef.doc(doc.id);

    // If the user already has a role, do nothing.
    if (user.role) {
      return;
    }

    // Set a default role.
    // You can customize this logic. For example, if user.isAdmin is true,
    // set the role to '''admin''', otherwise '''viewer'''.
    let defaultRole = 'viewer';
    if (user.isAdmin === true) {
      defaultRole = 'admin';
    }

    batch.update(userRef, { role: defaultRole });
  });

  await batch.commit();
  console.log(`Updated roles for ${snapshot.size} users.`);
}

updateUserRoles().catch(console.error);
