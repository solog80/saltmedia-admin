'use client';

import React from 'react';
import { Activity, PieChart, LogOut, Loader, RefreshCw, Star } from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import { useAnalytics } from '@/lib/hooks/useAnalytics';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getEndReasonColor = (reason: string) => {
  switch (reason?.toLowerCase()) {
    case 'switched_content':
      return 'bg-blue-500/30 text-blue-200 border-blue-500/50';
    case 'app_closed':
      return 'bg-orange-500/30 text-orange-200 border-orange-500/50';
    case 'normal_end':
      return 'bg-green-500/30 text-green-200 border-green-500/50';
    case 'error':
      return 'bg-red-500/30 text-red-200 border-red-500/50';
    default:
      return 'bg-gray-500/30 text-gray-200 border-gray-500/50';
  }
};

export default function SessionsAnalyticsPage() {
  const { data, isLoading, error, isFetching } = useAnalytics(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader size={48} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-white/70">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 p-6">
        <AnalyticsNav />
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4 p-8">
            <p className="text-red-400 font-semibold">Failed to load analytics</p>
            <p className="text-white/60 text-sm">{error instanceof Error ? error.message : 'No data available'}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AnalyticsNav />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Session Analytics</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Activity size={16} />
            Understanding how viewing sessions end
          </p>
        </div>
        {isFetching && (
          <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
            <RefreshCw size={14} className="animate-spin" />
            Updating...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session End Reasons */}
        <div className="frosted-glass p-6 border border-purple-500/30">
          <div className="mb-6 flex items-center gap-3">
            <PieChart size={24} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Session End Reasons</h2>
          </div>

          <div className="grid gap-4 grid-cols-2">
            {Object.entries(data?.sessionEndReasons || {}).map(
              ([reason, count]: [string, any]) => {
                const total = Object.values(data?.sessionEndReasons || {}).reduce(
                  (a: number, b: any) => a + b,
                  0
                );
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div
                    key={reason}
                    className="bg-white/5 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/50 transition-colors"
                  >
                    <p className="text-2xl font-bold text-purple-400 mb-2">{percentage}%</p>
                    <p className="text-xs text-white/60 mb-3 capitalize">{reason.replace('_', ' ')}</p>
                    <p className="text-xs text-white/40">{count} sessions</p>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Top Engaging Content (Completion Rate) */}
        <div className="frosted-glass p-6 border border-yellow-500/30">
          <div className="mb-6 flex items-center gap-3">
            <Star size={24} className="text-yellow-400" />
            <h2 className="text-lg font-semibold text-white">Engagement Quality (Completion Rate)</h2>
          </div>

          <div className="space-y-4">
            {(data?.topCompletionRates || []).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-12 h-16 bg-white/10 rounded overflow-hidden flex-shrink-0 border border-white/10">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.contentName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 text-center p-1">
                      No Image
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-white truncate max-w-[200px]">{item.contentName}</h4>
                    <span className="text-base font-bold text-yellow-400">{item.completionRate}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400" 
                      style={{ width: `${item.completionRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>{item.station}</span>
                    <span>{item.sessionCount} sessions</span>
                  </div>
                </div>
              </div>
            ))}
            {(data?.topCompletionRates || []).length === 0 && (
              <div className="text-center py-8 text-white/40 text-sm">
                No completion data available yet. Data refreshes as more sessions are recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session End Reasons Breakdown */}
      <div className="frosted-glass p-6 border border-blue-500/30">
        <div className="mb-6 flex items-center gap-3">
          <LogOut size={24} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Detailed End Reason Breakdown</h2>
        </div>

        <div className="space-y-3">
          {(data?.sessionEndReasonsDetailed || [])
            .sort((a: any, b: any) => b.count - a.count)
            .map((reason: any, idx: number) => {
              const total = (data?.sessionEndReasonsDetailed || []).reduce(
                (sum: number, r: any) => sum + r.count,
                0
              );
              const percentage = total > 0 ? ((reason.count / total) * 100).toFixed(1) : "0.0";

              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium border capitalize ${getEndReasonColor(
                          reason.reason
                        )}`}
                      >
                        {reason.reason.replace('_', ' ')}
                      </span>
                      <span className="text-white/70">{reason.count} sessions</span>
                    </div>
                    <span className="font-semibold text-white">{percentage}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        reason.reason === 'switched_content'
                          ? 'bg-blue-500'
                          : reason.reason === 'app_closed'
                            ? 'bg-orange-500'
                            : reason.reason === 'normal_end'
                              ? 'bg-green-500'
                              : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Session Insights */}
      <div className="frosted-glass p-6 border border-green-500/30">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-green-400" />
          Session Behavior Insights
        </h3>
        <div className="space-y-3 text-sm text-white/70">
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <p>
              Most sessions end due to{' '}
              <span className="text-green-400 font-medium">
                {
                  Object.entries(data?.sessionEndReasons || {}).sort(
                    (a: any, b: any) => b[1] - a[1]
                  )[0]?.[0]?.replace('_', ' ') || 'N/A'
                }
              </span>
              , indicating user interaction patterns.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <p>
              App closures account for{' '}
              <span className="text-green-400 font-medium">
                {data?.sessionEndReasons?.app_closed || 0}
              </span>
              {' '}
              sessions, which is typical for mobile viewers.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <p>
              Users are engaged, with an average watch time of{' '}
              <span className="text-green-400 font-medium">
                {formatTime(data?.averageWatchTimeSeconds || 0)}
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
