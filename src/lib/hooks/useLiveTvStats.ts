import { useQuery } from '@tanstack/react-query';
import { utcToLocal } from '@/lib/utils/timeConversion';

interface StreamCount {
  name: string;
  viewers: number;
}

export interface ViewerStat {
  minute: string;
  stream: string;
  viewers: number;
}

export interface ViewerCountry {
  code: string;
  name: string;
  viewers: number;
}

export interface ViewerIsp {
  code: string;
  isp: string;
  viewers: number;
}

export interface LiveViewers {
  viewers: number;
  total_connections?: number;
  llhls_connections?: number;
  webrtc_connections?: number;
  avg_throughput_out?: number;
  avg_throughput_in?: number;
  ipv4: number;
  ipv6: number;
  window_minutes: number;
  streams: Record<string, number>;
  countries: ViewerCountry[];
  isps: ViewerIsp[];
  excluded_datacenters_count?: number;
}

export interface ViewerPeak {
  peak_viewers: number;
  peak_time: string | null;
  window_minutes: number | null;
  current_viewers: number;
  samples?: number;
}

export interface EPGProgram {
  programName: string;
  startTime: string;
  endTime: string;
  days: string;
}

export interface ShowViewerStat {
  show: string;
  stream: string;
  minute: string;
  viewers: number;
  showStartUtc?: string;
  showEndUtc?: string;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const getStationForStream = (streamName: string): string | null => {
  if (!streamName) return null;
  const clean = streamName.toLowerCase().replace(/^app\//, '');
  if (clean.includes('stream2') || clean.includes('salt2')) {
    return 'Salt TV Two';
  }
  if (clean.includes('stream') || clean.includes('salt1')) {
    return 'Salt TV One';
  }
  return null;
};

export const getStreamKey = (streamName: string): 'stream' | 'stream2' | null => {
  if (!streamName) return null;
  const clean = streamName.toLowerCase().replace(/^app\//, '');
  if (clean.includes('stream2') || clean.includes('salt2')) {
    return 'stream2';
  }
  if (clean.includes('stream') || clean.includes('salt1')) {
    return 'stream';
  }
  return null;
};

export const normalizeMinute = (isoStr: string): string => {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    d.setSeconds(0, 0);
    return d.toISOString();
  } catch {
    return isoStr;
  }
};

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
  }
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }
  return null;
}

export const findShowForMinute = (
  programs: EPGProgram[],
  minuteIso: string
): { show: string; startUtc: string; endUtc: string } | null => {
  if (!programs || !programs.length || !minuteIso) return null;
  const targetDate = new Date(minuteIso);
  if (isNaN(targetDate.getTime())) return null;

  const targetDay = DAY_NAMES[targetDate.getUTCDay()];
  const yesterdayDay = DAY_NAMES[(targetDate.getUTCDay() + 6) % 7];
  const targetMinutes = targetDate.getUTCHours() * 60 + targetDate.getUTCMinutes();

  for (const p of programs) {
    const startMin = parseTimeToMinutes(p.startTime);
    let endMin = parseTimeToMinutes(p.endTime);
    if (startMin === null || endMin === null) continue;

    if (endMin === 0 && startMin > 0) {
      endMin = 1440;
    }

    const daysList = p.days
      ? p.days.split(',').map((d) => d.trim().toLowerCase())
      : [];

    const isToday = daysList.length === 0 || daysList.includes(targetDay.toLowerCase());
    const isYesterday = daysList.includes(yesterdayDay.toLowerCase());

    if (endMin > startMin) {
      if (isToday && targetMinutes >= startMin && targetMinutes < endMin) {
        return {
          show: p.programName,
          startUtc: p.startTime,
          endUtc: p.endTime,
        };
      }
    } else if (endMin < startMin) {
      if (isToday && targetMinutes >= startMin) {
        return {
          show: p.programName,
          startUtc: p.startTime,
          endUtc: p.endTime,
        };
      }
      if (isYesterday && targetMinutes < endMin) {
        return {
          show: p.programName,
          startUtc: p.startTime,
          endUtc: p.endTime,
        };
      }
    } else {
      if (isToday) {
        return {
          show: p.programName,
          startUtc: p.startTime,
          endUtc: p.endTime,
        };
      }
    }
  }
  return null;
};

