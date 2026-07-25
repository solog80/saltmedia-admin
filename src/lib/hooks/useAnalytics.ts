import { useQuery } from '@tanstack/react-query';

interface AnalyticsParams {
  days?: number;
  startDate?: string;
  endDate?: string;
}

export function useAnalytics(params: AnalyticsParams = {}) {
  const { days = 30, startDate = '', endDate = '' } = params;

  const queryParams = new URLSearchParams({ days: String(days) });
  if (startDate) queryParams.set('startDate', startDate);
  if (endDate) queryParams.set('endDate', endDate);

  return useQuery({
    queryKey: ['analytics', days, startDate, endDate],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    staleTime: 60000,
    refetchInterval: 30000,
  });
}
