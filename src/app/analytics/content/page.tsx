'use client';

import React, { useState, useCallback } from 'react';
import { BarChart3, Film, PlayCircle, Radio, Loader, Activity, Eye, Clock, RefreshCw, X } from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import DateRangePicker from '@/app/components/DateRangePicker';
import {
  LineChart, Line, Area, Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts';

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
      return <Activity size={16} className="text-cyan-400" />;
  }
};

const getPlaybackLabel = (contentType: string): string => {
  switch (contentType?.toLowerCase()) {
    case 'radio':
      return 'listened';
    case 'tv':
    case 'ondemand':
    default:
      return 'watched';
  }
};

interface ContentItem {
  contentName: string;
  contentType: string;
  station?: string;
  thumbnailUrl?: string;
  views: number;
  totalWatchTime: number;
}

function todayRange() {
  const d = new Date().toISOString().split('T')[0];
  return { startDate: d, endDate: d };
}

export default function ContentAnalyticsPage() {
  const [dateRange, setDateRange] = useState(todayRange());
  const { data, isLoading, error, isFetching } = useAnalytics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const [timelineShow, setTimelineShow] = useState<any>(null);
  const [timelineData, setTimelineData] = useState<any>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const handleRadioClick = useCallback(async (item: any) => {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.set('startDate', dateRange.startDate);
    if (dateRange.endDate) params.set('endDate', dateRange.endDate);
    setLoadingTimeline(true);
    setTimelineShow(item);
    try {
      const res = await fetch(`/api/radio-show-snapshots?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const show = (json.shows || []).find((s: any) =>
        s.programName === item.contentName || item.contentName.includes(s.programName)
      );
      setTimelineData(show || null);
    } catch {
      setTimelineData(null);
    } finally {
      setLoadingTimeline(false);
    }
  }, [dateRange]);
  const [activeTab, setActiveTab] = useState<'all' | 'tv' | 'radio' | 'ondemand'>('all');

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
          <h1 className="text-4xl font-bold text-white">Content Analytics</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Film size={16} />
            Performance breakdown by content type and title
          </p>
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

      {/* Content Type Breakdown */}
      <div className="frosted-glass p-6 border border-blue-500/30">
        <div className="mb-6 flex items-center gap-3">
          <BarChart3 size={24} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">By Content Type</h2>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {(data?.contentTypeBreakdown || []).map((ct: any, idx: number) => (
            <div
              key={idx}
              className="bg-white/5 rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/50 transition-colors"
            >
              <p className="text-2xl font-bold text-blue-400 mb-2">{ct.views.toLocaleString()}</p>
              <p className="text-xs text-white/60 mb-3 capitalize">{ct.type}</p>
              <div className="space-y-1 text-xs text-white/50">
                <p>{ct.uniqueUsers} users</p>
                <p>{formatTime(ct.totalWatchTime)} {getPlaybackLabel(ct.type)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Content */}
      <div className="frosted-glass p-6 border border-green-500/30">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 size={24} className="text-green-400" />
            <h2 className="text-lg font-semibold text-white">Top Content by Views</h2>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
            {[
              { id: 'all', label: 'All', icon: BarChart3 },
              { id: 'tv', label: 'TV', icon: PlayCircle },
              { id: 'radio', label: 'Radio', icon: Radio },
              { id: 'ondemand', label: 'VOD', icon: Film },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

          <div className="space-y-3">
            {(data?.topContent || [])
              .filter((content: ContentItem) => activeTab === 'all' || content.contentType?.toLowerCase() === activeTab)
              .slice(0, 20)
              .map((content: ContentItem, idx: number) => (
                <div
                  key={idx}
                  className={`group ${content.contentType === 'radio' ? 'cursor-pointer' : ''}`}
                  onClick={() => content.contentType === 'radio' && handleRadioClick(content)}
                >
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                  <div className="text-sm font-bold text-white/40 w-6">{idx + 1}</div>
                  
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                    {content.thumbnailUrl ? (
                      <img 
                        src={content.thumbnailUrl} 
                        alt={content.contentName} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-40">
                        {getContentTypeIcon(content.contentType)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getContentTypeIcon(content.contentType)}
                      <p className="font-medium text-white truncate">{content.contentName}</p>
                      {content.station && content.station !== 'Other' && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 font-medium">
                          {content.station}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-white/50">
                      <span className="flex items-center gap-1"><Eye size={12} /> {content.views.toLocaleString()} views</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(content.totalWatchTime)} {getPlaybackLabel(content.contentType)}</span>
                    </div>
                  </div>
                  
                  {/* Impact bar */}
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Impact</div>
                    <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${Math.min(100, (content.views / (data?.totalViews || 1)) * 500)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {(data?.topContent || []).filter((content: ContentItem) => activeTab === 'all' || content.contentType?.toLowerCase() === activeTab).length === 0 && (
            <div className="py-12 text-center">
              <p className="text-white/40 text-sm italic">No content found for this category</p>
            </div>
          )}
        </div>
      </div>

      {timelineShow && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="frosted-glass border border-white/20 p-6 rounded-lg w-full max-w-2xl relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => { setTimelineShow(null); setTimelineData(null); }} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              {timelineShow.thumbnailUrl && (
                <img src={timelineShow.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover bg-white/5" />
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{timelineShow.contentName}</h2>
                <p className="text-white/50 text-xs">
                  Peak: {timelineShow.peakListeners || timelineShow.views} listeners
                  {loadingTimeline && <span className="ml-2 animate-pulse text-blue-400">Loading...</span>}
                </p>
              </div>
            </div>

            {loadingTimeline ? (
              <div className="flex items-center justify-center h-48">
                <Loader size={24} className="animate-spin text-blue-400" />
              </div>
            ) : timelineData?.timeline?.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timelineData.timeline.map((p: any) => ({
                      name: new Date(p.t).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: false }),
                      value: p.v,
                    }))}
                    margin={{ top: 8, right: 16, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} itemStyle={{ color: '#3b82f6', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="value" fill="#3b82f6" fillOpacity={0.15} />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : timelineData ? (
              <div className="py-12 text-center">
                <p className="text-white/40 text-sm">Not enough data points yet. Snapshots are taken every 60 seconds.</p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-white/40 text-sm">No timeline data available for this show.</p>
              </div>
            )}

            {timelineData && (
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{timelineData.peakListeners || timelineShow.views}</p>
                  <p className="text-xs text-white/50">Peak</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{timelineData.uniqueListeners || '-'}</p>
                  <p className="text-xs text-white/50">Unique</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-white">{timelineData.totalConnections || '-'}</p>
                  <p className="text-xs text-white/50">Connections</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
