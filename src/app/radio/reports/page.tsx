'use client';

import React, { useState, useCallback } from 'react';
import {
  Radio,
  Loader,
  RefreshCw,
  Music,
  Users,
  TrendingUp,
  TrendingDown,
  Headphones,
  BarChart3,
  Clock,
  Activity,
  Wifi,
  RadioTower,
  Globe,
  Smartphone,
  Monitor,
  Timer,
  X,
} from 'lucide-react';
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line, Area,
  XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useRadioReports } from '@/lib/hooks/useRadioReports';
import DateRangePicker from '@/app/components/DateRangePicker';
import SimpleLineChart from '@/app/components/SimpleLineChart';
import { Button } from '@/components/ui/button';
import SimpleBarChart from '@/app/components/SimpleBarChart';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatNumber = (n: number | null | undefined) => {
  if (n == null) return '-';
  return n.toLocaleString();
};

const nowPlayingEmpty = {
  snapshot_at: '',
  listeners_total: 0,
  listeners_unique: 0,
  listeners_current: 0,
  hls_listeners: 0,
  mount_current: 0,
  song_title: '',
  song_artist: '',
  song_text: '',
  streamer_name: '',
  is_live: false,
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'songs', label: 'Songs', icon: Music },
  { id: 'shows', label: 'Shows', icon: Radio },
  { id: 'listeners', label: 'Listeners', icon: Users },
] as const;

type TabId = typeof TABS[number]['id'];

