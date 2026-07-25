const admin = require('firebase-admin');
admin.initializeApp();

// Import all shared functions from salt-shared-functions
// This is the single source of truth for all Cloud Functions
const sharedFunctions = require('salt-shared-functions');

// Re-export all shared functions
Object.assign(exports, sharedFunctions);


