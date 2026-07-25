import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpsCallable, getFunctions } from 'firebase/functions';

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

export const useEventsData = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async (): Promise<EventDocument[]> => {
      const functions = getFunctions(undefined, 'europe-west1');
      const getEvents = httpsCallable(functions, 'getEvents');
      const result = (await getEvents()) as { data: { events: EventDocument[] } };
      return result.data.events;
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
      const functions = getFunctions(undefined, 'europe-west1');
      const addEventCallable = httpsCallable(functions, 'addEvent');
      return await addEventCallable(event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
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
      const functions = getFunctions(undefined, 'europe-west1');
      const updateEventCallable = httpsCallable(functions, 'updateEvent');
      return await updateEventCallable(event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const functions = getFunctions(undefined, 'europe-west1');
      const deleteEventCallable = httpsCallable(functions, 'deleteEvent');
      return await deleteEventCallable({ eventId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};
