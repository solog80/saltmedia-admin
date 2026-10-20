'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  RefreshCw,
  Upload,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  Building2,
  Tv,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Monitor,
  X,
} from 'lucide-react';
import DateRangePicker from '@/app/components/DateRangePicker';

export interface TvCreativeSummary {
  title: string;
  spot_count: number;
  duration_seconds: number;
  total_seconds: number;
}

export interface TvAdvertiserSummary {
  client: string;
  total_spots: number;
  creative_count?: number;
  total_airtime_seconds: number;
  total_airtime_minutes: number;
  first_aired?: string;
  last_aired?: string;
  creatives: Array<string | TvCreativeSummary>;
}

export interface TvSpot {
  id: number;
  channel_id: number;
  channel_name: string;
  monitor: string;
  client: string;
  title: string;
  artist?: string;
  played_at_local: string;
  played_at: string;
  duration_seconds: number;
  duration_formatted: string;
  category?: string;
  filename: string;
  input_number?: number;
  input_key?: string;
}

export interface TvAffidavitResponse {
  client: string;
  channel: number;
  channel_name: string;
  start_date: string;
  end_date: string;
  total_spots: number;
  total_airtime_seconds: number;
  total_airtime_minutes: number;
  spots: TvSpot[];
}

export const TV_CHANNELS = [
  { value: '0', label: 'All TV Channels' },
  { value: '401', label: 'Salt TV One' },
  { value: '402', label: 'Salt TV Two' },
  { value: '403', label: 'Events / Special' },
];

const formatDurationHuman = (seconds: number) => {
  if (!seconds || seconds <= 0) return '0m 0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatEatTimestamp = (isoOrLocal?: string) => {
  if (!isoOrLocal) return '-';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(isoOrLocal)) {
    return `${isoOrLocal} EAT`;
  }
  try {
    const dt = new Date(isoOrLocal);
    if (isNaN(dt.getTime())) return isoOrLocal;
    return (
      dt.toLocaleString('en-GB', {
        timeZone: 'Africa/Kampala',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }) + ' EAT'
    );
  } catch {
    return isoOrLocal;
  }
};

function getInitialDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function TvTrafficLogsSection({
  defaultChannel = 0,
  compactHeader = false,
}: {
  defaultChannel?: number;
  compactHeader?: boolean;
}) {
  const initialRange = useMemo(() => getInitialDateRange(30), []);
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [channel, setChannel] = useState<string>(String(defaultChannel));
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'advertisers' | 'logs'>('advertisers');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    inserted: number;
    parsed: number;
    failed: number;
    currentFile: string;
  } | null>(null);
  const [exportingClient, setExportingClient] = useState<string | null>(null);
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const channelLabel =
    TV_CHANNELS.find((c) => c.value === channel)?.label || 'All TV Channels';

  const handleRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    setPage(1);
  };

  const {
    data: advertisersData,
    isLoading: advertisersLoading,
    isFetching: advertisersFetching,
    refetch: refetchAdvertisers,
  } = useQuery<TvAdvertiserSummary[]>({
    queryKey: ['tv-traffic-advertisers', startDate, endDate, channel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('channel', channel);
      const res = await fetch(`/api/tv-traffic/advertisers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch TV advertisers');
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 15000,
    refetchInterval: 60000,
  });

  const {
    data: affidavitData,
    isLoading: affidavitLoading,
    isFetching: affidavitFetching,
    refetch: refetchAffidavit,
  } = useQuery<TvAffidavitResponse>({
    queryKey: ['tv-traffic-affidavit', startDate, endDate, channel, selectedClient],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('channel', channel);
      if (selectedClient && selectedClient !== 'ALL') params.set('client', selectedClient);
      const res = await fetch(`/api/tv-traffic/affidavit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch TV affidavit logs');
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 60000,
  });

  const advertisers = useMemo(() => advertisersData || [], [advertisersData]);

  const allSpots = useMemo(() => {
    const rawSpots = affidavitData?.spots || [];
    return [...rawSpots].sort((a, b) =>
      (b.played_at || '').localeCompare(a.played_at || '')
    );
  }, [affidavitData?.spots]);

  const kpiStats = useMemo(() => {
    const totalSpots = advertisers.reduce((acc, a) => acc + (a.total_spots || 0), 0);
    const totalSeconds = advertisers.reduce(
      (acc, a) => acc + (a.total_airtime_seconds || 0),
      0
    );
    const activeClients = advertisers.length;
    const totalCreatives = advertisers.reduce(
      (acc, a) =>
        acc +
        (a.creative_count ?? (Array.isArray(a.creatives) ? a.creatives.length : 0)),
      0
    );
    return { totalSpots, totalSeconds, activeClients, totalCreatives };
  }, [advertisers]);

  const filteredSpots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSpots;
    return allSpots.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.client?.toLowerCase().includes(q) ||
        s.channel_name?.toLowerCase().includes(q) ||
        s.monitor?.toLowerCase().includes(q) ||
        s.filename?.toLowerCase().includes(q)
    );
  }, [allSpots, searchQuery]);

  const filteredAdvertisers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return advertisers;
    return advertisers.filter(
      (a) =>
        a.client?.toLowerCase().includes(q) ||
        a.creatives?.some((c) => {
          const title = typeof c === 'string' ? c : c.title;
          return title?.toLowerCase().includes(q);
        })
    );
  }, [advertisers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredSpots.length / pageSize));
  const paginatedSpots = filteredSpots.slice((page - 1) * pageSize, page * pageSize);

  const handleDownloadCsv = (clientName?: string) => {
    const params = new URLSearchParams({ format: 'csv', channel });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const targetClient = clientName ?? selectedClient;
    if (targetClient && targetClient !== 'ALL') params.set('client', targetClient);
    window.open(`/api/tv-traffic/affidavit?${params.toString()}`, '_blank');
  };

  const handleDownloadPdf = async (clientName?: string) => {
    const targetClient = clientName ?? selectedClient;
    setExportingClient(targetClient);
    try {
      const params = new URLSearchParams({ channel });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (targetClient && targetClient !== 'ALL') params.set('client', targetClient);

      const res = await fetch(`/api/tv-traffic/affidavit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch TV affidavit data for PDF');
      const payload: TvAffidavitResponse = await res.json();
      const spots = [...(payload.spots || [])].sort((a, b) =>
        (a.played_at || '').localeCompare(b.played_at || '')
      );

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const SALT_CRIMSON: [number, number, number] = [139, 10, 8];
      const SALT_DARK_BLUE: [number, number, number] = [24, 58, 122];
      const SALT_LIGHT_BG: [number, number, number] = [248, 250, 252];
      const SALT_BORDER: [number, number, number] = [203, 213, 225];
      const SALT_TEXT_DARK: [number, number, number] = [15, 23, 42];
      const SALT_TEXT_MUTED: [number, number, number] = [210, 224, 245];

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const clientLabel =
        !targetClient || targetClient === 'ALL' ? 'All Advertisers' : targetClient;

      doc.setFillColor(...SALT_DARK_BLUE);
      doc.rect(0, 0, pageWidth, 29, 'F');
      doc.setFillColor(...SALT_CRIMSON);
      doc.rect(0, 27.5, pageWidth, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14.5);
      doc.text('SALT TV — OFFICIAL BROADCAST AFFIDAVIT', 14, 12.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SALT_TEXT_MUTED);
      doc.text('PROOF-OF-PERFORMANCE LOG', 14, 19.5);

      const generatedEat = new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Kampala',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`${channelLabel} • ${startDate} to ${endDate}`, pageWidth - 14, 12.5, {
        align: 'right',
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SALT_TEXT_MUTED);
      doc.text(`Generated: ${generatedEat} EAT`, pageWidth - 14, 19.5, { align: 'right' });

      const totalSeconds = spots.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
      doc.setFillColor(...SALT_LIGHT_BG);
      doc.setDrawColor(...SALT_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 34, pageWidth - 28, 16, 2, 2, 'FD');
      doc.setFillColor(...SALT_CRIMSON);
      doc.rect(14, 34, 2.5, 16, 'F');

      doc.setTextColor(...SALT_TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Advertiser / Client: ${clientLabel}`, 20, 41);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Channel: ${channelLabel}`, 20, 46.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...SALT_CRIMSON);
      doc.text(`Total Verified Spots: ${spots.length}`, pageWidth / 2, 41);
      doc.setTextColor(...SALT_TEXT_DARK);
      doc.setFontSize(9);
      doc.text(
        `Total Airtime: ${formatDurationHuman(totalSeconds)} (${Math.round(
          (totalSeconds / 60) * 10
        ) / 10} mins)`,
        pageWidth / 2,
        46.5
      );

      const rows = spots.map((s, idx) => [
        String(idx + 1),
        s.played_at_local ? `${s.played_at_local} EAT` : formatEatTimestamp(s.played_at),
        s.channel_name || `Channel ${s.channel_id}`,
        s.monitor || 'Program',
        s.client,
        s.title,
        s.duration_formatted || `${s.duration_seconds}s`,
        s.filename || '-',
      ]);

      autoTable(doc, {
        startY: 55,
        head: [
          [
            '#',
            'Date & Time (EAT)',
            'Channel',
            'Monitor',
            'Advertiser',
            'Spot Creative Title',
            'Duration',
            'Video File',
          ],
        ],
        body: rows,
        theme: 'striped',
        headStyles: {
          fillColor: SALT_CRIMSON,
          textColor: 255,
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 7.5, textColor: SALT_TEXT_DARK },
        alternateRowStyles: { fillColor: SALT_LIGHT_BG },
        columnStyles: {
          0: { cellWidth: 9 },
          1: { cellWidth: 36 },
          2: { cellWidth: 26 },
          3: { cellWidth: 20 },
          4: { cellWidth: 30 },
          5: { cellWidth: 52 },
          6: { cellWidth: 16, halign: 'right' },
        },
        margin: { left: 14, right: 14, bottom: 20 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'Salt Media Group — Salt TV | Official Broadcast Proof-of-Performance Affidavit',
          14,
          pageHeight - 6
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6, {
          align: 'right',
        });
      }

      const safeClient = (targetClient || 'all_clients')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      doc.save(`salttv_affidavit_${safeClient}_${startDate}_to_${endDate}.pdf`);
    } catch (err: unknown) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate TV PDF Affidavit',
      });
    } finally {
      setExportingClient(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const csvFiles = Array.from(fileList)
      .filter((f) => {
        const baseName = f.name.split('/').pop() || f.name;
        return !baseName.startsWith('.') && baseName.toLowerCase().endsWith('.csv');
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (csvFiles.length === 0) {
      setStatus({ type: 'error', message: 'No .csv VLog files found in the selection.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const uploadChannel = channel === '0' ? '401' : channel;
    const uploadChannelName =
      TV_CHANNELS.find((c) => c.value === uploadChannel)?.label || '';

    setUploading(true);
    setStatus(null);
    setUploadProgress({
      processed: 0,
      total: csvFiles.length,
      inserted: 0,
      parsed: 0,
      failed: 0,
      currentFile: csvFiles[0].name,
    });

    let processed = 0;
    let parsedTotal = 0;
    let insertedTotal = 0;
    let failed = 0;
    let lastError = '';

    for (const file of csvFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file, file.name);
        const params = new URLSearchParams({ channel: uploadChannel });
        if (uploadChannelName) params.set('channel_name', uploadChannelName);
        const res = await fetch(`/api/tv-traffic/upload?${params.toString()}`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        parsedTotal += Number(data.parsed ?? 0);
        insertedTotal += Number(data.inserted ?? 0);
      } catch (err: unknown) {
        failed += 1;
        lastError = err instanceof Error ? err.message : 'Upload failed';
      } finally {
        processed += 1;
        setUploadProgress({
          processed,
          total: csvFiles.length,
          inserted: insertedTotal,
          parsed: parsedTotal,
          failed,
          currentFile: file.name,
        });
      }
    }

    if (processed === failed) {
      setStatus({ type: 'error', message: `Upload failed: ${lastError}` });
    } else {
      setStatus({
        type: 'success',
        message: `TV sync complete: ${parsedTotal.toLocaleString()} spots parsed • ${insertedTotal.toLocaleString()} new ingested${
          failed ? ` (${failed} file(s) failed)` : ''
        }.`,
      });
    }

    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    refetchAdvertisers();
    refetchAffidavit();
  };

  const handleRefresh = () => {
    refetchAdvertisers();
    refetchAffidavit();
  };

  const isRefreshing = advertisersFetching || affidavitFetching;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="relative z-40 frosted-glass rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              className={
                compactHeader
                  ? 'text-xl sm:text-2xl font-bold text-white'
                  : 'text-2xl sm:text-3xl font-bold text-white'
              }
            >
              TV Traffic &amp; Advertiser Logs
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              vMix Auto-Sync (EAT)
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-white/75">
            Real-time TV commercial playout verification, advertiser spot counts, and
            downloadable Proof-of-Performance affidavits from{' '}
            <code className="text-white bg-white/15 px-1.5 py-0.5 rounded text-xs font-mono">
              vMix
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
          />

          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <Tv size={14} className="text-white/70" />
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                setSelectedClient('ALL');
                setPage(1);
              }}
              className="bg-transparent text-sm font-medium text-white focus:outline-none"
            >
              {TV_CHANNELS.map((c) => (
                <option key={c.value} value={c.value} className="bg-[#1c1917] text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-xs sm:text-sm font-medium transition disabled:opacity-50"
            title="Upload vMix VLog CSV files"
          >
            <Upload size={14} />
            <span>
              {uploading && uploadProgress
                ? `Syncing ${uploadProgress.processed}/${uploadProgress.total}...`
                : 'Upload Logs'}
            </span>
          </button>

          <div className="relative">
            <button
              onClick={() =>
                setOpenExportMenu(openExportMenu === '__HEADER__' ? null : '__HEADER__')
              }
              disabled={exportingClient !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-500/40 text-white text-xs sm:text-sm font-medium transition shadow disabled:opacity-50"
            >
              <Download size={14} />
              <span>{selectedClient === 'ALL' ? 'Export Affidavit' : `Export ${selectedClient}`}</span>
              <ChevronDown
                size={13}
                className={`transition-transform ${
                  openExportMenu === '__HEADER__' ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openExportMenu === '__HEADER__' && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setOpenExportMenu(null)} />
                <div className="absolute right-0 top-full mt-2 z-[100] w-52 bg-[#1c1917]/95 backdrop-blur-xl rounded-xl p-1.5 shadow-2xl border border-white/25">
                  <button
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadPdf(selectedClient);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left"
                  >
                    <FileText size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Export as PDF</div>
                      <div className="text-[10px] text-white/65">Official signed layout</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setOpenExportMenu(null);
                      handleDownloadCsv(selectedClient);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left mt-0.5"
                  >
                    <Download size={14} className="text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Export as CSV</div>
                      <div className="text-[10px] text-white/65">Excel / spreadsheet</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-xs sm:text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {uploading && uploadProgress && (
        <div className="relative z-10 frosted-glass rounded-xl p-4 border border-blue-500/40 bg-blue-950/40 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-white font-semibold">
              <RefreshCw size={15} className="animate-spin text-blue-400" />
              <span>
                Syncing {uploadProgress.processed} of {uploadProgress.total} VLog files
              </span>
              <span className="text-white/65 font-normal font-mono text-xs">
                • {uploadProgress.currentFile}
              </span>
            </div>
            <span className="text-xs text-emerald-300 font-medium">
              {uploadProgress.inserted.toLocaleString()} new spots ingested ({uploadProgress.parsed.toLocaleString()} scanned)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-200"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (uploadProgress.processed / Math.max(1, uploadProgress.total)) * 100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {status && (
        <div
          className={`relative z-10 flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium ${
            status.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/20 border-red-500/40 text-red-200'
          }`}
        >
          <span>{status.message}</span>
          <button onClick={() => setStatus(null)} className="text-white/70 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Total Spots Aired
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : kpiStats.totalSpots.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-300 font-medium mt-1">Verified TV playout</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/25 border border-blue-400/40 text-blue-300">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              TV Airtime
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : formatDurationHuman(kpiStats.totalSeconds)}
            </p>
            <p className="text-xs text-white/70 mt-1">
              {Math.round((kpiStats.totalSeconds / 60) * 10) / 10} total minutes
            </p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/25 border border-purple-400/40 text-purple-300">
            <Clock size={24} />
          </div>
        </div>

        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Active Advertisers
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : kpiStats.activeClients}
            </p>
            <p className="text-xs text-white/70 mt-1">Matched via Traffic Rules</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-300">
            <Building2 size={24} />
          </div>
        </div>

        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Unique Video Creatives
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : kpiStats.totalCreatives}
            </p>
            <p className="text-xs text-white/70 mt-1">Distinct TV spots aired</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300">
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* Filter & view switcher */}
      <div className="relative z-20 frosted-glass rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubTab('advertisers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeSubTab === 'advertisers'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20'
            }`}
          >
            <Building2 size={16} />
            Advertiser Summary ({advertisers.length})
          </button>
          <button
            onClick={() => setActiveSubTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeSubTab === 'logs'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20'
            }`}
          >
            <FileText size={16} />
            Itemized Playout Affidavit ({allSpots.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
            <Filter size={14} className="text-white/70" />
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm font-medium text-white focus:outline-none"
            >
              <option value="ALL" className="bg-[#1c1917] text-white">
                All Advertisers
              </option>
              {advertisers.map((adv) => (
                <option key={adv.client} value={adv.client} className="bg-[#1c1917] text-white">
                  {adv.client} ({adv.total_spots} spots)
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search client, spot, channel, monitor..."
              className="w-full rounded-lg border border-white/20 bg-white/10 pl-8 pr-8 py-1.5 text-white placeholder-white/50 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Advertiser summary */}
      {activeSubTab === 'advertisers' && (
        <div className="relative z-10 frosted-glass rounded-xl">
          <div className="px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/5 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-300" />
              <span className="text-white font-semibold text-base">
                TV Campaign Delivery &amp; Affidavits
              </span>
            </div>
            <span className="text-xs text-white/70">
              Click any advertiser row to expand creative counts or export PDF / CSV
            </span>
          </div>

          <div>
            {advertisersLoading ? (
              <div className="py-12 text-center text-white/70">Loading advertiser summary...</div>
            ) : filteredAdvertisers.length === 0 ? (
              <div className="py-12 text-center text-white/70">
                No TV advertiser spot logs found for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/10 text-xs font-semibold uppercase text-white/80">
                      <th className="py-3.5 px-4">Advertiser / Client</th>
                      <th className="py-3.5 px-4 text-right">Spots Aired</th>
                      <th className="py-3.5 px-4 text-right">Creatives</th>
                      <th className="py-3.5 px-4 text-right">Total Airtime</th>
                      <th className="py-3.5 px-4">First Aired (EAT)</th>
                      <th className="py-3.5 px-4">Last Aired (EAT)</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/15 text-sm">
                    {filteredAdvertisers.map((adv) => {
                      const isExpanded = expandedClient === adv.client;
                      const creativeCount =
                        adv.creative_count ??
                        (Array.isArray(adv.creatives) ? adv.creatives.length : 0);
                      const clientSpots = allSpots.filter(
                        (s) => s.client?.toLowerCase() === adv.client?.toLowerCase()
                      );
                      const enrichedCreatives: TvCreativeSummary[] = (adv.creatives || []).map(
                        (c) => {
                          if (typeof c !== 'string') return c;
                          const matching = clientSpots.filter((s) => s.title === c);
                          const dur = matching[0]?.duration_seconds || 0;
                          const totalSec = matching.reduce(
                            (acc, s) => acc + (s.duration_seconds || 0),
                            0
                          );
                          return {
                            title: c,
                            spot_count: matching.length || 1,
                            duration_seconds: dur,
                            total_seconds: totalSec,
                          };
                        }
                      );

                      return (
                        <React.Fragment key={adv.client}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isExpanded ? 'bg-blue-600/20' : 'hover:bg-white/10'
                            }`}
                            onClick={() => setExpandedClient(isExpanded ? null : adv.client)}
                          >
                            <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-blue-300" />
                              ) : (
                                <ChevronDown size={16} className="text-white/60" />
                              )}
                              <span>{adv.client}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/40">
                                {adv.total_spots}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-white font-medium">
                              {creativeCount}
                            </td>
                            <td className="py-3.5 px-4 text-right text-white font-mono text-xs font-medium">
                              {formatDurationHuman(adv.total_airtime_seconds)}
                            </td>
                            <td className="py-3.5 px-4 text-white/85 text-xs font-mono">
                              {formatEatTimestamp(adv.first_aired)}
                            </td>
                            <td className="py-3.5 px-4 text-white/85 text-xs font-mono">
                              {formatEatTimestamp(adv.last_aired)}
                            </td>
                            <td
                              className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-white/15 hover:bg-white/25 border border-white/20 text-white transition"
                                onClick={() => {
                                  setSelectedClient(adv.client);
                                  setActiveSubTab('logs');
                                  setPage(1);
                                }}
                              >
                                <FileText size={12} className="mr-1" />
                                Logs
                              </button>

                              <div className="relative inline-block text-left">
                                <button
                                  disabled={exportingClient === adv.client}
                                  onClick={() =>
                                    setOpenExportMenu(
                                      openExportMenu === adv.client ? null : adv.client
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition shadow disabled:opacity-50"
                                >
                                  <Download size={12} />
                                  <span>{exportingClient === adv.client ? 'PDF...' : 'Export'}</span>
                                  <ChevronDown size={11} />
                                </button>

                                {openExportMenu === adv.client && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-[90]"
                                      onClick={() => setOpenExportMenu(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1.5 z-[100] w-44 bg-[#1c1917]/95 backdrop-blur-xl rounded-xl p-1.5 shadow-2xl border border-white/25">
                                      <button
                                        onClick={() => {
                                          setOpenExportMenu(null);
                                          handleDownloadPdf(adv.client);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left"
                                      >
                                        <FileText size={13} className="text-blue-400 shrink-0" />
                                        <span>PDF Affidavit</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setOpenExportMenu(null);
                                          handleDownloadCsv(adv.client);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left mt-0.5"
                                      >
                                        <Download size={13} className="text-emerald-400 shrink-0" />
                                        <span>CSV Affidavit</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {isExpanded && enrichedCreatives.length > 0 && (
                            <tr className="bg-black/40">
                              <td colSpan={7} className="p-4">
                                <div className="pl-6 space-y-2.5">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
                                    Video Creatives Breakdown for {adv.client}
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    {enrichedCreatives.map((c, idx) => (
                                      <div
                                        key={`${c.title}-${idx}`}
                                        className="p-3 rounded-lg bg-white/10 border border-white/20 flex items-center justify-between gap-3"
                                      >
                                        <div className="min-w-0">
                                          <p
                                            className="text-xs font-semibold text-white truncate"
                                            title={c.title}
                                          >
                                            {c.title}
                                          </p>
                                          <p className="text-[11px] text-white/75 mt-0.5">
                                            Spot length: {c.duration_seconds}s • Total:{' '}
                                            {formatDurationHuman(c.total_seconds)}
                                          </p>
                                        </div>
                                        <span className="shrink-0 px-2.5 py-1 rounded-md bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-bold">
                                          {c.spot_count}x
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Itemized logs */}
      {activeSubTab === 'logs' && (
        <div className="frosted-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/5">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-300" />
              <span className="text-white font-semibold text-base">
                Itemized TV Broadcast Affidavit Log
                {selectedClient !== 'ALL' ? ` — ${selectedClient}` : ' (All Advertisers)'}
              </span>
              <span className="text-xs text-white/70">({filteredSpots.length} executions)</span>
            </div>

            {selectedClient !== 'ALL' && (
              <button
                onClick={() => setSelectedClient('ALL')}
                className="text-xs font-medium text-blue-300 hover:text-white flex items-center gap-1 bg-blue-500/20 border border-blue-400/30 px-2.5 py-1 rounded-md"
              >
                <X size={13} /> Clear client filter ({selectedClient})
              </button>
            )}
          </div>

          <div>
            {affidavitLoading ? (
              <div className="py-12 text-center text-white/70">
                Loading itemized TV playout logs...
              </div>
            ) : filteredSpots.length === 0 ? (
              <div className="py-12 text-center text-white/70">
                No TV spot executions match your current filter.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/15 bg-white/10 text-xs font-semibold uppercase text-white/80">
                        <th className="py-3.5 px-4">Date &amp; Time (EAT)</th>
                        <th className="py-3.5 px-4">Channel</th>
                        <th className="py-3.5 px-4">Monitor</th>
                        <th className="py-3.5 px-4">Advertiser</th>
                        <th className="py-3.5 px-4">Spot Creative Title</th>
                        <th className="py-3.5 px-4 text-right">Duration</th>
                        <th className="py-3.5 px-4">Video File Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/15 text-sm">
                      {paginatedSpots.map((spot) => (
                        <tr
                          key={spot.id || `${spot.played_at}-${spot.title}`}
                          className="hover:bg-white/10 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-xs font-medium text-emerald-300 whitespace-nowrap">
                            {spot.played_at_local
                              ? `${spot.played_at_local} EAT`
                              : formatEatTimestamp(spot.played_at)}
                          </td>
                          <td className="py-3 px-4 text-xs text-white/90">
                            <span className="inline-flex items-center gap-1.5">
                              <Tv size={13} className="text-purple-300" />
                              {spot.channel_name || `Channel ${spot.channel_id}`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-white/85">
                            <span className="inline-flex items-center gap-1.5">
                              <Monitor size={13} className="text-white/60" />
                              {spot.monitor || 'Program'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => {
                                setSelectedClient(spot.client);
                                setPage(1);
                              }}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-500/25 text-blue-200 border border-blue-400/40 hover:bg-blue-500/40 transition"
                            >
                              {spot.client}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">{spot.title}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-medium text-white">
                            {spot.duration_formatted || `${spot.duration_seconds}s`}
                          </td>
                          <td
                            className="py-3 px-4 text-xs font-mono text-white/75 max-w-xs truncate"
                            title={spot.filename}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <FolderOpen size={13} className="text-amber-300 shrink-0" />
                              {spot.filename}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/15 bg-white/5 text-xs text-white/80">
                    <span>
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, filteredSpots.length)} of {filteredSpots.length}{' '}
                      spots
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white disabled:opacity-40 transition"
                      >
                        Previous
                      </button>
                      <span className="text-white font-medium">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white disabled:opacity-40 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
