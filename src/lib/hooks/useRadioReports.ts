import { useQuery } from '@tanstack/react-query';

export interface RadioReports {
  current: {
    snapshot_at: string;
    listeners_total: number;
    listeners_unique: number;
    listeners_current: number;
    hls_listeners: number;
    mount_current: number;
    song_title: string;
    song_artist: string;
    song_text: string;
    streamer_name: string;
    is_live: boolean;
  } | null;

  daily: Array<{
    date: string;
    avg_listeners: number;
    unique_listeners: number | null;
  }>;

  hourlyToday: Array<{
    hour: number;
    peak_listeners: number;
  }>;

  hourlyCompare: Array<{
    hour: number;
    peak_listeners: number;
  }>;

  hourlyPrograms: Array<{
    hour: number;
    programName: string | null;
  }>;

  dayOfWeek: Array<{
    date: string;
    listeners: number;
  }>;

  topSongs: Array<{
    song_title: string;
    song_artist: string;
    plays: number;
    total_airtime_seconds: number;
  }>;

  best: Array<{
    song_title: string;
    song_artist: string;
    listeners_start: number;
    listeners_end: number;
    delta_total: number;
    played_at: string;
  }>;

  worst: Array<{
    song_title: string;
    song_artist: string;
    listeners_start: number;
    listeners_end: number;
    delta_total: number;
    played_at: string;
  }>;

  today: {
    songs_played: number;
    total_airtime_seconds: number;
    avg_listeners: number;
    peak_listeners: number;
    unique_listeners: number;
  } | null;

  byCountry: Array<{
    country_code: string;
    country: string;
    listeners: number;
    connected_seconds: number;
  }>;

  byBrowser: Array<{
    browser: string;
    listeners: number;
    connected_seconds: number;
  }>;

  byClient: Array<{
    client_raw: string;
    client: string;
    listeners: number;
    connected_seconds: number;
  }>;

  byStream: Array<{
    stream_id: string;
    stream: string;
    listeners: number;
    connected_seconds: number;
  }>;

  byListeningTime: Array<{
    label: string;
    value: number;
  }>;

  currentShow: {
    programName: string;
    presenter: string;
    genre: string;
    startTime: string;
    endTime: string;
    image: string | null;
    imageLandscape: string | null;
  } | null;
}

interface RadioReportsParams {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export function useRadioReports(params: RadioReportsParams = {}) {
  const { days = 30, startDate = '', endDate = '' } = params;
  const qp = new URLSearchParams({ days: String(days) });
  if (startDate) qp.set('startDate', startDate);
  if (endDate) qp.set('endDate', endDate);

  return useQuery<RadioReports>({
    queryKey: ['radio-reports', days, startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/radio-reports?${qp.toString()}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
}
