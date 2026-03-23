const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Make sure your service account key is configured or you are running in a Firebase environment
// If running locally, you might need to set the GOOGLE_APPLICATION_CREDENTIALS environment variable
// For example: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"

const serviceAccount = require("/Users/solomacbookair/Downloads/salt-media-app1-firebase-adminsdk-ruyjd-91df4c232c.json"); // <<< REPLACE WITH THE ACTUAL PATH TO YOUR SERVICE ACCOUNT KEY

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const BUCKET_NAME = 'salt-media-app1.appspot.com'; // <<< REPLACE WITH YOUR ACTUAL BUCKET NAME
const bucket = admin.storage().bucket(BUCKET_NAME);

async function updateExistingImageCache() {
  console.log('Starting to update cache control for existing images...');

  try {
    // List all files in the bucket
    const [files] = await bucket.getFiles();

    for (const file of files) {
      // Check if the file is an image (you might need to refine this check)
      // For example, by checking file.metadata.contentType or file.name extension
      if (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        console.log(`Processing file: ${file.name}`);
        await file.setMetadata({
          cacheControl: 'public, max-age=31536000, immutable',
        });
        console.log(`Set cache control for ${file.name}`);
      } else {
        console.log(`Skipping non-image file: ${file.name}`);
      }
    }
    console.log('Finished updating cache control for existing images.');
  } catch (error) {
    console.error('Error updating cache control:', error);
  }
}

updateExistingImageCache();