function ShowSnapshots({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [timelineShow, setTimelineShow] = useState<any>(null);
  const [listenerPage, setListenerPage] = useState(1);
  const [showTotalChart, setShowTotalChart] = useState(false);
  const [showsPage, setShowsPage] = useState(1);
  const showsPageSize = 10;
  const [timelineLoading, setTimelineLoading] = useState(false);

  const { data: listenerData, isLoading: listenersLoading } = useQuery({
    queryKey: ['radio-show-listeners', startDate, endDate, timelineShow?.programName, listenerPage],
    queryFn: async () => {
      if (!timelineShow?.programName) return null;
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (timelineShow.programName) params.set('showName', timelineShow.programName);
      params.set('page', String(listenerPage));
      params.set('pageSize', '25');
      const res = await fetch(`/api/radio-show-listeners?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!timelineShow?.programName,
    staleTime: 30000,
  });

  React.useEffect(() => {
    if (timelineShow?.programName) setListenerPage(1);
  }, [timelineShow?.programName]);

  const { data, isLoading } = useQuery({
    queryKey: ['radio-show-snapshots', startDate, endDate, showsPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', String(showsPageSize));
      params.set('offset', String((showsPage - 1) * showsPageSize));
      const res = await fetch(`/api/radio-show-snapshots?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 15000,
  });

  // Lazy-load a single show's full timeline when its row is clicked.
  const openTimeline = async (show: any) => {
    if (show.timeline?.length <= 1) return;
    setTimelineLoading(true);
    setTimelineShow({ ...show, timeline: [] });
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('showName', show.programName);
      const res = await fetch(`/api/radio-show-snapshots?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const match = (json.shows || []).find((s: any) => s.programName === show.programName);
      setTimelineShow(match || show);
    } catch (e) {
      setTimelineShow(show);
    } finally {
      setTimelineLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size={32} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (!data?.shows?.length) {
    return (
      <div className="frosted-glass p-8 text-center border border-blue-500/30 rounded-lg">
        <Radio size={32} className="mx-auto text-white/20 mb-3" />
        <p className="text-white/50">No show data for this period</p>
        <p className="text-white/30 text-xs mt-1">Listener snapshots every 5 minutes are matched to EPG shows</p>
      </div>
    );
  }

  const overallPeak = data.shows.reduce((s: number, sh: any) => s + (sh.peakListeners || 0), 0);
  const overallAvg = data.shows.reduce((s: number, sh: any) => s + (sh.avgListeners || 0), 0);

  return (
    <div className="space-y-4 flex flex-col h-full min-h-[280px]">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio size={18} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Show Listener Snapshot</h2>
          <span className="text-xs text-white/40">{data.shows.length} shows &middot; based on nowplaying data</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 shrink-0">
        <div className="frosted-glass p-4 border border-blue-500/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-white">{data.shows.length}</p>
          <p className="text-xs text-white/50">Shows</p>
        </div>
        <div className="frosted-glass p-4 border border-green-500/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-white">{overallAvg}</p>
          <p className="text-xs text-white/50">Avg Listeners</p>
        </div>
        <div
          className="frosted-glass p-4 border border-purple-500/30 rounded-lg text-center cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setShowTotalChart(true)}
        >
          <p className="text-2xl font-bold text-white">{overallPeak}</p>
          <p className="text-xs text-white/50">Total Listeners</p>
        </div>
        <div className="frosted-glass p-4 border border-cyan-500/30 rounded-lg text-center">
          <p className="text-2xl font-bold text-white">{data.totalPrograms || '-'}</p>
          <p className="text-xs text-white/50">EPG Programs</p>
        </div>
      </div>

      <div className="frosted-glass p-5 border border-blue-500/30 rounded-lg overflow-x-auto flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-white/10">
              <th className="text-left pb-3 pr-3 text-xs font-medium text-white/50">Show</th>
              <th className="text-left pb-3 pr-3 text-xs font-medium text-white/50 hidden sm:table-cell">Time (UTC)</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50">Total Listeners</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50">Avg</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50">Peak</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50">Unique</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50 hidden sm:table-cell">HLS</th>
              <th className="text-center pb-3 pr-3 text-xs font-medium text-white/50 hidden sm:table-cell">Local</th>
              <th className="text-center pb-3 text-xs font-medium text-white/50">Avg (s)</th>
            </tr>
          </thead>
          <tbody>
            {data.shows.map((show: any, i: number) => (
              <tr
                key={i}
                className={`border-b border-white/5 transition-colors ${show.timeline?.length > 1 || show.airings > 1 ? 'cursor-pointer hover:bg-white/5' : ''}`}
                onClick={() => { if (show.airings > 1 || show.timeline?.length > 1) openTimeline(show); }}
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    {show.thumbnail && (
                      <img src={show.thumbnail} alt="" className="w-8 h-8 rounded object-cover bg-white/5" />
                    )}
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-[160px]">{show.programName}</p>
                      {show.presenter && <p className="text-white/40 text-xs">{show.presenter}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-left text-white/50 text-xs whitespace-nowrap hidden sm:table-cell">
                  {show.startTime}-{show.endTime}
                </td>
                <td className="py-2.5 pr-3 text-center text-white font-medium">{show.totalListeners?.toLocaleString() || '-'}</td>
                <td className="py-2.5 pr-3 text-center text-white font-medium">{show.avgListeners || '-'}</td>
                <td className="py-2.5 pr-3 text-center text-white font-medium">{show.peakListeners || '-'}</td>
                <td className="py-2.5 pr-3 text-center text-white/80">{show.uniqueListeners || '-'}</td>
                <td className="py-2.5 pr-3 text-center text-green-400 text-xs hidden sm:table-cell">{show.hlsListeners || '-'}</td>
                <td className="py-2.5 pr-3 text-center text-blue-400 text-xs hidden sm:table-cell">{show.localListeners || '-'}</td>
                <td className="py-2.5 text-center text-white/50 text-xs">{show.avgConnectedSeconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.totalShows || 0) > showsPageSize && (
        <div className="flex items-center justify-between shrink-0">
          <span className="text-xs text-white/40">
            Page {showsPage} of {Math.ceil((data?.totalShows || 0) / showsPageSize)} ({data?.totalShows} shows)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={showsPage <= 1}
              onClick={() => setShowsPage(p => Math.max(1, p - 1))}
              className="text-white border-white/10 hover:bg-white/10 h-8 px-3"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={showsPage >= Math.ceil((data?.totalShows || 0) / showsPageSize)}
              onClick={() => setShowsPage(p => p + 1)}
              className="text-white border-white/10 hover:bg-white/10 h-8 px-3"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {timelineShow && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="frosted-glass border border-white/20 p-6 rounded-lg w-full max-w-2xl relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => setTimelineShow(null)} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              {timelineShow.thumbnail && (
                <img src={timelineShow.thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-white/5" />
              )}
              <div>
                <h2 className="text-xl font-bold text-white">{timelineShow.programName}</h2>
                <p className="text-white/50 text-xs">
                  {timelineLoading
                    ? 'Loading timeline...'
                    : `Peak: ${timelineShow.peakListeners} listeners &middot; ${timelineShow.timeline?.length || 0} data points`}
                </p>
              </div>
            </div>
            {timelineLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader size={28} className="animate-spin text-blue-400" />
              </div>
            ) : timelineShow.timeline?.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timelineShow.timeline.map((p: any) => ({
                      name: new Date(p.t).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: false }),
                      value: p.v,
                    }))}
                    margin={{ top: 8, right: 16, left: -10, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} interval={3} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#3b82f6', fontSize: '12px' }}
                      formatter={(value: any) => [`${value}`, 'Total Listeners']}
                    />
                    <Area type="monotone" dataKey="value" fill="#3b82f6" fillOpacity={0.15} />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-white/40 text-sm">Not enough data points yet. Snapshots are taken every 60 seconds.</p>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{timelineShow.peakListeners}</p>
                <p className="text-xs text-white/50">Peak</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{timelineShow.uniqueListeners}</p>
                <p className="text-xs text-white/50">Unique</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{timelineShow.avgListeners || '-'}</p>
                <p className="text-xs text-white/50">Avg</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Listeners</h3>
                {listenerData && (
                  <span className="text-xs text-white/40">{listenerData.total} total</span>
                )}
              </div>
              {listenersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader size={20} className="animate-spin text-blue-400" />
                </div>
              ) : listenerData?.listeners?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left pb-2 pr-2 font-medium text-white/40">IP</th>
                        <th className="text-left pb-2 pr-2 font-medium text-white/40">Time</th>
                        <th className="text-left pb-2 pr-2 font-medium text-white/40 hidden sm:table-cell">User Agent</th>
                        <th className="text-left pb-2 pr-2 font-medium text-white/40 hidden sm:table-cell">Stream</th>
                        <th className="text-left pb-2 font-medium text-white/40">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listenerData.listeners.map((l: any, i: number) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 pr-2 text-white/70 font-mono">{l.ip || '-'}</td>
                          <td className="py-1.5 pr-2 text-white/50 whitespace-nowrap">
                            {l.time ? new Date(l.time).toLocaleString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                          </td>
                          <td className="py-1.5 pr-2 text-white/50 truncate max-w-[140px] hidden sm:table-cell">{l.user_agent || '-'}</td>
                          <td className="py-1.5 pr-2 hidden sm:table-cell">
                            <span className={`text-xs ${l.stream?.startsWith('HLS') ? 'text-green-400' : 'text-blue-400'}`}>
                              {l.stream || '-'}
                            </span>
                          </td>
                          <td className="py-1.5 text-white/50">{l.location || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {listenerData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-white/40">
                        Page {listenerData.page} of {listenerData.totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setListenerPage(p => Math.max(1, p - 1))}
                          disabled={listenerData.page <= 1}
                          className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setListenerPage(p => p + 1)}
                          disabled={listenerData.page >= listenerData.totalPages}
                          className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-white/30 text-xs italic py-4 text-center">No listener details available for this show</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showTotalChart && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto">
          <div className="frosted-glass border border-white/20 p-6 rounded-lg w-full max-w-5xl relative">
            <button onClick={() => setShowTotalChart(false)} className="absolute top-4 right-4 text-white/50 hover:text-white">
              <X size={20} />
            </button>
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={18} className="text-purple-400" />
              <h2 className="text-xl font-bold text-white">Total Listeners by Show {startDate === endDate ? `(${new Date(startDate).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })})` : `(${new Date(startDate).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' })})`}</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.shows.filter((s: any) => s.peakListeners > 0).map((s: any) => ({
                      name: s.programName,
                      value: s.peakListeners,
                    }))}
                    margin={{ top: 8, right: 16, left: -10, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      height={100}
                      interval={0}
                    />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#a855f7', fontSize: '12px' }}
                      formatter={(value: any) => [`${value}`, 'Peak']}
                    />
                    <Bar dataKey="value" fill="#a855f7" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.shows.filter((s: any) => s.peakListeners > 0).map((s: any) => ({
                      name: s.programName,
                      peak: s.peakListeners,
                      avg: s.avgListeners,
                    }))}
                    margin={{ top: 8, right: 16, left: -10, bottom: 100 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      height={100}
                      interval={0}
                    />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="peak" fill="#a855f7" fillOpacity={0.1} />
                    <Line type="monotone" dataKey="peak" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} name="Peak" />
                    <Area type="monotone" dataKey="avg" fill="#22c55e" fillOpacity={0.1} />
                    <Line type="monotone" dataKey="avg" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} name="Average" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.shows.filter((s: any) => s.peakListeners > 0).map((s: any) => ({
                      name: s.programName,
                      value: s.peakListeners,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={true}
                  >
                    {['#3b82f6','#22c55e','#a855f7','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'].map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [`${value}`, 'Peak']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function last30Days() {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  return { startDate: start, endDate: end };
}

export default function RadioReportsPage() {
  const [dateRange, setDateRange] = useState(last30Days());
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { data, isLoading, error, isFetching } = useRadioReports({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryDetails, setCountryDetails] = useState<any>(null);
  const [loadingCountry, setLoadingCountry] = useState(false);

  const handleCountryClick = useCallback(async (countryCode: string) => {
    setSelectedCountry(countryCode);
    setLoadingCountry(true);
    setCountryDetails(null);
    try {
      const res = await fetch(`/api/radio-country?country=${encodeURIComponent(countryCode)}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setCountryDetails(json);
    } catch (e) {
      setCountryDetails({ error: 'Failed to load details' });
    } finally {
      setLoadingCountry(false);
    }
  }, []);

  const current = data?.current || nowPlayingEmpty;
  const displaySong = current.song_title || current.song_text || 'Live Broadcast';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader size={48} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-white/70">Loading radio reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4 p-8">
          <p className="text-red-400 font-semibold">Failed to load radio reports</p>
          <p className="text-white/60 text-sm">{error instanceof Error ? error.message : 'Unknown error'}</p>
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

  const dailyChartData = (data?.daily || []).map((d: any) => ({
    name: new Date(d.date + 'T00:00:00').toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' }),
    avg: Number(d.avg_listeners) || 0,
    unique: Number(d.unique_listeners) || 0,
  }));

  const programMap = Object.fromEntries((data?.hourlyPrograms || []).map((p: any) => [p.hour, p.programName]));
  const todayHours = (data?.hourlyToday || []).map((d: any) => d.hour);
  const compareHours = (data?.hourlyCompare || []).map((d: any) => d.hour);
  const allHours = [...new Set([...compareHours, ...todayHours])].sort((a: number, b: number) => a - b);
  let lastProgram = '';
  const hourlyChartData = allHours.map((hour: number) => {
    const prog = programMap[hour] || `${String(hour).padStart(2, '0')}:00`;
    const label = prog === lastProgram ? '' : prog;
    lastProgram = prog;
    return {
      name: label,
      today: (data?.hourlyToday || []).find((d: any) => d.hour === hour)?.peak_listeners || 0,
      yesterday: (data?.hourlyCompare || []).find((d: any) => d.hour === hour)?.peak_listeners || 0,
    };
  });

  const dowChartData = (data?.dayOfWeek || []).slice(-7).map((d: any) => ({
    name: new Date(d.date + 'T00:00:00').toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric' }),
    value: Number(d.listeners) || 0,
  }));

  return (
    <div className="space-y-6 p-6 h-screen flex flex-col overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-white">Radio Reports</h1>
            <Link
              href="/radio"
              className="text-xs bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2.5 py-1 rounded-md border border-white/10 transition-colors"
            >
              Station Management
            </Link>
          </div>
          <p className="text-white/60 flex items-center gap-2">
            <Activity size={16} />
            Listener analytics and song history from BigQuery
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

      {/* Tab Navigation */}
      <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
      {activeTab === 'overview' && (
      <div className="frosted-glass p-6 border border-purple-500/30 rounded-lg">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Radio size={28} className="text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Now Playing</p>
            <h2 className="text-xl font-bold text-white truncate">{displaySong}</h2>
            {current.song_artist && (
              <p className="text-white/60 text-sm truncate">{current.song_artist}</p>
            )}
          </div>
          {data?.currentShow && (
            <>
              <div className="w-px h-12 bg-white/10 shrink-0" />
              {data.currentShow.image && (
                <img src={data.currentShow.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-white/5" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Current Show</p>
                <p className="text-white font-semibold truncate">{data.currentShow.programName}</p>
                {data.currentShow.presenter && (
                  <p className="text-white/60 text-sm truncate">{data.currentShow.presenter}</p>
                )}
              </div>
            </>
          )}
          <div className="w-px h-12 bg-white/10 shrink-0" />
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatNumber(current.mount_current != null ? current.mount_current : current.listeners_current)}</p>
              <p className="text-xs text-white/50 flex items-center gap-1 justify-center">
                <RadioTower size={10} className="text-blue-400" />
                Local
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatNumber(current.hls_listeners)}</p>
              <p className="text-xs text-white/50 flex items-center gap-1 justify-center">
                <Wifi size={10} className="text-green-400" />
                HLS
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatNumber(current.listeners_total)}</p>
              <p className="text-xs text-white/50">Total</p>
            </div>
          </div>
        </div>
        {(current.mount_current != null || current.hls_listeners > 0) && current.listeners_total > 0 && (
          <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
            <div
              className="bg-blue-500 rounded-l-full transition-all"
              style={{ width: `${((current.mount_current || 0) / current.listeners_total) * 100}%` }}
            />
            <div
              className="bg-green-500 rounded-r-full transition-all"
              style={{ width: `${((current.hls_listeners || 0) / current.listeners_total) * 100}%` }}
            />
          </div>
        )}
      </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="frosted-glass p-5 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Now</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">Current Listeners</span>
                <span className="text-sm font-bold text-white">{formatNumber(current.listeners_total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">HLS / Local</span>
                <span className="text-sm font-bold text-white">{formatNumber(current.hls_listeners)} / {formatNumber(current.mount_current)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-white/50">Peak Today</span>
                <span className="text-sm font-bold text-white">{data?.hourlyToday?.length ? Math.max(...data.hourlyToday.map((h: any) => h.peak_listeners)) : '-'}</span>
              </div>
              <div className="border-t border-white/10 pt-3 mt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Countries</span>
                  <span className="text-sm font-bold text-white">{data?.byCountry?.length || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Top Browser</span>
                  <span className="text-sm font-bold text-white truncate max-w-[140px]">{data?.byBrowser?.[0]?.browser || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Listener Hours</span>
                  <span className="text-sm font-bold text-white">{data?.byCountry ? Math.round(data.byCountry.reduce((a: any, c: any) => a + (c.connected_seconds || 0), 0) / 3600).toLocaleString() : '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Top Client</span>
                  <span className="text-sm font-bold text-white truncate max-w-[140px]">{data?.byClient?.[0]?.client || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="frosted-glass p-5 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Top Songs</h3>
            </div>
            <div className="space-y-2">
              {(data?.topSongs || []).slice(0, 5).map((song: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-white/30 w-4 text-right">{i + 1}.</span>
                  <Music size={10} className="text-blue-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{song.song_title}</p>
                    {song.song_artist && <p className="text-white/40 truncate">{song.song_artist}</p>}
                  </div>
                  <span className="text-white/50 shrink-0">{song.plays} plays</span>
                </div>
              ))}
              {(!data?.topSongs || data.topSongs.length === 0) && (
                <p className="text-xs text-white/30 italic">No data yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="frosted-glass p-6 border border-blue-500/30 rounded-lg">
            {dailyChartData.length > 0 ? (
              <SimpleLineChart
              data={dailyChartData}
              title="Daily Listeners"
              lines={[
                { dataKey: 'avg', color: '#3b82f6', gradientId: 'dailyListenersGradient', label: 'Avg Listeners' },
                { dataKey: 'unique', color: '#22c55e', gradientId: 'dailyUniqueGradient', label: 'Unique Listeners' },
              ]}
            />
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-white/30 text-sm italic">Collecting data... snapshots are taken every 5 minutes</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === 'charts' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="frosted-glass p-6 border border-green-500/30 rounded-lg">
          {hourlyChartData.length > 0 ? (
            <SimpleLineChart
              data={hourlyChartData}
              title="Peak Listeners by Program"
              lines={[
                { dataKey: 'today', color: '#22c55e', gradientId: 'hourlyTodayGrad', label: 'Today' },
                { dataKey: 'yesterday', color: '#6b7280', gradientId: 'hourlyYestGrad', label: new Date().getDay() === 0 || new Date().getDay() === 6 ? 'Last Week' : 'Yesterday' },
              ]}
            />
          ) : (
            <div className="h-80 flex items-center justify-center">
              <p className="text-white/30 text-sm italic">Collecting data...</p>
            </div>
          )}
        </div>

        <div className="frosted-glass p-6 border border-purple-500/30 rounded-lg">
          {dowChartData.length > 0 ? (
            <SimpleBarChart
              data={dowChartData}
              title={`Daily Breakdown`}
              color="#a855f7"
            />
          ) : (
            <div className="frosted-glass p-6 border border-purple-500/30 rounded-lg h-full flex items-center justify-center">
              <p className="text-white/30 text-sm italic">Collecting data...</p>
            </div>
          )}
        </div>
      </div>

      )}
      {activeTab === 'songs' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="frosted-glass p-6 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-400" />
            <h3 className="text-lg font-semibold text-white">Biggest Listener Gains</h3>
          </div>
          {(data?.best || []).length > 0 ? (
            <div className="space-y-2">
              {data!.best.slice(0, 8).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <span className="text-green-400 font-bold text-sm w-8 text-right">+{item.delta_total}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{item.song_title || 'Untitled'}</p>
                    <p className="text-white/40 text-xs truncate">{item.song_artist || '-'}</p>
                  </div>
                  <span className="text-white/30 text-xs">{item.listeners_start} → {item.listeners_end}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm italic">No data yet</p>
          )}
        </div>

        <div className="frosted-glass p-6 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={18} className="text-red-400" />
            <h3 className="text-lg font-semibold text-white">Biggest Listener Drops</h3>
          </div>
          {(data?.worst || []).length > 0 ? (
            <div className="space-y-2">
              {data!.worst.slice(0, 8).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <span className="text-red-400 font-bold text-sm w-8 text-right">{item.delta_total}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{item.song_title || 'Untitled'}</p>
                    <p className="text-white/40 text-xs truncate">{item.song_artist || '-'}</p>
                  </div>
                  <span className="text-white/30 text-xs">{item.listeners_start} → {item.listeners_end}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm italic">No data yet</p>
          )}
        </div>
      </div>

      )}
      {activeTab === 'shows' && <ShowSnapshots startDate={dateRange.startDate} endDate={dateRange.endDate} />}
      {activeTab === 'listeners' && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} className="text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Listener Insights</h2>
          <p className="text-xs text-white/40">Based on snapshots every 5 minutes</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* By Country */}
          <div className="frosted-glass p-5 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-white">By Country</h3>
            </div>
            {(data?.byCountry || []).length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={(data!.byCountry.slice(0, 8).map((c: any) => ({ name: c.country_code, value: c.listeners })))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      style={{ cursor: 'pointer' }}
                    >
                      {['#3b82f6','#22c55e','#a855f7','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'].map((color, i) => (
                        <Cell
                          key={i}
                          fill={color}
                          onClick={() => handleCountryClick(data!.byCountry[i].country_code)}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                  {data!.byCountry.slice(0, 8).map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ background: ['#3b82f6','#22c55e','#a855f7','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'][i] }} />
                      <span className="text-white/70">{c.country_code}</span>
                      <span className="text-white/40">({c.listeners})</span>
                    </div>
                  ))}
                  {data!.byCountry.length > 8 && (
                    <span className="text-xs text-white/30">+{data!.byCountry.length - 8} more</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-white/30 text-xs italic">Collecting data...</p>
            )}
          </div>

          {/* By Browser */}
          <div className="frosted-glass p-5 border border-cyan-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Monitor size={16} className="text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">By Browser</h3>
            </div>
            {(data?.byBrowser || []).length > 0 ? (
              <div className="space-y-1.5">
                {data!.byBrowser.map((b: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-white/70 w-24 truncate">{b.browser || 'Unknown'}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(b.listeners / data!.byBrowser[0].listeners) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/70 w-6 text-right">{b.listeners}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-xs italic">Collecting data...</p>
            )}
          </div>

          {/* By Client */}
          <div className="frosted-glass p-5 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={16} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white">By Client</h3>
            </div>
            {(data?.byClient || []).length > 0 ? (
              <div className="space-y-1.5">
                {data!.byClient.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-white/70 w-24 truncate">{c.client || c.client_raw || 'Unknown'}</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(c.listeners / data!.byClient[0].listeners) * 100}%` }}
                      />
                    </div>
                    <span className="text-white/70 w-6 text-right">{c.listeners}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-xs italic">Collecting data...</p>
            )}
          </div>

          {/* By Stream */}
          <div className="frosted-glass p-5 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <RadioTower size={16} className="text-green-400" />
              <h3 className="text-sm font-semibold text-white">By Stream</h3>
            </div>
            {(data?.byStream || []).length > 0 ? (
              <div className="space-y-1.5">
                {data!.byStream.map((s: any, i: number) => {
                  const isHls = s.stream_id && s.stream_id.startsWith('hls');
                  const color = isHls ? 'bg-green-500' : 'bg-blue-500';
                  const total = data!.byStream.reduce((a: any, b: any) => a + b.listeners, 0);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-white/70 w-24 truncate">{s.stream || s.stream_id}</span>
                      <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${color} rounded-full`}
                          style={{ width: `${(s.listeners / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-white/70 w-6 text-right">{s.listeners}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/30 text-xs italic">Collecting data...</p>
            )}
          </div>

          {/* By Listening Time */}
          <div className="frosted-glass p-5 border border-orange-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-orange-400" />
              <h3 className="text-sm font-semibold text-white">By Listening Duration</h3>
            </div>
            {(data?.byListeningTime || []).length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data!.byListeningTime.map((t: any) => ({
                      name: t.label.replace(/Thirty Seconds/g, '30s').replace(/One Minute/g, '1m').replace(/Five Minutes/g, '5m').replace(/Ten Minutes/g, '10m').replace(/Thirty Minutes/g, '30m').replace(/One Hour/g, '1h').replace(/Two Hours/g, '2h').replace(/Less than /g, '<').replace(/More than /g, '>').replace(/ to /g, '-'),
                      value: t.value,
                    }))}
                    margin={{ top: 8, right: 8, left: -10, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                      itemStyle={{ color: '#f97316', fontSize: '12px' }}
                    />
                    <Bar dataKey="value" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-white/30 text-xs italic">Collecting data...</p>
            )}
          </div>
        </div>
      </div>
      )}

      {selectedCountry && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="frosted-glass border border-white/20 p-6 rounded-lg w-full max-w-lg relative max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => { setSelectedCountry(null); setCountryDetails(null); }}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <Globe size={22} className="text-blue-400" />
              <h2 className="text-xl font-bold text-white">{selectedCountry}</h2>
            </div>
            {loadingCountry && (
              <div className="flex items-center justify-center py-12">
                <Loader size={24} className="animate-spin text-blue-400" />
              </div>
            )}
            {countryDetails?.error && (
              <p className="text-red-400 text-sm text-center py-8">{countryDetails.error}</p>
            )}
            {countryDetails && !countryDetails.error && (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{countryDetails.total}</p>
                  <p className="text-xs text-white/50">listener snapshots</p>
                  <p className="text-xs text-white/30 mt-1">from 5-minute polls</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">By Stream</h4>
                  <div className="space-y-1.5">
                    {countryDetails.byStream?.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/70 w-12">{s.is_hls ? 'HLS' : 'Local'}</span>
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.is_hls ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${(s.count / countryDetails.total) * 100}%` }} />
                        </div>
                        <span className="text-white/70 w-6 text-right">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">By Browser</h4>
                  <div className="space-y-1.5">
                    {countryDetails.byBrowser?.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/70 w-24 truncate">{b.browser_family}</span>
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500"
                            style={{ width: `${(b.count / countryDetails.total) * 100}%` }} />
                        </div>
                        <span className="text-white/70 w-6 text-right">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">By OS</h4>
                  <div className="space-y-1.5">
                    {countryDetails.byOS?.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/70 w-24 truncate">{o.os_family}</span>
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500"
                            style={{ width: `${(o.count / countryDetails.total) * 100}%` }} />
                        </div>
                        <span className="text-white/70 w-6 text-right">{o.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white/80 mb-2">Listening Duration</h4>
                  <div className="space-y-1.5">
                    {countryDetails.byDuration?.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-white/70 w-12">{d.duration}</span>
                        <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-orange-500"
                            style={{ width: `${(d.count / countryDetails.total) * 100}%` }} />
                        </div>
                        <span className="text-white/70 w-6 text-right">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
