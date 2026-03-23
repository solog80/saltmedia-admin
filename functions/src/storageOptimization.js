const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getStorage } = require("firebase-admin/storage");
const { initializeApp, getApps } = require("firebase-admin/app");
const logger = require("firebase-functions/logger");

if (!getApps().length) {
  initializeApp();
}

exports.setCacheControl = onObjectFinalized({ cpu: 'gcf_gen1', region: 'europe-west1' }, async (event) => {
  logger.info("Event: ", event);

  const bucketName = event.bucket;
  const fileName = event.subject.split('objects/')[1];
  const fileContentType = event.data.contentType;

  if (fileContentType && fileContentType.startsWith("image/")) {
    const file = getStorage().bucket(bucketName).file(fileName);
    await file.setMetadata({
      cacheControl: "public, max-age=31536000, immutable",
    });
    logger.info(`Set cache control for ${fileName}`);
  }
});
