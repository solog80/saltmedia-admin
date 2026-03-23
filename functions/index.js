const admin = require('firebase-admin');
admin.initializeApp();

// Import your scheduled chat room management function
const scheduledChatManager = require('./src/scheduledChatManager');

// Export the scheduled chat room management function
exports.scheduledChatRoomManager = scheduledChatManager.scheduledChatRoomManager;

// Import and export Yo! Payments functions
const yoPayments = require('./src/yoPayments');
const scheduledTvChatManager = require('./src/scheduledTvChatManager');

exports.initiateYoDeposit = yoPayments.initiateYoDeposit;
exports.yoWebhooks = yoPayments.yoWebhooks;
exports.checkYoTransactionStatus = yoPayments.checkYoTransactionStatus;
exports.scheduledTvChatManager = scheduledTvChatManager.scheduledTvChatRoomManager;

const updateChatParticipants = require('./src/updateChatParticipants');
exports.updateChatParticipants = updateChatParticipants.updateChatParticipants;

// Import and export subscription functions
const subscriptions = require('./src/subscriptions');
exports.createSubscription = subscriptions.createSubscription;
exports.validateSubscription = subscriptions.validateSubscription;
exports.linkSlaveDevice = subscriptions.linkSlaveDevice;
exports.checkExpiredSubscriptions = subscriptions.checkExpiredSubscriptions;
exports.getSubscriptionsPaginated = subscriptions.getSubscriptionsPaginated;

// Import and export chat notification functions
const chatNotifications = require('./src/chatNotifications');
exports.sendChatNotifications = chatNotifications.sendChatNotifications;
exports.sendTVChatNotifications = chatNotifications.sendTVChatNotifications;

// Import and export anonymous user cleanup function
const cleanupAnonymousUsers = require('./src/cleanupAnonymousUsers');
exports.cleanupInactiveAnonymousUsers = cleanupAnonymousUsers.cleanupInactiveAnonymousUsers;

// Import and export audio/video data function
const audioVideoApi = require('./src/audio-video-api');
exports.getAudioVideoData = audioVideoApi.getAudioVideoData;

// Import and export video functions
const video = require('./src/video');
exports.createVideo = video.createVideo;
exports.createTusUpload = video.createTusUpload;
exports.uploadVideo = video.uploadVideo;
exports.updateVideoInfo = video.updateVideoInfo;
exports.deleteVideo = video.deleteVideo;

// Import and export user management functions
const userManagement = require('./src/userManagement');
exports.updateUserRole = userManagement.updateUserRole;
exports.getUsersPaginated = userManagement.getUsersPaginated;

// Import and export storage optimization functions
const storageOptimization = require('./src/storageOptimization');
exports.setCacheControl = storageOptimization.setCacheControl;


