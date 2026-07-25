'use client';

import React, { useState } from 'react';
import {
  Users,
  Smartphone,
  Globe,
  TrendingUp,
  LogOut,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Monitor,
  Clock,
  RefreshCw,
  Loader,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import SimpleBarChart from '@/app/components/SimpleBarChart';
import SimpleLineChart from '@/app/components/SimpleLineChart';
import DateRangePicker from '@/app/components/DateRangePicker';

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'blue',
}: {
  icon: React.ComponentType<{ size: number; className: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
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

  return (
    <div
      className={`frosted-glass p-6 border text-left ${colorClasses[color as keyof typeof colorClasses]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-white/60">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
        </div>
        <Icon size={28} className={`${iconColorClasses[color as keyof typeof iconColorClasses]} opacity-60`} />
      </div>
    </div>
  );
};

const MetricsTable = ({
  title,
  data,
  columns,
  icon: Icon,
}: {
  title: string;
  data: any[];
  columns: { key: string; label: string }[];
  icon: React.ComponentType<{ size: number }>;
}) => (
  <div className="frosted-glass border border-white/10 p-6 rounded-lg">
    <div className="flex items-center gap-3 mb-6">
      <Icon size={24} className="text-blue-400" />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map((col) => (
              <th key={col.key} className="text-left py-3 px-4 text-white/60 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, idx) => (
            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-white">
                  {col.key === 'percentage' && typeof row[col.key] === 'number'
                    ? `${row[col.key]}%`
                    : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

function getTodayRange() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  return { startDate: thirtyDaysAgo, endDate: today };
}

export default function FirebaseAnalyticsPage() {
  const [dateRange, setDateRange] = useState(getTodayRange());

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['firebaseAnalytics', dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const response = await fetch(`/api/firebase-analytics?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
    refetchInterval: 60000,
  });

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
        </div>
      </div>
    );
  }

  const deviceChartData = data.devices.breakdown.map((d: any) => ({
    name: d.device,
    value: d.users,
  }));

  const osChartData = data.operatingSystems.breakdown.map((o: any) => ({
    name: o.os,
    value: o.users,
  }));

  const geoChartData = data.geographic.breakdown.map((g: any) => ({
    name: g.country,
    value: g.users,
  }));

  const dauTrendData = data.dauTrend.map((d: any) => {
    // Parse date string (format: YYYY-MM-DD)
    const dateStr = typeof d.date === 'string' ? d.date : d.date?.value;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return {
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.dau,
    };
  });

  return (
    <div className="space-y-6 p-6">
      <AnalyticsNav />

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">User & Device Analytics</h1>
          <p className="text-white/60 flex items-center gap-2">
            <Activity size={16} />
            Comprehensive user behavior and device metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={(startDate, endDate) => setDateRange({ startDate, endDate })}
          />
          {isFetching && (
            <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              Updating...
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          icon={Users}
          label="Daily Active Users"
          value={(data.overview.dau || 0).toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          label="Monthly Active Users"
          value={(data.overview.mau || 0).toLocaleString()}
          color="purple"
        />
        <StatCard
          icon={Activity}
          label="New Users (30d)"
          value={(data.overview.newUsers || 0).toLocaleString()}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Avg Session Duration"
          value={`${Math.round((data.overview.avgSessionDuration || 0) / 60)}m`}
          subtitle="minutes"
          color="cyan"
        />
        <StatCard
          icon={BarChart3}
          label="Total Sessions (30d)"
          value={(data.overview.totalSessions || 0).toLocaleString()}
          color="pink"
        />
        <StatCard
          icon={Users}
          label="Total Unique Users"
          value={(data.overview.uniqueUsers || 0).toLocaleString()}
          color="orange"
        />
      </div>

      {/* Retention Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="frosted-glass border border-green-500/30 p-6 bg-gradient-to-br from-green-500/20 to-green-500/10">
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-green-400" />
            <span className="text-white/60">Day 1 Retention</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.retention.day1}</p>
        </div>
        <div className="frosted-glass border border-blue-500/30 p-6 bg-gradient-to-br from-blue-500/20 to-blue-500/10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={20} className="text-blue-400" />
            <span className="text-white/60">Day 7 Retention</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.retention.day7}</p>
        </div>
        <div className="frosted-glass border border-purple-500/30 p-6 bg-gradient-to-br from-purple-500/20 to-purple-500/10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={20} className="text-purple-400" />
            <span className="text-white/60">Day 30 Retention</span>
          </div>
          <p className="text-3xl font-bold text-white">{data.retention.day30}</p>
        </div>
      </div>

      {/* DAU Trend Chart */}
      <div className="frosted-glass border border-white/10 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp size={24} className="text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Daily Active Users Trend</h3>
        </div>
        <SimpleLineChart
          data={dauTrendData}
          title=""
          lines={[{ dataKey: 'value', color: '#3b82f6', gradientId: 'dauGradient', label: 'DAU' }]}
        />
      </div>

      {/* Device Analytics */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div>
          <div className="frosted-glass border border-white/10 p-6 rounded-lg mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Smartphone size={24} className="text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Device Breakdown</h3>
            </div>
            {deviceChartData.length === 0 || (deviceChartData.length === 1 && deviceChartData[0].name === 'Unknown') ? (
              <div className="py-8 text-center">
                <p className="text-white/50 text-sm">Device data not yet available in Firebase Analytics</p>
                <p className="text-white/30 text-xs mt-2">Ensure Firebase SDK is tracking device info in your app</p>
              </div>
            ) : (
              <SimpleBarChart
                data={deviceChartData}
                title=""
                color="#06b6d4"
              />
            )}
          </div>
        </div>

        <div>
          <div className="frosted-glass border border-white/10 p-6 rounded-lg mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe size={24} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Geographic Distribution</h3>
            </div>
            <SimpleBarChart
              data={geoChartData.slice(0, 8)}
              title=""
              color="#a855f7"
            />
          </div>
        </div>
      </div>

      {/* OS & Browser Analytics */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.operatingSystems.breakdown.length === 0 ? (
          <div className="frosted-glass border border-white/10 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-6">
              <Smartphone size={24} className="text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Operating System Distribution</h3>
            </div>
            <div className="py-8 text-center">
              <p className="text-white/50 text-sm">OS data not yet available in Firebase Analytics</p>
            </div>
          </div>
        ) : (
          <MetricsTable
            title="Operating System Distribution"
            data={data.operatingSystems.breakdown}
            columns={[
              { key: 'os', label: 'OS' },
              { key: 'users', label: 'Users' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'percentage', label: 'Share' },
            ]}
            icon={Smartphone}
          />
        )}

        {data.browsers.breakdown.length === 0 ? (
          <div className="frosted-glass border border-white/10 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-6">
              <Monitor size={24} className="text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Browser Distribution</h3>
            </div>
            <div className="py-8 text-center">
              <p className="text-white/50 text-sm">Browser data not yet available in Firebase Analytics</p>
            </div>
          </div>
        ) : (
          <MetricsTable
            title="Browser Distribution"
            data={data.browsers.breakdown}
            columns={[
              { key: 'browser', label: 'Browser' },
              { key: 'users', label: 'Users' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'percentage', label: 'Share' },
            ]}
            icon={Monitor}
          />
        )}
      </div>

      {/* Content Type Engagement */}
      <MetricsTable
        title="Content Type Engagement"
        data={data.contentTypeEngagement}
        columns={[
          { key: 'type', label: 'Content Type' },
          { key: 'users', label: 'Users' },
          { key: 'sessions', label: 'Sessions' },
          { key: 'avgWatchTime', label: 'Avg Watch Time (s)' },
        ]}
        icon={BarChart3}
      />

      {/* Churn Analysis */}
      <MetricsTable
        title="Session End Reasons (Churn Analysis)"
        data={data.churnReasons}
        columns={[
          { key: 'reason', label: 'Reason' },
          { key: 'count', label: 'Count' },
          { key: 'users', label: 'Users' },
          { key: 'percentage', label: 'Share' },
        ]}
        icon={LogOut}
      />

      {/* Geographic Details */}
      <MetricsTable
        title="Geographic Analysis (Top 15)"
        data={data.geographic.breakdown}
        columns={[
          { key: 'country', label: 'Country' },
          { key: 'users', label: 'Users' },
          { key: 'sessions', label: 'Sessions' },
          { key: 'avgSessionDuration', label: 'Avg Session (s)' },
          { key: 'percentage', label: 'Share' },
        ]}
        icon={Globe}
      />
    </div>
  );
}