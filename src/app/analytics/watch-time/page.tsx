'use client';

import React, { useState } from 'react';
import { Clock, TrendingUp, Loader, Activity, PlayCircle, Radio, Eye, RefreshCw } from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import DateRangePicker from '@/app/components/DateRangePicker';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface WatchTimeDistribution {
  category: string;
  range: string;
  count: number;
}

function todayRange() {
  const d = new Date().toISOString().split('T')[0];
  return { startDate: d, endDate: d };
}

export default function WatchTimeAnalyticsPage() {
  const [dateRange, setDateRange] = useState(todayRange());
  const { data, isLoading, error, isFetching } = useAnalytics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const [activeTab, setActiveTab] = useState<'watch' | 'listen'>('watch');

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

  const isWatch = activeTab === 'watch';
  const totalTime = isWatch ? data.totalWatchTimeSeconds : data.totalListeningTimeSeconds;
  const avgTime = isWatch ? data.averageWatchTimeSeconds : data.averageListeningTimeSeconds;
  const filteredDistribution = (data.watchTimeDistribution || []).filter(
    (d: WatchTimeDistribution) => d.category === activeTab
  );

  return (
    <div className="space-y-6 p-6">
      <AnalyticsNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">
            {isWatch ? 'Watch Time' : 'Listening Time'} Analytics
          </h1>
          <p className="text-white/60 flex items-center gap-2">
            <Clock size={16} />
            {isWatch ? 'Video engagement metrics (TV & VOD)' : 'Audio engagement metrics (Radio)'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('watch')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isWatch
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <PlayCircle size={16} />
            Watch Time
          </button>
          <button
            onClick={() => setActiveTab('listen')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !isWatch
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio size={16} />
            Listening Time
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isFetching && (
            <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              Updating...
            </div>
          )}
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={(s, e) => setDateRange({ startDate: s, endDate: e })}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`frosted-glass p-6 border ${isWatch ? 'border-green-500/30' : 'border-purple-500/30'}`}>
          <p className="text-sm text-white/60 mb-2">Total {isWatch ? 'Watch' : 'Listening'} Time</p>
          <p className={`text-4xl font-bold ${isWatch ? 'text-green-400' : 'text-purple-400'}`}>{formatTime(totalTime || 0)}</p>
          <p className="text-xs text-white/40 mt-2">Cumulative across all users</p>
        </div>

        <div className={`frosted-glass p-6 border ${isWatch ? 'border-cyan-500/30' : 'border-pink-500/30'}`}>
          <p className="text-sm text-white/60 mb-2">Average Session</p>
          <p className={`text-4xl font-bold ${isWatch ? 'text-cyan-400' : 'text-pink-400'}`}>{formatTime(avgTime || 0)}</p>
          <p className="text-xs text-white/40 mt-2">per active session</p>
        </div>

        <div className="frosted-glass p-6 border border-blue-500/30">
          <p className="text-sm text-white/60 mb-2">Accuracy Level</p>
          <div className="flex items-center gap-2">
            <p className="text-4xl font-bold text-blue-400">15s</p>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full uppercase font-bold tracking-wider">High</span>
          </div>
          <p className="text-xs text-white/40 mt-2">Heartbeat interval for ground truth</p>
        </div>
      </div>

      {/* Duration Distribution */}
      <div className={`frosted-glass p-6 border ${isWatch ? 'border-blue-500/30' : 'border-purple-500/30'}`}>
        <div className="mb-6 flex items-center gap-3">
          <TrendingUp size={24} className={isWatch ? 'text-blue-400' : 'text-purple-400'} />
          <h2 className="text-lg font-semibold text-white">Session Duration Distribution</h2>
        </div>

        <div className="space-y-4">
          {filteredDistribution.length > 0 ? (
            filteredDistribution.map((dist: WatchTimeDistribution, idx: number) => {
              const maxCount = Math.max(...filteredDistribution.map(d => d.count));
              const barWidth = maxCount > 0 ? (dist.count / maxCount) * 100 : 0;
              const totalInCategory = filteredDistribution.reduce((sum, d) => sum + d.count, 0);
              const percentage = totalInCategory > 0 ? Math.round((dist.count / totalInCategory) * 100) : 0;

              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{dist.range}</span>
                    <span className="text-sm text-white/60">
                      {dist.count} sessions ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden border border-white/5">
                    <div
                      className={`h-full bg-gradient-to-r transition-all duration-1000 ${
                        isWatch ? 'from-blue-600 to-blue-400' : 'from-purple-600 to-purple-400'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/40 italic">
              No data available for this category
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className={`frosted-glass p-6 border ${isWatch ? 'border-orange-500/30' : 'border-purple-500/30'}`}>
        <div className="flex items-start gap-3">
          <Activity size={24} className={`${isWatch ? 'text-orange-400' : 'text-purple-400'} mt-1 flex-shrink-0`} />
          <div>
            <h3 className="font-semibold text-white mb-2">{isWatch ? 'Watch' : 'Listening'} Insights</h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                • Average {isWatch ? 'viewing' : 'listening'} duration is <span className={isWatch ? 'text-orange-400 font-medium' : 'text-purple-400 font-medium'}>{formatTime(avgTime || 0)}</span> per session.
              </p>
              <p>
                • Data is <span className="text-blue-400 font-medium font-mono text-xs underline">CRASH-RESILIENT</span>. Time is calculated from 15-second heartbeat deltas, ensuring accuracy even if the app or device crashes.
              </p>
              <p>
                • {isWatch ? 'Video content (TV/VOD)' : 'Audio content (Radio)'} is tracked separately to provide a precise breakdown of how users interact with different media formats.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
