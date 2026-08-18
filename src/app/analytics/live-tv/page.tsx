'use client';

import React, { useState } from 'react';
import {
  Tv,
  Users,
  Radio,
  Globe,
  Activity,
  Loader,
  RefreshCw,
  TrendingUp,
  MonitorPlay,
} from 'lucide-react';
import { AnalyticsNav } from '@/app/components/AnalyticsNav';
import SimpleLineChart from '@/app/components/SimpleLineChart';
import { useEPGData } from '@/lib/hooks/useEPGData';
import {
  useLiveViewers,
  useLivePeak,
  useViewerStats,
  useViewerCountries,
  useViewerPeak,
  aggregateViewerSeries,
  mapViewerStatsToShows,
  aggregateViewerByShow,
  aggregateViewerByShowAndStream,
  showTrendSeries,
  autoBucketMinutes,
} from '@/lib/hooks/useLiveTvStats';

const StatCard = ({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'blue',
  live = false,
}: {
  icon: React.ComponentType<{ size: number; className: string }>;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  live?: boolean;
}) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-gradient-to-br from-blue-500/20 to-blue-500/10 border-blue-500/30',
    purple: 'bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-purple-500/30',
    green: 'bg-gradient-to-br from-green-500/20 to-green-500/10 border-green-500/30',
    cyan: 'bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border-cyan-500/30',
    pink: 'bg-gradient-to-br from-pink-500/20 to-pink-500/10 border-pink-500/30',
    orange: 'bg-gradient-to-br from-orange-500/20 to-orange-500/10 border-orange-500/30',
  };
  const iconColorClasses: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    cyan: 'text-cyan-400',
    pink: 'text-pink-400',
    orange: 'text-orange-400',
  };

  return (
    <div className={`frosted-glass p-6 border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-white/60 flex items-center gap-2">
            {label}
            {live && (
              <span className="flex items-center gap-1 text-[10px] text-red-300 font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
          </p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {subtitle && <p className="text-xs text-white/40 mt-1">{subtitle}</p>}
        </div>
        <Icon size={28} className={`${iconColorClasses[color]} opacity-60`} />
      </div>
    </div>
  );
};

const STREAM_STATION_KEYS = new Set(['stream', 'stream2']);

const BarRow = ({
  label,
  value,
  max,
  color = 'bg-blue-500',
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
}) => (
  <div className="flex items-center gap-3 py-2">
    <span className="text-sm text-white/70 w-40 truncate">{label}</span>
    <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
      <div
        className={`h-full ${color} rounded-full transition-all`}
        style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
      />
    </div>
    <span className="text-sm font-bold text-white w-10 text-right">{value}</span>
  </div>
);

export default function LiveTvStatsPage() {
  const [historyMinutes, setHistoryMinutes] = useState(60);

  const live = useLiveViewers(5);
  const livePeak = useLivePeak(60);
  const history = useViewerStats(historyMinutes);
  const countries = useViewerCountries(historyMinutes);
  const bqPeak = useViewerPeak(60);
  const { data: epgResponse } = useEPGData();

  const isLoading = live.isLoading || livePeak.isLoading;
  const error = live.error || livePeak.error;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader size={48} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-white/70">Loading live TV stats...</p>
        </div>
      </div>
    );
  }

  const liveData = live.data;
  const peakData = livePeak.data;
  const historySeries = history.data ? aggregateViewerSeries(history.data) : [];
  const maxCountry = Math.max(...(countries.data?.countries || []).map((c) => c.viewers), 1);
  const maxIsp = Math.max(...(countries.data?.isps || []).map((i) => i.viewers), 1);

  const tvEpg = (epgResponse?.data?.tv || {}) as Record<
    string,
    { programs: { programName: string; startTime: string; endTime: string; days: string }[] }
  >;
  const showMapped = history.data ? mapViewerStatsToShows(history.data, tvEpg) : [];
  const bucket = autoBucketMinutes(historyMinutes);
  const showTrend = showTrendSeries(showMapped, bucket);
  const showStreamAggregates = aggregateViewerByShowAndStream(showMapped);
  const maxShowStream = Math.max(
    ...showStreamAggregates.map((s) => s.stream1Viewers + s.stream2Viewers),
    1
  );
  const showAggregates = aggregateViewerByShow(showMapped);
  const maxShow = Math.max(...showAggregates.map((s) => s.totalViewers), 1);

  const streamLabels = liveData
    ? Object.entries(liveData.streams || {})
        .filter(([name]) => STREAM_STATION_KEYS.has(name.replace('app/', '')))
        .map(([name, count]) => ({ name: name || 'Unknown', viewers: count }))
        .sort((a, b) => b.viewers - a.viewers)
    : [];

  return (
    <div className="space-y-6 p-6">
      <AnalyticsNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <Tv size={32} className="text-blue-400" />
            Live TV Stats
          </h1>
          <p className="text-white/60 flex items-center gap-2">
            <Activity size={16} />
            Real-time viewer counts from the OME edge, plus BigQuery history
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(live.isFetching || livePeak.isFetching) && (
            <div className="flex items-center gap-2 text-blue-400 text-sm animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              Updating...
            </div>
          )}
          <select
            value={historyMinutes}
            onChange={(e) => setHistoryMinutes(Number(e.target.value))}
            className="bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
          >
            <option value={15}>Last 15 min</option>
            <option value={30}>Last 30 min</option>
            <option value={60}>Last hour</option>
            <option value={180}>Last 3 hours</option>
            <option value={720}>Last 12 hours</option>
            <option value={1440}>Last 24 hours</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="frosted-glass p-6 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-semibold">Failed to load live stats</p>
          <p className="text-white/60 text-sm mt-1">
            {error instanceof Error ? error.message : 'Live edge stats unavailable'}
          </p>
          <p className="text-white/40 text-xs mt-2">
            Historical BigQuery data below may still be available.
          </p>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Live Viewers"
          value={liveData?.viewers ?? '—'}
          subtitle={`Last ${liveData?.window_minutes || 5} minutes (IPv4: ${liveData?.ipv4 ?? 0}, IPv6: ${liveData?.ipv6 ?? 0})`}
          color="red"
          live
        />
        <StatCard
          icon={TrendingUp}
          label="Peak (60 min)"
          value={peakData?.peak_viewers ?? '—'}
          subtitle={
            peakData?.peak_time
              ? new Date(peakData.peak_time).toLocaleString()
              : 'No samples yet'
          }
          color="orange"
        />
        <StatCard
          icon={MonitorPlay}
          label="Current (BigQuery)"
          value={bqPeak.data?.current_viewers ?? '—'}
          subtitle="Distinct viewers, last 5 min"
          color="cyan"
        />
        <StatCard
          icon={Globe}
          label="Countries"
          value={countries.data?.countries?.length ?? '—'}
          subtitle="Distinct countries in window"
          color="purple"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="frosted-glass p-6 border border-white/10 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MonitorPlay size={18} className="text-blue-400" />
            Live Streams
          </h2>
          {streamLabels.length > 0 ? (
            streamLabels.map((s) => (
              <BarRow
                key={s.name}
                label={s.name.replace('app/', '') === 'stream' ? 'Salt TV One' : s.name.replace('app/', '') === 'stream2' ? 'Salt TV Two' : s.name}
                value={s.viewers}
                max={Math.max(...streamLabels.map((x) => x.viewers), 1)}
                color="bg-red-500"
              />
            ))
          ) : (
            <p className="text-white/40 text-sm">No viewers in the current window.</p>
          )}
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              {liveData?.excluded_datacenters_count || 0} datacenter IPs excluded
            </p>
          </div>
        </div>

        <div className="frosted-glass p-6 border border-white/10 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Globe size={18} className="text-purple-400" />
            Countries
          </h2>
          {countries.data?.countries?.length ? (
            countries.data.countries
              .filter((c) => c.name)
              .slice(0, 8)
              .map((c) => (
                <BarRow
                  key={c.name}
                  label={c.name}
                  value={c.viewers}
                  max={maxCountry}
                  color="bg-purple-500"
                />
              ))
          ) : (
            <p className="text-white/40 text-sm">No country data yet.</p>
          )}
        </div>

        <div className="frosted-glass p-6 border border-white/10 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Radio size={18} className="text-cyan-400" />
            ISPs
          </h2>
          {countries.data?.isps?.length ? (
            countries.data.isps.slice(0, 8).map((i) => (
              <BarRow
                key={`${i.code}-${i.isp}`}
                label={`${i.isp} (${i.code || '—'})`}
                value={i.viewers}
                max={maxIsp}
                color="bg-cyan-500"
              />
            ))
          ) : (
            <p className="text-white/40 text-sm">No ISP data yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="frosted-glass p-6 border border-white/10 rounded-lg lg:col-span-2">
          <SimpleLineChart
            data={showTrend.length ? showTrend : historySeries}
            title={`Viewer Trend by Show (last ${historyMinutes} min · ${bucket}-min avg)`}
            lines={[
              { dataKey: 'viewers', color: '#3b82f6', gradientId: 'viewerTrendGradient', label: 'Avg viewers' },
              { dataKey: 'peak', color: '#f97316', gradientId: 'viewerPeakGradient', label: 'Peak viewers' },
            ]}
          />
          <p className="text-xs text-white/40 mt-2">
            Each point is the {bucket}-minute average, labelled with the EPG show airing on that
            stream at that time{epgResponse?.data ? '' : ' (EPG unavailable)'}.
          </p>
        </div>
        <div className="frosted-glass p-6 border border-white/10 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={18} className="text-orange-400" />
            Programs by Stream
          </h2>
          {showStreamAggregates.length > 0 ? (
            <div className="space-y-4">
              {showStreamAggregates.map((s) => (
                <div key={s.show}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white truncate">{s.show}</span>
                    <span className="text-xs text-white/40 shrink-0 ml-2">
                      {s.startLocal} – {s.endLocal}
                    </span>
                  </div>
                  <div className="flex h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-blue-500 rounded-l-full transition-all"
                      style={{ width: `${(s.stream1Viewers / maxShowStream) * 100}%` }}
                      title={`Salt TV One: ${s.stream1Viewers} avg`}
                    />
                    <div
                      className="h-full bg-cyan-400 transition-all"
                      style={{ width: `${(s.stream2Viewers / maxShowStream) * 100}%` }}
                      title={`Salt TV Two: ${s.stream2Viewers} avg`}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-white/50">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" /> One: {s.stream1Viewers}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" /> Two: {s.stream2Viewers}
                    </span>
                    <span className="ml-auto">{s.totalViewers} avg</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-white/40 pt-2 border-t border-white/10">
                Average viewers per minute per program, split by channel over the window.
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm">No data in this window.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="frosted-glass p-6 border border-white/10 rounded-lg lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MonitorPlay size={18} className="text-blue-400" />
            Viewers per Show (EPG)
          </h2>
          {showAggregates.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {showAggregates.map((s) => (
                <div key={s.show} className="p-4 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white truncate">{s.show}</span>
                    <span className="text-xs text-white/40 shrink-0 ml-2">{s.minutes} min</span>
                  </div>
                  {s.startLocal && (
                    <p className="text-xs text-cyan-300/70 mb-2">
                      {s.startLocal} – {s.endLocal} local
                    </p>
                  )}
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${(s.totalViewers / maxShow) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-white/60">
                    <span>{s.totalViewers} viewer-min</span>
                    <span>{s.avgViewers} avg/min</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-sm">
              No viewer data matched EPG shows in this window. Try a longer range.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}