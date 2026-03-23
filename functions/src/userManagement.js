const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.updateUserRole = functions.https.onCall(async (data, context) => {
  /*
  // Temporarily disabled for bootstrapping the first admin
  if (!context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can update user roles."
    );
  }
  */

  const userId = data.userId;
  const newRole = data.newRole;

  if (!userId || !newRole) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'userId' and 'newRole' arguments."
    );
  }

  const validRoles = ["admin", "editor", "viewer"];
  if (!validRoles.includes(newRole)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid role specified."
    );
  }

  try {
    await admin.auth().setCustomUserClaims(userId, { role: newRole });
    await admin.firestore().collection("users").doc(userId).update({
      role: newRole,
    });
    return {
      message: `Successfully updated role for user ${userId} to ${newRole}.`,
    };
  } catch (error) {
    console.error("Error updating user role:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while updating the user role."
    );
  }
});

exports.createUser = functions.https.onCall(async (data, context) => {
  /*
  // Temporarily disabled for bootstrapping the first admin
  if (!context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can create users."
    );
  }
  */

  const { email, password, role } = data;

  if (!email || !password || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'email', 'password', and 'role' arguments."
    );
  }

  const validRoles = ["admin", "editor", "viewer"];
  if (!validRoles.includes(role)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid role specified."
    );
  }

  try {
    const userRecord = await admin.auth().createUser({ email, password });
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });
    await admin.firestore().collection("users").doc(userRecord.uid).set({
      email: userRecord.email,
      role: role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: `Successfully created user ${userRecord.email} with role ${role}.` };
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError(
        "already-exists",
        "The email address is already in use by another account."
      );
    } else if (error.code === 'auth/invalid-password') {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The password must be a string with at least six characters."
      );
    } else {
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while creating the user."
      );
    }
  }
});

exports.deleteUser = functions.https.onCall(async (data, context) => {
  /*
  // Temporarily disabled for bootstrapping the first admin
  if (!context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }
  */

  const userId = data.userId;

  if (!userId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with 'userId' argument."
    );
  }

  try {
    await admin.auth().deleteUser(userId);
    await admin.firestore().collection("users").doc(userId).delete();

    return { message: `Successfully deleted user ${userId}.` };
  } catch (error) {
    console.error("Error deleting user:", error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError(
        "not-found",
        "User not found."
      );
    } else {
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while deleting the user."
      );
    }
  }
});

exports.getUsersPaginated = functions.https.onCall(async (data, context) => {
  /*
  // Temporarily disabled for bootstrapping the first admin
  if (!context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new new functions.https.HttpsError(
      "permission-denied",
      "Only admins can list users."
    );
  }
  */

  try {
    const lastVisibleId = data?.lastVisibleId;
    const searchTerm = data?.searchTerm?.toLowerCase(); // Convert to lowercase for case-insensitive search
    const limit = 20; // Number of users per page

    let query = admin.firestore().collection('users');

    // Apply search term if provided
    if (searchTerm) {
      // For prefix matching on name, we need to query a range
      // This requires an index on 'name' field
      query = query
        .where('name', '>=', searchTerm)
        .where('name', '<=', searchTerm + '\uf8ff'); // \uf8ff is a high-value Unicode character
    }

    // Always order by createdAt for consistent pagination, and name for search if searchTerm is present
    // Note: If searchTerm is present, Firestore requires an index on (name, createdAt)
    // If no searchTerm, it requires an index on (createdAt)
    if (searchTerm) {
      query = query.orderBy('name').orderBy('createdAt', 'desc');
    } else {
      query = query.orderBy('createdAt', 'desc');
    }

    if (lastVisibleId) {
      const lastVisibleDoc = await admin.firestore().collection('users').doc(lastVisibleId).get();
      if (!lastVisibleDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Last visible document not found.');
      }
      // When searching, startAfter needs to match the orderBy fields
      if (searchTerm) {
        query = query.startAfter(lastVisibleDoc.data().name, lastVisibleDoc.data().createdAt);
      } else {
        query = query.startAfter(lastVisibleDoc.data().createdAt);
      }
    }

    const snapshot = await query.limit(limit).get();

    console.log('DEBUG: Firestore snapshot empty:', snapshot.empty);
    console.log('DEBUG: Firestore snapshot size:', snapshot.size);

    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    console.log('DEBUG: Users array before return:', users);

    const nextLastVisibleId = snapshot.docs.length === limit ? snapshot.docs[snapshot.docs.length - 1].id : null;

    console.log('DEBUG: nextPageToken before return:', nextLastVisibleId);

    return {
      users: users,
      nextPageToken: nextLastVisibleId,
    };
  } catch (error) {
    console.error("Error in getUsersPaginated:", error);
    throw new functions.https.HttpsError(
      "internal",
      "An error occurred while listing users."
    );
  }
});