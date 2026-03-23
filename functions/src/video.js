const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

const BUNNYCDN_LIBRARY_ID = '307069';
const BUNNYCDN_ACCESS_KEY = 'a2c0dc75-a237-41e2-b8a5d6edaff5-2c59-4c18';
const BUNNYCDN_BASE_URL = `https://video.bunnycdn.com/library/${BUNNYCDN_LIBRARY_ID}`;

exports.createVideo = functions.https.onCall(async (data, context) => {
  try {
    const { title, description, collectionId, metaTags } = data;

    if (metaTags && (!Array.isArray(metaTags) || !metaTags.every(tag => typeof tag === 'object' && tag !== null && typeof tag.property === 'string' && typeof tag.value === 'string'))) {
      throw new functions.https.HttpsError('invalid-argument', 'metaTags must be an array of objects with "property" and "value" string fields.');
    }

    // Create a video object in BunnyCDN
    const createVideoResponse = await axios.post(`${BUNNYCDN_BASE_URL}/videos`, {
      title,
      description,
      collectionId,
      metaTags,
    }, {
      headers: {
        AccessKey: BUNNYCDN_ACCESS_KEY,
        'Content-Type': 'application/json',
      },
    });

    const videoId = createVideoResponse.data.guid;

    return { videoId };
  } catch (error) {
    console.error('Error creating video:', error.message, error.stack);
    throw new functions.https.HttpsError('internal', 'Unable to create video.', error.message);
  }
});

exports.createTusUpload = functions.https.onCall(async (data, context) => {
  try {
    const { title, collectionId } = data;

    // Create a video object in BunnyCDN
    const createVideoResponse = await axios.post(`${BUNNYCDN_BASE_URL}/videos`, {
      title,
      collectionId,
    }, {
      headers: {
        AccessKey: BUNNYCDN_ACCESS_KEY,
        'Content-Type': 'application/json',
      },
    });

    const videoId = createVideoResponse.data.guid;
    const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const signature = crypto.createHash('sha256').update(BUNNYCDN_LIBRARY_ID + BUNNYCDN_ACCESS_KEY + expirationTime + videoId).digest('hex');

    return { videoId, expirationTime, signature };
  } catch (error) {
    console.error('Error creating TUS upload:', error.message, error.stack);
    if (error.response) {
      console.error('BunnyCDN error response status:', error.response.status);
      console.error('BunnyCDN error response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('BunnyCDN error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new functions.https.HttpsError('internal', 'Unable to create TUS upload.', error.message);
  }
});

exports.uploadVideo = functions.https.onCall(async (data, context) => {
  try {
    const { videoId, file } = data;

    // Upload the video to BunnyCDN
    await axios.put(`${BUNNYCDN_BASE_URL}/videos/${videoId}`, file, {
      headers: {
        AccessKey: BUNNYCDN_ACCESS_KEY,
        'Content-Type': 'application/octet-stream',
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error uploading video:', error.message, error.stack);
    throw new functions.https.HttpsError('internal', 'Unable to upload video.', error.message);
  }
});

exports.updateVideoInfo = functions.https.onCall(async (data, context) => {
  try {
    const { videoId, metaTags, title, description } = data;

    const requestBody = {};
    if (metaTags) {
      requestBody.metaTags = metaTags;
    }
    if (title) {
      requestBody.title = title;
    }
    if (description) {
      requestBody.description = description;
    }

    await axios.post(`${BUNNYCDN_BASE_URL}/videos/${videoId}`, requestBody, {
      headers: {
        AccessKey: BUNNYCDN_ACCESS_KEY,
        'Content-Type': 'application/json',
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating video info:', error.message, error.stack);
    if (error.response) {
      console.error('BunnyCDN error response status:', error.response.status);
      console.error('BunnyCDN error response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('BunnyCDN error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new functions.https.HttpsError('internal', 'Unable to update video info.', error.message);
  }
});

exports.deleteVideo = functions.https.onCall(async (data, context) => {
  try {
    const { videoId } = data;

    await axios.delete(`${BUNNYCDN_BASE_URL}/videos/${videoId}`, {
      headers: {
        AccessKey: BUNNYCDN_ACCESS_KEY,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting video:', error.message, error.stack);
    if (error.response) {
      console.error('BunnyCDN error response status:', error.response.status);
      console.error('BunnyCDN error response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('BunnyCDN error response data:', JSON.stringify(error.response.data, null, 2));
    }
    throw new functions.https.HttpsError('internal', 'Unable to delete video.', error.message);
  }
});
