import { useQuery } from '@tanstack/react-query';

export function usePayments(days = 30) {
  return useQuery({
    queryKey: ['payments', days],
    queryFn: async () => {
      const response = await fetch(`/api/payments?days=${days}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data;
    },
    staleTime: 60000,
    refetchInterval: 30000,
  });
}
