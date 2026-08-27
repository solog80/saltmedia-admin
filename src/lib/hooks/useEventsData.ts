import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebase';

const functions = getFunctions(app, 'europe-west1');

// Best-effort mirror to Firebase (Firestore) while migrating. The mesh
// (Supabase) write is authoritative; Firebase failures are logged, not fatal.
async function mirrorCallable(fnName: string, args: unknown) {
  try {
    await httpsCallable(functions, fnName)(args);
  } catch (error) {
    console.warn(`[firebase-mirror] ${fnName} failed:`, error);
  }
}

export interface EventDocument {
  id: string;
  title: string;
  imageUrl?: string;
  presenter?: string;
  startDate: string;
  endDate: string;
  platform: 'tv' | 'radio' | 'both';
  createdAt?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Events ${res.status}`);
  return data as T;
}

export const useEventsData = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<EventDocument[]> => {
      const res = await request<{ events: EventDocument[] }>('/api/events');
      return res.events;
    },
    staleTime: 6 * 60 * 60 * 1000,
  });
};

export const useAddEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: {
      title: string;
      imageUrl?: string;
      presenter?: string;
      startDate: string;
      endDate: string;
      platform: string;
    }) => {
      const id = crypto.randomUUID();
      const result = await request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', id, ...event }),
      });
      void mirrorCallable('addEvent', { id, ...event });
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useUpdateEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: {
      eventId: string;
      title?: string;
      imageUrl?: string;
      presenter?: string;
      startDate?: string;
      endDate?: string;
      platform?: string;
    }) => {
      const result = await request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...event }),
      });
      void mirrorCallable('updateEvent', event);
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const result = await request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', eventId }),
      });
      void mirrorCallable('deleteEvent', { eventId });
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};
