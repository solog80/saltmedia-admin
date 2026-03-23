const functions = require('firebase-functions');
const admin = require('firebase-admin');
const db = admin.firestore();
const axios = require('axios'); // Import axios for HTTP requests

// BunnyCDN API credentials (MOVE TO ENVIRONMENT CONFIG IN PRODUCTION!)
const BUNNYCDN_LIBRARY_ID = '307069';
const BUNNYCDN_ACCESS_KEY = 'a2c0dc75-a237-41e2-b8a5d6edaff5-2c59-4c18';
const BUNNYCDN_BASE_URL = `https://video.bunnycdn.com/library/${BUNNYCDN_LIBRARY_ID}`;

exports.getAudioVideoData = functions.https.onCall(async (data, context) => {
    // Optional: Authenticate the user if necessary
    // if (!context.auth) {
    //     throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    // }

    try {
        // Get current day in UTC
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getUTCDay()];

        // Fetch data from different sources in parallel
        const [epgResult, radioResult, bunnyCdnCollectionsResult] = await Promise.allSettled([
            db.collection('fm_program_lineup').doc('Live_TV').get(), // EPG data
            db.collection('fm_program_lineup').doc('Live_Radio').get(), // Radio data
            axios.get(`${BUNNYCDN_BASE_URL}/collections?orderBy=date&includeThumbnails=true`, {
                headers: { AccessKey: BUNNYCDN_ACCESS_KEY }
            })
        ]);

        // Process EPG data
        const processedEpgData = {};
        if (epgResult.status === 'fulfilled' && epgResult.value.exists) {
            const stations = epgResult.value.data();
            for (const stationId in stations) {
                const stationData = stations[stationId];
                let programs = stationData.ProgramLineup || [];
                if (data.platform === 'mobile') {
                    programs = programs.filter(p => p.days && p.days.includes(currentDay));
                }

                processedEpgData[stationId] = {
                    ...stationData,
                    stationUrl: stationData.stationUrl || null,
                    ProgramLineup: programs
                };
            }
        } else if (epgResult.status === 'rejected') {
            console.error("Error fetching EPG data:", epgResult.reason);
        }
        console.log('EPG Data:', JSON.stringify(processedEpgData, null, 2));


        // Process Radio data
        let radio = {};
        if (radioResult.status === 'fulfilled' && radioResult.value.exists) {
            const radioData = radioResult.value.data();
            const radioUrl = radioData.url || null;
            let radioPrograms = radioData.programLineup || [];
            if (data.platform === 'mobile') {
                radioPrograms = radioPrograms.filter(p => p.days && p.days.includes(currentDay));
            }
            radio = {
                url: radioUrl,
                programs: radioPrograms
            };
        } else if (radioResult.status === 'rejected') {
            console.error("Error fetching Radio data:", radioResult.reason);
        }
        console.log('Radio Data:', JSON.stringify(radio, null, 2));


        // Process BunnyCDN On-Demand Playlists
        let onDemandPlaylistsData = [];
        if (bunnyCdnCollectionsResult.status === 'fulfilled' && bunnyCdnCollectionsResult.value.status === 200 && bunnyCdnCollectionsResult.value.data && bunnyCdnCollectionsResult.value.data.items) {
            // For each collection, fetch its videos (BunnyCDN collections API doesn't include videos directly)
            const collections = bunnyCdnCollectionsResult.value.data.items;
            const videoFetchPromises = collections.map(async (collection) => {
                try {
                    const videosResponse = await axios.get(`${BUNNYCDN_BASE_URL}/videos?collection=${collection.guid}&orderBy=date`, {
                        headers: { AccessKey: BUNNYCDN_ACCESS_KEY }
                    });
                    if (videosResponse.status === 200 && videosResponse.data && videosResponse.data.items) {
                        let allVideos = videosResponse.data.items;
                        const filter = data.filter || 'All'; // 'All', 'New', 'Outgoing'

                        if (filter === 'New') {
                            const sevenDaysAgo = new Date();
                            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                            allVideos = allVideos.filter(video => {
                                if (!video.dateUploaded) return false;
                                const uploadDate = new Date(video.dateUploaded);
                                return uploadDate > sevenDaysAgo;
                            });
                        } else if (filter === 'Outgoing') {
                            const oneHundredFortyFiveDaysAgo = new Date();
                            oneHundredFortyFiveDaysAgo.setDate(oneHundredFortyFiveDaysAgo.getDate() - 145);
                            const oneHundredThirtyEightDaysAgo = new Date();
                            oneHundredThirtyEightDaysAgo.setDate(oneHundredThirtyEightDaysAgo.getDate() - 138);
                            allVideos = allVideos.filter(video => {
                                if (!video.dateUploaded) return false;
                                const uploadDate = new Date(video.dateUploaded);
                                return uploadDate > oneHundredFortyFiveDaysAgo && uploadDate < oneHundredThirtyEightDaysAgo;
                            });
                        } else { // 'All' or any other case
                            // No filtering for 'All'
                        }

                        const videosWithThumbnails = allVideos.map(video => ({
                            ...video,
                            thumbnailUrl: video.thumbnailFileName && video.thumbnailFileName.length > 0
                                ? `https://vz-13b87e04-41b.b-cdn.net/${video.guid}/${video.thumbnailFileName}`
                                : `https://vz-13b87e04-41b.b-cdn.net/${video.guid}/thumbnail.jpg`
                        }));

                        return { ...collection, videos: videosWithThumbnails };
                    }
                } catch (videoError) {
                    console.error(`Error fetching videos for collection ${collection.guid}:`, videoError.message);
                }
                return { ...collection, videos: [] }; // Return collection with empty videos on error
            });
            onDemandPlaylistsData = await Promise.all(videoFetchPromises);
        } else if (bunnyCdnCollectionsResult.status === 'rejected') {
            console.error("Error fetching BunnyCDN collections:", bunnyCdnCollectionsResult.reason);
        }

        console.log('On Demand Playlists:', JSON.stringify(onDemandPlaylistsData, null, 2));

        const response = {
            epg: processedEpgData,
            radio: radio,
            onDemandPlaylists: onDemandPlaylistsData
        };

        console.log('Final Response:', JSON.stringify(response, null, 2));

        return response;

    } catch (error) {
        console.error('Error fetching audio/video data:', error.message, error.stack);
        throw new functions.https.HttpsError('internal', 'Unable to fetch audio/video data.', error.message);
    }
});