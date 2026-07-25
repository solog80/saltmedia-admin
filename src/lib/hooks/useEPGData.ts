import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpsCallable, getFunctions } from 'firebase/functions';

interface Program {
  programName: string;
  tvProgramId: string;
  genre: string;
  language: string;
  details: string;
  startTime: string;
  endTime: string;
  targetAudience: string;
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
  source: 'redis-cache' | 'firestore';
  cached: boolean;
  timestamp: string;
}

export const useEPGData = () => {
  return useQuery({
    queryKey: ['epgData'],
    queryFn: async (): Promise<EPGResponse> => {
      const functions = getFunctions(undefined, 'europe-west1');
      const getAdminEPGData = httpsCallable(functions, 'getAdminEPGData');
      const result = (await getAdminEPGData()) as { data: EPGResponse };
      return result.data;
    },
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAddProgram = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stationName, program }: { stationName: string; program: any }) => {
      const functions = getFunctions(undefined, 'europe-west1');
      const addProgramCallable = httpsCallable(functions, 'addEPGProgram');
      return await addProgramCallable({ stationName, program });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epgData'] });
    },
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
      console.log('[useUpdateProgram] Calling updateEPGProgram with:', {
        stationName,
        programIndex,
        programName,
        days,
        startTime,
        updates,
      });
      const functions = getFunctions(undefined, 'europe-west1');
      const updateProgramCallable = httpsCallable(functions, 'updateEPGProgram');
      try {
        const result = await updateProgramCallable({
          stationName,
          programIndex,
          updates,
          programName,
          days,
          startTime,
        });
        console.log('[useUpdateProgram] Success:', result);
        return result;
      } catch (error: any) {
        console.error('[useUpdateProgram] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          fullError: error,
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epgData'] });
    },
    onError: (error: any) => {
      console.error('[useUpdateProgram] Mutation error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        fullError: error,
      });
    },
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
      console.log('[useDeleteProgram] Calling deleteEPGProgram with:', {
        stationName,
        programIndex,
        programName,
        days,
        startTime,
      });
      const functions = getFunctions(undefined, 'europe-west1');
      const deleteProgramCallable = httpsCallable(functions, 'deleteEPGProgram');
      return await deleteProgramCallable({
        stationName,
        programIndex,
        programName,
        days,
        startTime,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epgData'] });
    },
  });
};

export const useInvalidateCache = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log('[useInvalidateCache] Calling invalidateEPGCache...');
      const functions = getFunctions(undefined, 'europe-west1');
      const invalidateCacheCallable = httpsCallable(functions, 'invalidateEPGCache');
      const result = await invalidateCacheCallable({});
      console.log('[useInvalidateCache] Success:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[useInvalidateCache] Cache invalidated, refreshing queries...');
      queryClient.invalidateQueries({ queryKey: ['epgData'] });
    },
    onError: (error: any) => {
      console.error('[useInvalidateCache] Error:', error);
    },
  });
};