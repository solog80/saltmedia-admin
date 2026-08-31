import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app, 'europe-west1');

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

// Best-effort mirror to Firebase (Firestore) while migrating. The mesh
// (Supabase) write is authoritative; Firebase failures are logged, not fatal.
async function mirrorCallable(fnName: string, args: unknown) {
  try {
    await httpsCallable(functions, fnName)(args);
  } catch (error) {
    console.warn(`[firebase-mirror] ${fnName} failed:`, error);
  }
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
export const useEPGSearch = (query: string) => {
  return useQuery({
    queryKey: ['epgSearch', query],
    queryFn: async (): Promise<any> => {
      return request(`/api/epg?search=${encodeURIComponent(query.trim())}`);
    },
    enabled: query.trim().length > 1,
    staleTime: 60 * 1000,
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAddProgram = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stationName, program }: { stationName: string; program: any }) => {
      const result = await request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addProgram', stationName, program }),
      });
      void mirrorCallable('addEPGProgram', { stationName, program });
      return result;
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
      const result = await request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateProgram', stationName, programIndex, updates, programName, days, startTime }),
      });
      void mirrorCallable('updateEPGProgram', { stationName, programIndex, updates, programName, days, startTime });
      return result;
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
      const result = await request('/api/epg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteProgram', stationName, programIndex, programName, days, startTime }),
      });
      void mirrorCallable('deleteEPGProgram', { stationName, programIndex, programName, days, startTime });
      return result;
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
