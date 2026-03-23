
// This script allows you to test your 'onCall' Firebase Functions locally.
// Make sure the Firebase Emulator Suite is running before executing this script.
//
// Usage:
// 1. Make sure you have run 'npm install' in the 'functions' directory.
// 2. Run the emulator: `firebase emulators:start --only functions`
// 3. In a separate terminal, run this script: `node test-runner.js`

const { initializeApp } = require("firebase/app");
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require("firebase/functions");

// --- Configuration ---
// IMPORTANT: This configuration must match the one in your main application.
// You can find this in your `firebase_options.dart` file or your Firebase project settings.
const firebaseConfig = {
  apiKey: "your-api-key", // Replace with your actual API key
  authDomain: "your-project-id.firebaseapp.com", // Replace with your project ID
  projectId: "salt-media-app1", // Replace with your project ID
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "1:1040428211318:ios:8a7640369bad8041aad357"
};

// --- Test Data ---
// Modify this data to test different scenarios.
const testData = {
  phoneNumber: "256701000000", // Use a valid test phone number
  amount: "1000",
  narrative: "Test Payment"
};
// -------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Connect to the local functions emulator
// The default port is 5001. Change it if your emulator is running on a different port.
connectFunctionsEmulator(functions, "localhost", 5001);

// Get a reference to the function we want to test
const initiateYoPayment = httpsCallable(functions, 'initiateYoPayment');

// Execute the function call
console.log("Calling 'initiateYoPayment' with data:", testData);

initiateYoPayment(testData)
  .then((result) => {
    console.log("Function returned successfully:");
    console.log(result.data);
  })
  .catch((error) => {
    console.error("Function call failed:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
  });
