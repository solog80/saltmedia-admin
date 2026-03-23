import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

// Initialize Firebase Functions (ensure this matches your deployed function region)
const functions = getFunctions(app, 'us-central1');

// Fetcher for getAudioVideoData
export const fetchOnDemandData = async ({ queryKey }) => {
  const [, filter] = queryKey;
  const getAudioVideoDataCallable = httpsCallable(functions, 'getAudioVideoData');
  const result = await getAudioVideoDataCallable({ platform: 'web', filter });
  return result.data.onDemandPlaylists;
};