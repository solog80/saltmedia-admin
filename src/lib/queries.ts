import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

/**
 * Fetch all on-demand shows (list view)
 * Returns shows with titles, episode counts, seasons count
 */
export const fetchOnDemandData = async ({ queryKey: _ }: { queryKey: any }) => {
  try {
    const res = await fetch('/api/ondemand', { cache: 'no-store' });

    if (!res.ok) {
      throw new Error(`On-demand fetch failed: ${res.status}`);
    }
    const result = await res.json();

    console.log('[fetchOnDemandData] Data loaded from:', result.source);

    // Extract shows from unified cache format {shows: [...]}
    const showsData = result.data?.shows || [];

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
    const res = await fetch(`/api/ondemand?mode=show&showId=${encodeURIComponent(showId)}`, { cache: 'no-store' });

    if (!res.ok) {
      throw new Error(`On-demand show fetch failed: ${res.status}`);
    }
    const result = await res.json();

    console.log('[fetchOnDemandShowById] Show loaded from:', result.source);

    return result.data;
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
    const res = await fetch(
      `/api/ondemand?mode=season&showId=${encodeURIComponent(showId)}&seasonId=${encodeURIComponent(seasonId)}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      throw new Error(`On-demand season fetch failed: ${res.status}`);
    }
    const result = await res.json();

    console.log('[fetchOnDemandSeasonEpisodes] Episodes loaded from:', result.source);

    return result.data;
  } catch (error) {
    console.error('[fetchOnDemandSeasonEpisodes] Error:', error);
    throw error;
  }
};