// Map every per-minute viewer stat row to the EPG show airing on that stream.
// Supports stream/stream2, app/stream/abr.m3u8, stream2/abr.m3u8, etc.
export const mapViewerStatsToShows = (
  stats: ViewerStat[],
  tv: Record<string, { programs: EPGProgram[] }>
): ShowViewerStat[] => {
  if (!stats || !Array.isArray(stats)) return [];
  const results: ShowViewerStat[] = [];

  const normalizedTv: Record<string, { programs: EPGProgram[] }> = {};
  if (tv) {
    for (const [k, v] of Object.entries(tv)) {
      normalizedTv[k] = v;
      normalizedTv[k.toLowerCase()] = v;
      normalizedTv[k.toLowerCase().replace(/\s+/g, '_')] = v;
      normalizedTv[k.toLowerCase().replace(/_/g, ' ')] = v;
    }
  }

  for (const s of stats) {
    const station = getStationForStream(s.stream);
    if (!station) continue;
    const minute = normalizeMinute(s.minute);

    const stationData =
      normalizedTv[station] ||
      normalizedTv[station.toLowerCase()] ||
      normalizedTv[station.toLowerCase().replace(/\s+/g, '_')];

    const show = stationData
      ? findShowForMinute(stationData.programs || [], minute)
      : null;
    const key = getStreamKey(s.stream) || 'stream';
    if (minute && s.viewers > 0) {
      results.push({
        show: show?.show || 'Off-Air / Unknown',
        stream: key,
        minute,
        viewers: s.viewers,
        showStartUtc: show?.startUtc,
        showEndUtc: show?.endUtc,
      });
    }
  }
  return results;
};

// Aggregate show-mapped stats into per-show totals: total + avg viewers.
export interface ShowAggregate {
  show: string;
  minutes: number;
  totalViewers: number;
  avgViewers: number;
  startLocal: string;
  endLocal: string;
}

export const aggregateViewerByShow = (
  rows: ShowViewerStat[]
): ShowAggregate[] => {
  const byShow = new Map<string, ShowAggregate>();
  rows.forEach((r) => {
    const entry = byShow.get(r.show) || {
      show: r.show,
      minutes: 0,
      totalViewers: 0,
      avgViewers: 0,
      startLocal: r.showStartUtc ? utcToLocal(r.showStartUtc) : '',
      endLocal: r.showEndUtc ? utcToLocal(r.showEndUtc) : '',
    };
    entry.minutes += 1;
    entry.totalViewers += r.viewers;
    byShow.set(r.show, entry);
  });
  return Array.from(byShow.values())
    .map((e) => ({ ...e, avgViewers: e.minutes ? Math.round(e.totalViewers / e.minutes) : 0 }))
    .sort((a, b) => b.totalViewers - a.totalViewers);
};

export interface ShowStreamAggregate {
  show: string;
  minutes: number;
  totalViewers: number;
  stream1Viewers: number;
  stream2Viewers: number;
  startLocal: string;
  endLocal: string;
}

// Per-show totals split by channel (Salt TV One vs Two). This is the "Stream
// Breakdown" view: how each program performed, and on which channel.
export const aggregateViewerByShowAndStream = (
  rows: ShowViewerStat[]
): ShowStreamAggregate[] => {
  const byShow = new Map<string, ShowStreamAggregate>();
  const streamMinutes = new Map<string, { stream: number; stream2: number }>();
  rows.forEach((r) => {
    const entry = byShow.get(r.show) || {
      show: r.show,
      minutes: 0,
      totalViewers: 0,
      stream1Viewers: 0,
      stream2Viewers: 0,
      startLocal: r.showStartUtc ? utcToLocal(r.showStartUtc) : '',
      endLocal: r.showEndUtc ? utcToLocal(r.showEndUtc) : '',
    };
    entry.minutes += 1;
    entry.totalViewers += r.viewers;
    if (r.stream === 'stream') {
      entry.stream1Viewers += r.viewers;
      const m = streamMinutes.get(r.show) || { stream: 0, stream2: 0 };
      m.stream += 1;
      streamMinutes.set(r.show, m);
    } else if (r.stream === 'stream2') {
      entry.stream2Viewers += r.viewers;
      const m = streamMinutes.get(r.show) || { stream: 0, stream2: 0 };
      m.stream2 += 1;
      streamMinutes.set(r.show, m);
    }
    byShow.set(r.show, entry);
  });
  return Array.from(byShow.values())
    .map((e) => {
      const m = streamMinutes.get(e.show) || { stream: 0, stream2: 0 };
      return {
        ...e,
        stream1Viewers: m.stream ? Math.round(e.stream1Viewers / m.stream) : 0,
        stream2Viewers: m.stream2 ? Math.round(e.stream2Viewers / m.stream2) : 0,
      };
    })
    .sort((a, b) => a.startLocal.localeCompare(b.startLocal));
};

export interface TrendPoint {
  name: string;
  show: string;
  viewers: number;
  peak: number;
}

const bucketStart = (minuteIso: string, bucketMinutes: number): number => {
  const t = new Date(minuteIso).getTime();
  return Math.floor(t / (bucketMinutes * 60 * 1000)) * bucketMinutes * 60 * 1000;
};

