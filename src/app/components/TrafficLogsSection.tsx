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
  Radio,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  UserCheck,
  Calendar,
  X,
} from 'lucide-react';
import DateRangePicker from '@/app/components/DateRangePicker';
import { useEPGData } from '@/lib/hooks/useEPGData';
import { resolveRadioEPGDetails } from '@/lib/utils/epgMatcher';

export interface CreativeSummary {
  title: string;
  spot_count: number;
  duration_seconds: number;
  total_seconds: number;
}

export interface AdvertiserSummary {
  client: string;
  total_spots: number;
  creative_count?: number;
  unique_creatives?: number;
  total_airtime_seconds: number;
  total_airtime_minutes: number;
  first_aired?: string;
  last_aired?: string;
  first_played_at?: string;
  last_played_at?: string;
  creatives: Array<string | CreativeSummary>;
}

export interface AffidavitSpot {
  id: number;
  client: string;
  title: string;
  artist: string;
  played_at_local: string;
  played_at: string;
  scheduled_at?: string | null;
  duration_seconds: number;
  duration_formatted: string;
  category: string;
  user_dj: string;
  variance_seconds: number;
  filename: string;
  program_name: string;
}

export interface AffidavitResponse {
  client: string;
  start_date: string;
  end_date: string;
  total_spots: number;
  total_airtime_seconds: number;
  total_airtime_minutes: number;
  spots: AffidavitSpot[];
}

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
  // If already formatted as YYYY-MM-DD HH:MM:SS from played_at_local
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

