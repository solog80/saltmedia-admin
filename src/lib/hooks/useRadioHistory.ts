import { useQuery } from '@tanstack/react-query';

export interface RadioHistoryItem {
  sh_id: number;
  station_id: number;
  station_name: string;
  played_at: string;
  duration_seconds: number;
  playlist: string;
  streamer: string;
  is_request: boolean;
  song_id: string;
  song_artist: string;
  song_title: string;
  song_text: string;
  song_album: string;
  song_genre: string;
  listeners_start: number;
  listeners_end: number;
  delta_total: number;
  is_visible: boolean;
}

interface RadioHistoryResponse {
  data: RadioHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

interface UseRadioHistoryParams {
  days?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function useRadioHistory(params: UseRadioHistoryParams = {}) {
  const { days = 7, limit = 100, offset = 0, search = '', sortBy = 'played_at', sortDir = 'desc' } = params;

  const queryParams = new URLSearchParams({
    days: String(days),
    limit: String(limit),
    offset: String(offset),
    sortBy,
    sortDir,
  });
  if (search) queryParams.set('search', search);

  return useQuery<RadioHistoryResponse>({
    queryKey: ['radio-history', days, limit, offset, search, sortBy, sortDir],
    queryFn: async () => {
      const response = await fetch(`/api/radio-history?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    staleTime: 60000,
  });
}
