import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
      return request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', ...event }),
      });
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
      return request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ...event }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      return request('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', eventId }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });
};
