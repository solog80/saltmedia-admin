'use client';

import React from 'react';
import { Users, TrendingUp, Loader, Activity, ArrowRight, PlayCircle, Radio, Film, Eye, RefreshCw } from 'lucide-react';
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

const getContentTypeIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'tv':
      return <PlayCircle size={16} className="text-blue-400" />;
    case 'radio':
      return <Radio size={16} className="text-purple-400" />;
    case 'ondemand':
      return <Film size={16} className="text-pink-400" />;
    default:
      return <Eye size={16} className="text-cyan-400" />;
  }
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

export default function UsersAnalyticsPage() {
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
          <h1 className="text-4xl font-bold text-white">User Analytics</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Users size={16} />
            Insights into your audience
          </p>
        </div>
        {isFetching && (
          <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
            <RefreshCw size={14} className="animate-spin" />
            Updating...
          </div>
        )}
      </div>

      {/* User Metrics Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="frosted-glass p-6 border border-blue-500/30">
          <p className="text-sm text-white/60 mb-2">Total Views</p>
          <p className="text-4xl font-bold text-blue-400">{(data?.totalViews || 0).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-2">all time</p>
        </div>

        <div className="frosted-glass p-6 border border-purple-500/30">
          <p className="text-sm text-white/60 mb-2">Unique Users</p>
          <p className="text-4xl font-bold text-purple-400">{(data?.uniqueUsers || 0).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-2">active viewers</p>
        </div>

        <div className="frosted-glass p-6 border border-green-500/30">
          <p className="text-sm text-white/60 mb-2">Total Sessions</p>
          <p className="text-4xl font-bold text-green-400">{(data?.totalSessions || 0).toLocaleString()}</p>
          <p className="text-xs text-white/40 mt-2">completed</p>
        </div>
      </div>

      {/* User Engagement Summary */}
      <div className="frosted-glass p-6 border border-cyan-500/30">
        <div className="mb-6 flex items-center gap-3">
          <TrendingUp size={24} className="text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">User Engagement Summary</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white/5 rounded-lg p-4 border border-cyan-500/20">
            <p className="text-sm text-white/60 mb-3">Average Views Per User</p>
            <p className="text-3xl font-bold text-cyan-400">
              {data?.uniqueUsers > 0
                ? ((data?.totalViews || 0) / (data?.uniqueUsers || 1)).toFixed(1)
                : 0}
            </p>
            <p className="text-xs text-white/40 mt-2">content items started</p>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-cyan-500/20">
            <p className="text-sm text-white/60 mb-3">Average Sessions Per User</p>
            <p className="text-3xl font-bold text-cyan-400">
              {data?.uniqueUsers > 0
                ? ((data?.totalSessions || 0) / (data?.uniqueUsers || 1)).toFixed(1)
                : 0}
            </p>
            <p className="text-xs text-white/40 mt-2">sessions per viewer</p>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="frosted-glass p-6 border border-pink-500/30">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-pink-400" />
          Key Insights
        </h3>
        <div className="space-y-3 text-sm text-white/70">
          <div className="flex items-start gap-3">
            <span className="text-pink-400 font-bold">•</span>
            <p>
              You have <span className="text-pink-400 font-medium">{(data?.uniqueUsers || 0).toLocaleString()}</span> unique
              users who have started watching content.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-pink-400 font-bold">•</span>
            <p>
              On average, each user has {' '}
              <span className="text-pink-400 font-medium">
                {data?.uniqueUsers > 0 ? ((data?.totalSessions || 0) / (data?.uniqueUsers || 1)).toFixed(1) : 0}
              </span>
              {' '}
              viewing sessions, showing {'good' } retention.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-pink-400 font-bold">•</span>
            <p>
              Content diversity is strong with piece of content being actively watched.
            </p>
          </div>
        </div>
      </div>

      {/* Recent User Activity */}
      <div className="frosted-glass p-6 border border-pink-500/30">
        <div className="mb-6 flex items-center gap-3">
          <Activity size={24} className="text-pink-400" />
          <h2 className="text-lg font-semibold text-white">Recent User Activity</h2>
          <div className="ml-auto flex items-center gap-1 text-xs text-pink-400">
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
            Live
          </div>
        </div>
        <div className="space-y-2">
          {(data?.recentActivity || []).slice(0, 10).map((activity: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getContentTypeIcon(activity.contentType)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{activity.contentName}</p>
                    <p className="text-xs text-white/40">{activity.userId}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatTime(activity.watchTime)}</p>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full border ${getEndReasonColor(activity.endReason)} mt-1 capitalize`}>
                    {activity.endReason?.replace('_', ' ') || 'active'}
                  </span>
                </div>
                <ArrowRight size={16} className="text-white/20 group-hover:text-white/40 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
