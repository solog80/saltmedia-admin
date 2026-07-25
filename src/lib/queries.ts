import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

/**
 * Fetch all on-demand shows (list view)
 * Returns shows with titles, episode counts, seasons count
 */
export const fetchOnDemandData = async ({ queryKey: _ }: { queryKey: any }) => {
  try {
    const functionsEu = getFunctions(app, 'europe-west1');
    const getOnDemandDataCallable = httpsCallable(functionsEu, 'getOnDemandData');
    const result = await getOnDemandDataCallable() as any;

    console.log('[fetchOnDemandData] Data loaded from:', result.data.source);

    // Extract shows from unified cache format {shows: [...]}
    const showsData = result.data.data?.shows || [];

    // Transform shows: use poster if it's not a BunnyCDN placeholder, else fallback to thumbnail
    const shows = showsData.map((show: any) => ({
      ...show,
      image: (show.posterUrl16x9 && !show.posterUrl16x9.includes('b-cdn.net/posters/'))
          ? show.posterUrl16x9
          : show.thumbnail,
    }));

    // Wrap in documents property for backwards compatibility with component
    return {
      documents: shows
    };
  } catch (error) {
    console.error('[fetchOnDemandData] Error:', error);
    throw error;
  }
};

/**
 * Fetch specific show with seasons and episode previews
 */
export const fetchOnDemandShowById = async (showId: string) => {
  try {
    const functionsEu = getFunctions(app, 'europe-west1');
    const getShowCallable = httpsCallable(functionsEu, 'getOnDemandShowById');
    const result = await getShowCallable({ showId }) as any;

    console.log('[fetchOnDemandShowById] Show loaded from:', result.data.source);

    return result.data.data;
  } catch (error) {
    console.error('[fetchOnDemandShowById] Error:', error);
    throw error;
  }
};

/**
 * Fetch all episodes for a specific season
 */
export const fetchOnDemandSeasonEpisodes = async (showId: string, seasonId: string) => {
  try {
    const functionsEu = getFunctions(app, 'europe-west1');
    const getEpisodesCallable = httpsCallable(functionsEu, 'getOnDemandSeasonEpisodes');
    const result = await getEpisodesCallable({ showId, seasonId }) as any;

    console.log('[fetchOnDemandSeasonEpisodes] Episodes loaded from:', result.data.source);

    return result.data.data;
  } catch (error) {
    console.error('[fetchOnDemandSeasonEpisodes] Error:', error);
    throw error;
  }
};