export default function TrafficLogsSection({
  compactHeader = false,
}: {
  compactHeader?: boolean;
}) {
  const initialRange = useMemo(() => getInitialDateRange(30), []);
  const [startDate, setStartDate] = useState<string>(initialRange.start);
  const [endDate, setEndDate] = useState<string>(initialRange.end);
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'advertisers' | 'logs'>('advertisers');
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  // CSV / Folder Upload & PDF Export state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const cancelUploadRef = useRef<boolean>(false);
  const [uploading, setUploading] = useState(false);
  const [openUploadMenu, setOpenUploadMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    spotsInserted: number;
    spotsFound: number;
    failed: number;
    currentFile: string;
  } | null>(null);
  const [exportingPdfClient, setExportingPdfClient] = useState<string | null>(null);
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    setPage(1);
  };

  // Query 1: Advertiser Summary
  const {
    data: advertisersData,
    isLoading: advertisersLoading,
    isFetching: advertisersFetching,
    refetch: refetchAdvertisers,
  } = useQuery<AdvertiserSummary[]>({
    queryKey: ['radio-traffic-advertisers', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/radio-traffic/advertisers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch advertisers');
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 15000,
    refetchInterval: 60000,
  });

  // Query 2: Itemized Affidavit Spot Logs
  const {
    data: affidavitData,
    isLoading: affidavitLoading,
    isFetching: affidavitFetching,
    refetch: refetchAffidavit,
  } = useQuery<AffidavitResponse>({
    queryKey: ['radio-traffic-affidavit', startDate, endDate, selectedClient],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedClient && selectedClient !== 'ALL') {
        params.set('client', selectedClient);
      }
      const res = await fetch(`/api/radio-traffic/affidavit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch affidavit logs');
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 60000,
  });

  // Query 3: Radio EPG Lineup to link spot timestamps to actual radio shows
  const { data: epgResponse } = useEPGData();
  const radioPrograms = useMemo(
    () => (epgResponse?.data?.radio?.programs as any[]) || [],
    [epgResponse]
  );

  const advertisers = advertisersData || [];
  const allSpots = useMemo(() => {
    const rawSpots = affidavitData?.spots || [];
    return rawSpots.map((s) => {
      const epgMatch = resolveRadioEPGDetails(
        s.played_at,
        s.played_at_local,
        radioPrograms,
        s.program_name,
        s.user_dj
      );
      return {
        ...s,
        program_name: epgMatch.programName,
        user_dj: epgMatch.presenter,
      };
    });
  }, [affidavitData?.spots, radioPrograms]);

  // Aggregate KPI metrics
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
        (a.creative_count ??
          a.unique_creatives ??
          (Array.isArray(a.creatives) ? a.creatives.length : 0)),
      0
    );
    return {
      totalSpots,
      totalSeconds,
      activeClients,
      totalCreatives,
    };
  }, [advertisers]);

  // Filter spots by searchQuery
  const filteredSpots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Sort most recent first for live log inspection
    const sorted = [...allSpots].sort((a, b) =>
      (b.played_at || '').localeCompare(a.played_at || '')
    );
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.client?.toLowerCase().includes(q) ||
        s.program_name?.toLowerCase().includes(q) ||
        s.user_dj?.toLowerCase().includes(q) ||
        s.filename?.toLowerCase().includes(q)
    );
  }, [allSpots, searchQuery]);

  // Filter advertisers by searchQuery when on advertisers tab
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
  const paginatedSpots = filteredSpots.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleDownloadCsv = (clientName?: string) => {
    const params = new URLSearchParams({
      format: 'csv',
    });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const targetClient = clientName ?? selectedClient;
    if (targetClient && targetClient !== 'ALL') {
      params.set('client', targetClient);
    }
    window.open(`/api/radio-traffic/affidavit?${params.toString()}`, '_blank');
  };

  const handleDownloadPdf = async (clientName?: string) => {
    const targetClient = clientName ?? selectedClient;
    setExportingPdfClient(targetClient);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (targetClient && targetClient !== 'ALL') {
        params.set('client', targetClient);
      }

      const res = await fetch(`/api/radio-traffic/affidavit?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch affidavit data for PDF');
      const payload: AffidavitResponse = await res.json();
      const spots = [...(payload.spots || [])].sort((a, b) =>
        (a.played_at || '').localeCompare(b.played_at || '')
      );

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      // Load official Salt Media logo from /SALT-MEDIA-Logo.png
      const loadLogo = (): Promise<{ dataUrl: string; ratio: number } | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const targetWidth = Math.min(img.naturalWidth || 900, 900);
              const ratio =
                img.naturalWidth && img.naturalHeight
                  ? img.naturalWidth / img.naturalHeight
                  : 3.2;
              const targetHeight = Math.round(targetWidth / ratio);
              const canvas = document.createElement('canvas');
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(null);
                return;
              }
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              resolve({
                dataUrl: canvas.toDataURL('image/png'),
                ratio,
              });
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = '/SALT-MEDIA-Logo.png';
        });

      const logoAsset = await loadLogo();

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Salt Media Brand Color Theme (Vibrant Deep Blue + Salt Crimson)
      const SALT_CRIMSON: [number, number, number] = [139, 10, 8]; // #8B0A08 official logo crimson
      const SALT_CRIMSON_LIGHT: [number, number, number] = [175, 24, 21]; // #AF1815 accent crimson
      const SALT_DARK_BLUE: [number, number, number] = [24, 58, 122]; // #183A7A rich royal-navy blue that pops behind logo
      const SALT_LIGHT_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC clean light card fill
      const SALT_BORDER: [number, number, number] = [203, 213, 225]; // #CBD5E1 clean border
      const SALT_TEXT_DARK: [number, number, number] = [15, 23, 42]; // #0F172A crisp dark navy text
      const SALT_TEXT_MUTED: [number, number, number] = [210, 224, 245]; // #D2E0F5 crisp light blue-white subtitle text

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const clientLabel =
        !targetClient || targetClient === 'ALL'
          ? 'All Advertisers'
          : targetClient;

      // Top Header Banner (Dark Navy Blue + Salt Crimson Accent Bar)
      doc.setFillColor(...SALT_DARK_BLUE);
      doc.rect(0, 0, pageWidth, 29, 'F');
      doc.setFillColor(...SALT_CRIMSON);
      doc.rect(0, 27.5, pageWidth, 2, 'F');

      let titleStartX = 14;
      if (logoAsset) {
        const logoH = 18;
        const logoW = Math.min(logoH * logoAsset.ratio, 64);
        doc.addImage(logoAsset.dataUrl, 'PNG', 14, 5, logoW, logoH);
        titleStartX = 14 + logoW + 6;

        // Subtle vertical divider between logo and title
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.line(titleStartX - 3, 6.5, titleStartX - 3, 22);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14.5);
      doc.text('OFFICIAL BROADCAST AFFIDAVIT', titleStartX, 12.5);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SALT_TEXT_MUTED);
      doc.text(
        'SALT FM 107 — PROOF-OF-PERFORMANCE LOG',
        titleStartX,
        19.5
      );

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
      doc.text(`Period: ${startDate} to ${endDate}`, pageWidth - 14, 12.5, {
        align: 'right',
      });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SALT_TEXT_MUTED);
      doc.text(`Generated: ${generatedEat} EAT`, pageWidth - 14, 19.5, {
        align: 'right',
      });

      // Campaign Summary Box (Clean Light Card + Left Salt Crimson Accent Bar)
      const totalSeconds = spots.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0
      );
      doc.setFillColor(...SALT_LIGHT_BG);
      doc.setDrawColor(...SALT_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 34, pageWidth - 28, 18, 2, 2, 'FD');

      // Left crimson accent strip inside summary box
      doc.setFillColor(...SALT_CRIMSON);
      doc.rect(14, 34, 2.5, 18, 'F');

      doc.setTextColor(...SALT_TEXT_DARK);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Advertiser / Client: ${clientLabel}`, 20, 41.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        `Broadcast Window: ${startDate} to ${endDate} (Africa/Kampala EAT)`,
        20,
        47.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...SALT_CRIMSON);
      doc.text(
        `Total Verified Spots: ${spots.length}`,
        pageWidth / 2,
        41.5
      );
      doc.setTextColor(...SALT_TEXT_DARK);
      doc.setFontSize(9);
      doc.text(
        `Total Commercial Airtime: ${formatDurationHuman(totalSeconds)} (${
          Math.round((totalSeconds / 60) * 10) / 10
        } mins)`,
        pageWidth / 2,
        47.5
      );

      // Build Creative Summary Map
      const creativeMap = new Map<
        string,
        { title: string; client: string; count: number; duration: number; totalSec: number }
      >();
      spots.forEach((s) => {
        const key = `${s.client}||${s.title}`;
        const existing = creativeMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.totalSec += s.duration_seconds || 0;
        } else {
          creativeMap.set(key, {
            title: s.title,
            client: s.client,
            count: 1,
            duration: s.duration_seconds || 0,
            totalSec: s.duration_seconds || 0,
          });
        }
      });

      const creativeRows = Array.from(creativeMap.values()).map((c) => [
        c.client,
        c.title,
        `${c.duration}s`,
        String(c.count),
        formatDurationHuman(c.totalSec),
      ]);

      // Table 1: Creative Summary
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SALT_CRIMSON);
      doc.text('1. Creative Execution Summary', 14, 59);

      autoTable(doc, {
        startY: 62,
        head: [['Advertiser', 'Audio Creative Title', 'Spot Length', 'Spots Aired', 'Total Airtime']],
        body: creativeRows,
        theme: 'grid',
        headStyles: {
          fillColor: SALT_CRIMSON,
          textColor: 255,
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: SALT_TEXT_DARK,
          lineColor: SALT_BORDER,
        },
        alternateRowStyles: {
          fillColor: SALT_LIGHT_BG,
        },
        margin: { left: 14, right: 14 },
      });

      const afterSummaryY = (doc as any).lastAutoTable?.finalY
        ? (doc as any).lastAutoTable.finalY + 8
        : 95;

      // Table 2: Itemized Broadcast Playout Log
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SALT_CRIMSON);
      doc.text('2. Itemized Broadcast Playout Log (Chronological)', 14, afterSummaryY);

      const spotRows = spots.map((s, idx) => {
        const epgMatch = resolveRadioEPGDetails(
          s.played_at,
          s.played_at_local,
          radioPrograms,
          s.program_name,
          s.user_dj
        );
        return [
          String(idx + 1),
          s.played_at_local
            ? `${s.played_at_local} EAT`
            : formatEatTimestamp(s.played_at),
          s.client,
          s.title,
          s.duration_formatted || `${s.duration_seconds}s`,
          epgMatch.programName,
          epgMatch.presenter,
          s.filename || '-',
        ];
      });

      autoTable(doc, {
        startY: afterSummaryY + 3,
        head: [
          [
            '#',
            'Date & Time (EAT)',
            'Advertiser',
            'Spot Creative Title',
            'Duration',
            'Radio Program / Show',
            'Program Presenter',
            'Source Audio File',
          ],
        ],
        body: spotRows,
        theme: 'striped',
        headStyles: {
          fillColor: SALT_CRIMSON,
          textColor: 255,
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: SALT_TEXT_DARK,
        },
        alternateRowStyles: {
          fillColor: SALT_LIGHT_BG,
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 38 },
          2: { cellWidth: 32 },
          3: { cellWidth: 55 },
          4: { cellWidth: 18, halign: 'right' },
          5: { cellWidth: 38 },
          6: { cellWidth: 25 },
        },
        margin: { left: 14, right: 14, bottom: 25 },
      });

      // Certification & Signature Block
      let certY = ((doc as any).lastAutoTable?.finalY || afterSummaryY + 30) + 10;
      if (certY + 28 > pageHeight - 12) {
        doc.addPage();
        certY = 20;
      }

      doc.setDrawColor(...SALT_CRIMSON_LIGHT);
      doc.setLineWidth(0.4);
      doc.line(14, certY, pageWidth - 14, certY);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...SALT_TEXT_DARK);
      doc.text(
        'I hereby certify that the commercial announcements listed in this Proof-of-Performance Affidavit were broadcast on Salt FM at the dates and times indicated above, as automatically recorded by the StationPlaylist Studio playout log.',
        14,
        certY + 6
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SALT_CRIMSON);
      doc.text('Traffic Officer Signature: ___________________________', 14, certY + 18);
      doc.text('Station Manager Signature: ___________________________', pageWidth / 2, certY + 18);

      // Branded Footer on every page
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'Salt Media Group — Ffe Munnyo | Official Broadcast Proof-of-Performance Affidavit',
          14,
          pageHeight - 6
        );
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth - 14,
          pageHeight - 6,
          { align: 'right' }
        );
      }

      const safeClient = (targetClient || 'all_clients')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
      doc.save(`saltfm_affidavit_${safeClient}_${startDate}_to_${endDate}.pdf`);
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: err?.message || 'Failed to generate PDF Affidavit',
      });
    } finally {
      setExportingPdfClient(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Filter only valid .csv files (ignoring hidden OS files like .DS_Store)
    const csvFiles = Array.from(fileList)
      .filter((f) => {
        const baseName = f.name.split('/').pop() || f.name;
        return (
          !baseName.startsWith('.') &&
          baseName.toLowerCase().endsWith('.csv')
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    if (csvFiles.length === 0) {
      setUploadStatus({
        type: 'error',
        message: 'No .csv log files found in the selected folder or selection.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
      return;
    }

    const CONCURRENCY_LIMIT = 3;
    cancelUploadRef.current = false;
    setUploading(true);
    setUploadStatus(null);
    setUploadProgress({
      processed: 0,
      total: csvFiles.length,
      spotsInserted: 0,
      spotsFound: 0,
      failed: 0,
      currentFile: csvFiles[0].name,
    });

    let processedCount = 0;
    let totalSpotsFound = 0;
    let totalSpotsInserted = 0;
    let failedCount = 0;
    let lastError = '';
    let minFileDate: string | null = null;
    let maxFileDate: string | null = null;

    let nextIndex = 0;

    const uploadWorker = async () => {
      while (nextIndex < csvFiles.length && !cancelUploadRef.current) {
        const currentIndex = nextIndex++;
        const file = csvFiles[currentIndex];
        if (!file) break;

        // Track date from SLog-YYMMDD.csv
        const match = file.name.match(/SLog-(\d{2})(\d{2})(\d{2})/i);
        if (match) {
          const fDate = `20${match[1]}-${match[2]}-${match[3]}`;
          if (!minFileDate || fDate < minFileDate) minFileDate = fDate;
          if (!maxFileDate || fDate > maxFileDate) maxFileDate = fDate;
        }

        try {
          const formData = new FormData();
          formData.append('file', file, file.name);
          const res = await fetch('/api/radio-traffic/upload', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          const spotsFound = Number(data.parsed ?? data.total_rows_parsed ?? 0);
          const spotsInserted = Number(data.inserted ?? data.spots_inserted ?? 0);
          totalSpotsFound += spotsFound;
          totalSpotsInserted += spotsInserted;
        } catch (err: any) {
          failedCount += 1;
          lastError = err?.message || 'Upload failed';
        } finally {
          processedCount += 1;
          setUploadProgress({
            processed: processedCount,
            total: csvFiles.length,
            spotsInserted: totalSpotsInserted,
            spotsFound: totalSpotsFound,
            failed: failedCount,
            currentFile: file.name,
          });
        }
      }
    };

    try {
      const workerCount = Math.min(CONCURRENCY_LIMIT, csvFiles.length);
      await Promise.all(
        Array.from({ length: workerCount }, () => uploadWorker())
      );

      // Expand dashboard date filter if uploaded SLog-YYMMDD dates fall outside current range
      let dateAdjustedNote = '';
      if (minFileDate && maxFileDate) {
        const newStart = minFileDate < startDate ? minFileDate : startDate;
        const newEnd = maxFileDate > endDate ? maxFileDate : endDate;
        if (newStart !== startDate || newEnd !== endDate) {
          setStartDate(newStart);
          setEndDate(newEnd);
          dateAdjustedNote = ` Date filter updated (${newStart} to ${newEnd}).`;
        }
      }

      const wasCancelled = cancelUploadRef.current;

      if (processedCount === failedCount && failedCount > 0) {
        setUploadStatus({
          type: 'error',
          message: `Upload failed for ${failedCount} file(s): ${lastError}`,
        });
      } else if (csvFiles.length === 1) {
        const singleName = csvFiles[0].name;
        setUploadStatus({
          type: 'success',
          message:
            totalSpotsInserted === 0 && totalSpotsFound > 0
              ? `Synced ${singleName}: ${totalSpotsFound.toLocaleString()} commercial spots verified (already in database).${dateAdjustedNote}`
              : `Synced ${singleName}: ${totalSpotsInserted.toLocaleString()} commercial spots ingested (${totalSpotsFound.toLocaleString()} commercial spots found).${dateAdjustedNote}`,
        });
      } else {
        const failNote =
          failedCount > 0 ? ` (${failedCount} file(s) failed)` : '';
        const cancelNote = wasCancelled ? ' (Stopped early by user)' : '';
        setUploadStatus({
          type: 'success',
          message:
            totalSpotsInserted === 0 && totalSpotsFound > 0
              ? `Bulk sync complete${cancelNote}: ${processedCount.toLocaleString()} / ${csvFiles.length.toLocaleString()} CSV files scanned • ${totalSpotsFound.toLocaleString()} commercial spots verified (already in database)${failNote}.${dateAdjustedNote}`
              : `Bulk sync complete${cancelNote}: ${processedCount.toLocaleString()} / ${csvFiles.length.toLocaleString()} CSV files synced • ${totalSpotsInserted.toLocaleString()} new commercial spots ingested (${totalSpotsFound.toLocaleString()} total found)${failNote}.${dateAdjustedNote}`,
        });
      }

      refetchAdvertisers();
      refetchAffidavit();
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: err?.message || 'Failed to upload SLog CSV files',
      });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleRefresh = () => {
    refetchAdvertisers();
    refetchAffidavit();
  };

  const isRefreshing = advertisersFetching || affidavitFetching;

  return (
    <div className="space-y-5">
      {/* Header & Controls — z-40 ensures dropdowns inside float above KPI cards below */}
      <div className="relative z-40 frosted-glass rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className={compactHeader ? 'text-xl sm:text-2xl font-bold text-white' : 'text-2xl sm:text-3xl font-bold text-white'}>
              Traffic &amp; Advertiser Logs
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Studio Auto-Sync (EAT)
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-white/75">
            Real-time commercial playout verification, advertiser spot counts, and downloadable Proof-of-Performance affidavits from{' '}
            <code className="text-white bg-white/15 px-1.5 py-0.5 rounded text-xs font-mono">
              F:\Air Data\Playlist
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleRangeChange}
          />

          {/* Hidden File & Folder Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            {...({ webkitdirectory: '', directory: '' } as any)}
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload Logs Dropdown (Files or Folder Backfill) */}
          <div className="relative">
            <button
              onClick={() => setOpenUploadMenu((prev) => !prev)}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/90 text-xs sm:text-sm font-medium transition disabled:opacity-50"
              title="Upload StationPlaylist SLog CSV files or an entire folder for backfill"
            >
              <Upload size={14} />
              <span>
                {uploading && uploadProgress
                  ? `Syncing ${uploadProgress.processed}/${uploadProgress.total}...`
                  : 'Upload Logs'}
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform ${
                  openUploadMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openUploadMenu && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setOpenUploadMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-[100] w-56 bg-[#1c1917]/95 backdrop-blur-xl rounded-xl p-1.5 shadow-2xl border border-white/25">
                  <button
                    onClick={() => {
                      setOpenUploadMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left"
                  >
                    <FileText size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Select CSV File(s)</div>
                      <div className="text-[10px] text-white/65">
                        One or multiple SLog-*.csv files
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setOpenUploadMenu(false);
                      folderInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left mt-0.5"
                  >
                    <FolderOpen size={14} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold">Open Folder (Backfill)</div>
                      <div className="text-[10px] text-white/65">
                        Scans &amp; syncs all CSVs in folder
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Header Export Dropdown (CSV / PDF) */}
          <div className="relative">
            <button
              onClick={() =>
                setOpenExportMenu(
                  openExportMenu === '__HEADER__' ? null : '__HEADER__'
                )
              }
              disabled={exportingPdfClient !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-500/40 text-white text-xs sm:text-sm font-medium transition shadow disabled:opacity-50"
            >
              <Download size={14} />
              <span>
                {exportingPdfClient === selectedClient
                  ? 'Generating PDF...'
                  : selectedClient === 'ALL'
                    ? 'Export Affidavit'
                    : `Export ${selectedClient}`}
              </span>
              <ChevronDown
                size={13}
                className={`transition-transform ${
                  openExportMenu === '__HEADER__' ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openExportMenu === '__HEADER__' && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setOpenExportMenu(null)}
                />
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
                      <div className="text-[10px] text-white/65">
                        Official signed layout
                      </div>
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
                      <div className="text-[10px] text-white/65">
                        Excel / spreadsheet
                      </div>
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
            title="Refresh logs"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? 'animate-spin' : ''}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Live Bulk / Folder Upload Progress Banner */}
      {uploading && uploadProgress && (
        <div className="relative z-10 frosted-glass rounded-xl p-4 border border-blue-500/40 bg-blue-950/40 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-white font-semibold">
              <RefreshCw size={15} className="animate-spin text-blue-400" />
              <span>
                Syncing {uploadProgress.processed.toLocaleString()} of{' '}
                {uploadProgress.total.toLocaleString()} CSV files (
                {Math.round(
                  (uploadProgress.processed / Math.max(1, uploadProgress.total)) *
                    100
                )}
                %)
              </span>
              <span className="text-white/65 font-normal font-mono text-xs">
                • {uploadProgress.currentFile}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-300 font-medium">
                {uploadProgress.spotsInserted.toLocaleString()} new spots ingested ({uploadProgress.spotsFound.toLocaleString()} scanned)
              </span>
              {uploadProgress.total > 1 && (
                <button
                  onClick={() => {
                    cancelUploadRef.current = true;
                  }}
                  className="px-2.5 py-1 rounded-md bg-red-500/25 hover:bg-red-500/40 border border-red-400/40 text-red-200 text-xs font-semibold transition"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-200"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (uploadProgress.processed /
                      Math.max(1, uploadProgress.total)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Upload status banner */}
      {uploadStatus && (
        <div
          className={`relative z-10 flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium ${
            uploadStatus.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              : 'bg-red-500/20 border-red-500/40 text-red-200'
          }`}
        >
          <span>{uploadStatus.message}</span>
          <button
            onClick={() => setUploadStatus(null)}
            className="text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Summary Cards — z-10 sits below header dropdowns */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Total Spots Aired
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : kpiStats.totalSpots.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-300 font-medium mt-1">
              Verified playout executions
            </p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/25 border border-blue-400/40 text-blue-300">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Commercial Airtime
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading
                ? '...'
                : formatDurationHuman(kpiStats.totalSeconds)}
            </p>
            <p className="text-xs text-white/70 mt-1">
              {Math.round((kpiStats.totalSeconds / 60) * 10) / 10} total minutes billed
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
            <p className="text-xs text-white/70 mt-1">
              Matched via Traffic Rules
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-300">
            <Building2 size={24} />
          </div>
        </div>

        <div className="frosted-glass rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Unique Audio Creatives
            </p>
            <p className="text-3xl font-bold text-white mt-1">
              {advertisersLoading ? '...' : kpiStats.totalCreatives}
            </p>
            <p className="text-xs text-white/70 mt-1">
              Distinct spots &amp; promos aired
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/25 border border-amber-400/40 text-amber-300">
            <Sparkles size={24} />
          </div>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
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
          {/* Client Dropdown Filter */}
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
                <option
                  key={adv.client}
                  value={adv.client}
                  className="bg-[#1c1917] text-white"
                >
                  {adv.client} ({adv.total_spots} spots)
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
            />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search client, spot, show, DJ..."
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

      {/* TAB 1: ADVERTISER SUMMARY & PROOF OF PERFORMANCE */}
      {activeSubTab === 'advertisers' && (
        <div className="relative z-10 frosted-glass rounded-xl">
          <div className="px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/5 rounded-t-xl">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-300" />
              <span className="text-white font-semibold text-base">
                Advertiser Campaign Delivery &amp; Affidavits
              </span>
            </div>
            <span className="text-xs text-white/70">
              Click any advertiser row to expand individual creative counts or export PDF / CSV affidavit
            </span>
          </div>

          <div>
            {advertisersLoading ? (
              <div className="py-12 text-center text-white/70">
                Loading advertiser summary...
              </div>
            ) : filteredAdvertisers.length === 0 ? (
              <div className="py-12 text-center text-white/70">
                No advertiser spot logs found for the selected period.
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
                        adv.unique_creatives ??
                        (Array.isArray(adv.creatives) ? adv.creatives.length : 0);
                      const firstAired = adv.first_aired ?? adv.first_played_at;
                      const lastAired = adv.last_aired ?? adv.last_played_at;

                      // Build enriched creatives list with counts from allSpots if creatives is string[]
                      const clientSpots = allSpots.filter(
                        (s) => s.client?.toLowerCase() === adv.client?.toLowerCase()
                      );
                      const enrichedCreatives: CreativeSummary[] = (
                        adv.creatives || []
                      ).map((c) => {
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
                      });

                      return (
                        <React.Fragment key={adv.client}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-blue-600/20'
                                : 'hover:bg-white/10'
                            }`}
                            onClick={() =>
                              setExpandedClient(isExpanded ? null : adv.client)
                            }
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
                              {formatEatTimestamp(firstAired)}
                            </td>
                            <td className="py-3.5 px-4 text-white/85 text-xs font-mono">
                              {formatEatTimestamp(lastAired)}
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
                                  disabled={exportingPdfClient === adv.client}
                                  onClick={() =>
                                    setOpenExportMenu(
                                      openExportMenu === adv.client
                                        ? null
                                        : adv.client
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition shadow disabled:opacity-50"
                                >
                                  <Download size={12} />
                                  <span>
                                    {exportingPdfClient === adv.client
                                      ? 'PDF...'
                                      : 'Export'}
                                  </span>
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
                                        <FileText
                                          size={13}
                                          className="text-blue-400 shrink-0"
                                        />
                                        <span>PDF Affidavit</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setOpenExportMenu(null);
                                          handleDownloadCsv(adv.client);
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-white/15 transition text-left mt-0.5"
                                      >
                                        <Download
                                          size={13}
                                          className="text-emerald-400 shrink-0"
                                        />
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
                                    Audio Creatives Breakdown for {adv.client}
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

      {/* TAB 2: ITEMIZED PLAYOUT AFFIDAVIT LOG TABLE */}
      {activeSubTab === 'logs' && (
        <div className="frosted-glass rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white/5">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-300" />
              <span className="text-white font-semibold text-base">
                Itemized Broadcast Affidavit Log
                {selectedClient !== 'ALL' ? ` — ${selectedClient}` : ' (All Advertisers)'}
              </span>
              <span className="text-xs text-white/70">
                ({filteredSpots.length} executions)
              </span>
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
                Loading itemized playout logs...
              </div>
            ) : filteredSpots.length === 0 ? (
              <div className="py-12 text-center text-white/70">
                No itemized spot executions match your current filter.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/15 bg-white/10 text-xs font-semibold uppercase text-white/80">
                        <th className="py-3.5 px-4">Date &amp; Time (EAT)</th>
                        <th className="py-3.5 px-4">Advertiser</th>
                        <th className="py-3.5 px-4">Spot Creative Title</th>
                        <th className="py-3.5 px-4 text-right">Duration</th>
                        <th className="py-3.5 px-4">Radio Program / Show</th>
                        <th className="py-3.5 px-4">Program Presenter</th>
                        <th className="py-3.5 px-4">Audio File Path</th>
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
                          <td className="py-3 px-4 font-semibold text-white">
                            {spot.title}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-medium text-white">
                            {spot.duration_formatted || `${spot.duration_seconds}s`}
                          </td>
                          <td className="py-3 px-4 text-xs text-white/90">
                            <span className="inline-flex items-center gap-1.5">
                              <Radio size={13} className="text-purple-300" />
                              {spot.program_name || 'Automated Playout'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-white/85">
                            <span className="inline-flex items-center gap-1.5">
                              <UserCheck size={13} className="text-white/60" />
                              {spot.user_dj || '-'}
                            </span>
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/15 bg-white/5 text-xs text-white/80">
                    <span>
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, filteredSpots.length)} of{' '}
                      {filteredSpots.length} spots
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

