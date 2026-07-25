'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Eye,
  Users,
  Clock,
  Zap,
  Activity,
  PlayCircle,
  Radio,
  Film,
  Loader,
  RefreshCw,
  Tv,
  X,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import SimpleLineChart from '@/app/components/SimpleLineChart';
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

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState(todayRange());
  const { data, isLoading, error, isFetching } = useAnalytics({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const [activeTab, setActiveTab] = useState<'all' | 'tv' | 'radio' | 'ondemand'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<'station' | 'session' | 'peak' | null>(null);

  const StatCard = ({
    icon: Icon,
    label,
    value,
    subtitle,
    color = 'blue',
    onClick,
  }: {
    icon: React.ComponentType<{ size: number; className: string }>;
    label: string;
    value: string | number;
    subtitle?: string;
    color?: string;
    onClick?: () => void;
  }) => {
    const colorClasses = {
      blue: 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30',
      purple: 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30',
      green: 'bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30',
      cyan: 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30',
      pink: 'bg-gradient-to-br from-pink-500/20 to-pink-500/10 border-pink-500/30',
      orange: 'bg-gradient-to-br from-orange-500/20 to-orange-500/10 border-orange-500/30',
    };

    const iconColorClasses = {
      blue: 'text-blue-400',
      purple: 'text-purple-400',
      green: 'text-green-400',
      cyan: 'text-cyan-400',
      pink: 'text-pink-400',
      orange: 'text-orange-400',
    };
    
    const Component = onClick ? 'button' : 'div';

    return (
      <Component 
        onClick={onClick}
        className={`frosted-glass p-6 border text-left ${colorClasses[color as keyof typeof colorClasses]} hover:border-opacity-60 transition-all ${onClick ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-white/60">{label}</p>
            <p className="text-3xl font-bold text-white mt-2">{value}</p>
            {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
          </div>
          <Icon size={28} className={`${iconColorClasses[color as keyof typeof iconColorClasses]} opacity-60`} />
        </div>
      </Component>
    );
  };

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
    );
  }

  const stationPerformanceData = (data?.stationPerformance || [])
    .map((station: any) => ({ name: station.name, value: station.views }))
    .sort((a: any, b: any) => b.value - a.value);

  const sessionEndReasonsData = (data?.sessionEndReasonsDetailed || [])
    .map((reason: any) => ({ name: reason.reason.replace('_', ' '), value: reason.count }))
    .sort((a: any, b: any) => b.value - a.value);

  const peakViewingHoursData = Array.from({ length: 24 }, (_, i) => {
    const hourData = data?.peakViewingHours.find((h: any) => h.hour === i);
    return { name: `${i}:00`, value: hourData ? hourData.views : 0 };
  });

  return (
    <div className="space-y-6 p-6">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="frosted-glass border border-white/20 p-6 rounded-lg w-full max-w-4xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {modalContent === 'station' && (
                <SimpleLineChart 
                  data={stationPerformanceData}
                  title="Station Performance (by Views)"
                  lines={[{ dataKey: 'value', color: '#3b82f6', gradientId: 'stationGradient', label: 'Views' }]}
                />
              )}
              {modalContent === 'session' && (
                <SimpleLineChart 
                  data={sessionEndReasonsData}
                  title="Session End Reasons"
                  lines={[{ dataKey: 'value', color: '#8b5cf6', gradientId: 'sessionGradient', label: 'Sessions' }]}
                />
              )}
               {modalContent === 'peak' && (
                <SimpleLineChart 
                  data={peakViewingHoursData}
                  title="Peak Viewing Hours (UTC)"
                  lines={[{ dataKey: 'value', color: '#f59e0b', gradientId: 'peakGradient', label: 'Views' }]}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <AnalyticsNav />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">Analytics Overview</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Activity size={16} />
            Real-time performance metrics from your users
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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Eye}
          label="Total Views"
          value={(data?.totalViews || 0).toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Unique Users"
          value={data?.uniqueUsers || 0}
          color="purple"
        />
        <StatCard
          icon={Clock}
          label="Total Watch Time"
          value={formatTime(data?.totalWatchTimeSeconds || 0)}
          color="green"
        />
        <StatCard
          icon={LineChartIcon}
          label="Peak Hours"
          value="View"
          subtitle="Hourly user traffic"
          color="cyan"
          onClick={() => { setModalContent('peak'); setIsModalOpen(true); }}
        />
        <StatCard
          icon={BarChart3}
          label="More Charts"
          value="View"
          subtitle="Station & Session Data"
          color="orange"
          onClick={() => { 
            setModalContent('station'); 
            // In a real app you might show both or have separate triggers
            // For now, let's show station performance.
            setIsModalOpen(true); 
          }}
        />
      </div>

      <div className="frosted-glass p-6 border border-blue-500/30">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tv size={24} className="text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Top Content</h2>
          </div>
          
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
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
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
            .slice(0, 10)
            .map((content: ContentItem, idx: number) => (
              <div key={idx} className="group">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10">
                  <div className="text-sm font-bold text-white/40 w-6">{idx + 1}</div>
                  
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
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Impact</div>
                    <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
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
    </div>
  );
}
