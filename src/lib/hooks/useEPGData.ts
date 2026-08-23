import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Program {
  programName: string;
  tvProgramId?: string;
  genre?: string;
  language?: string;
  details?: string;
  startTime: string;
  endTime: string;
  targetAudience?: string;
  image?: string;
  thumbnail?: string;
  days: string;
}

interface StationData {
  programs: Program[];
  stationImageUrl?: string;
  stationUrl: string;
  isPayPerView: boolean;
  price?: string;
  currency?: string;
  isLive: boolean;
}

interface EPGResponse {
  data: {
    tv: { [key: string]: StationData };
    radio: StationData;
  };
  source?: string;
  cached?: boolean;
  timestamp: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `EPG ${res.status}`);
  return data as T;
}

export const useEPGData = () => {
  return useQuery({
    queryKey: ['epgData'],
    queryFn: async (): Promise<EPGResponse> => {
      return request('/api/epg?admin=1');
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAddProgram = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stationName, program }: { stationName: string; program: any }) => {
      return request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addProgram', stationName, program }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['epgData'] }),
  });
};

export const useUpdateProgram = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stationName,
      programIndex,
      updates,
      programName,
      days,
      startTime,
    }: {
      stationName: string;
      programIndex?: number;
      updates: Partial<Program>;
      programName?: string;
      days?: string;
      startTime?: string;
    }) => {
      return request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateProgram', stationName, programIndex, updates, programName, days, startTime }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['epgData'] }),
  });
};

export const useDeleteProgram = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stationName,
      programIndex,
      programName,
      days,
      startTime,
    }: {
      stationName: string;
      programIndex?: number;
      programName?: string;
      days?: string;
      startTime?: string;
    }) => {
      return request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteProgram', stationName, programIndex, programName, days, startTime }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['epgData'] }),
  });
};

export const useInvalidateCache = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate' }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['epgData'] }),
  });
};