// Pick a bucket size so the timeline stays readable (6-12 points).
export const autoBucketMinutes = (windowMinutes: number): number => {
  if (windowMinutes <= 30) return 5;
  if (windowMinutes <= 60) return 10;
  if (windowMinutes <= 180) return 30;
  if (windowMinutes <= 720) return 60;
  return 120;
};

// Build a chart series of (time label, show, avg viewers) for the window,
// bucketed into `bucketMinutes` intervals to keep the timeline readable.
export const showTrendSeries = (
  rows: ShowViewerStat[],
  bucketMinutes = 10
): TrendPoint[] => {
  const byBucket = new Map<
    number,
    { shows: Set<string>; total: number; count: number; peak: number }
  >();
  rows.forEach((r) => {
    const key = bucketStart(r.minute, bucketMinutes);
    const existing = byBucket.get(key);
    if (existing) {
      existing.total += r.viewers;
      existing.count += 1;
      existing.shows.add(r.show);
      if (r.viewers > existing.peak) existing.peak = r.viewers;
    } else {
      byBucket.set(key, {
        shows: new Set([r.show]),
        total: r.viewers,
        count: 1,
        peak: r.viewers,
      });
    }
  });
  return Array.from(byBucket.entries())
    .map(([key, e]) => ({
      name: new Date(key).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      show: Array.from(e.shows).join(' / '),
      viewers: e.count ? Math.round(e.total / e.count) : 0,
      peak: e.peak,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Live numbers straight from the edge stats API (proxied server-side)
export const useLiveViewers = (minutes = 5) => {
  return useQuery({
    queryKey: ['live-viewers', minutes],
    queryFn: async (): Promise<LiveViewers> => {
      const res = await fetch(
        `/api/live-tv-stats?path=viewers&minutes=${minutes}&countries=1&filter_dc=1`
      );
      if (!res.ok) throw new Error(`Live stats returned ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
};

export const useLivePeak = (minutes = 60) => {
  return useQuery({
    queryKey: ['live-peak', minutes],
    queryFn: async (): Promise<ViewerPeak> => {
      const res = await fetch(`/api/live-tv-stats?action=peak_bq&minutes=${minutes}`);
      if (!res.ok) throw new Error(`Live peak returned ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
};

// History + country breakdown from Mesh API
export const useViewerStats = (minutes = 30) => {
  return useQuery({
    queryKey: ['viewer-stats-bq', minutes],
    queryFn: async (): Promise<ViewerStat[]> => {
      const res = await fetch(`/api/live-tv-stats?action=stats&minutes=${minutes}`);
      if (!res.ok) throw new Error(`Viewer stats returned ${res.status}`);
      const data = await res.json();
      return data.viewers || [];
    },
    staleTime: 60000,
  });
};

export const useViewerCountries = (minutes = 30) => {
  return useQuery({
    queryKey: ['viewer-countries-bq', minutes],
    queryFn: async (): Promise<{ countries: ViewerCountry[]; isps: ViewerIsp[] }> => {
      const res = await fetch(`/api/live-tv-stats?action=countries&minutes=${minutes}`);
      if (!res.ok) throw new Error(`Viewer countries returned ${res.status}`);
      const data = await res.json();
      const countries: ViewerCountry[] = (data.countries || []).map(
        (c: { country?: string; code?: string; viewers: number }) => ({
          code: c.code || c.country || '',
          name: c.country || '',
          viewers: c.viewers,
        })
      );
      return { countries, isps: data.isps || [] };
    },
    staleTime: 60000,
  });
};

export const useViewerPeak = (minutes: number | null = null) => {
  return useQuery({
    queryKey: ['viewer-peak-bq', minutes],
    queryFn: async (): Promise<ViewerPeak> => {
      const res = await fetch(
        `/api/live-tv-stats?action=peak_bq${minutes ? `&minutes=${minutes}` : ''}`
      );
      if (!res.ok) throw new Error(`Viewer peak returned ${res.status}`);
      return await res.json();
    },
    staleTime: 60000,
  });
};

// Aggregate per-minute viewer stats into a single series (sum across streams)
export const aggregateViewerSeries = (stats: ViewerStat[]): { name: string; viewers: number }[] => {
  const byMinute = new Map<string, number>();
  stats.forEach((s) => {
    const key = normalizeMinute(s.minute);
    byMinute.set(key, (byMinute.get(key) || 0) + s.viewers);
  });
  return Array.from(byMinute.entries())
    .map(([minute, viewers]) => ({
      name: new Date(minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      viewers,
    }))
    .reverse();
};

export const streamBreakdown = (stats: ViewerStat[]): StreamCount[] => {
  const byStream = new Map<string, number>();
  stats.forEach((s) => {
    const label = s.stream || 'Unknown';
    byStream.set(label, (byStream.get(label) || 0) + s.viewers);
  });
  return Array.from(byStream.entries())
    .map(([name, viewers]) => ({ name, viewers }))
    .sort((a, b) => b.viewers - a.viewers);
};