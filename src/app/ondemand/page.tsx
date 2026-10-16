"use client"
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';
import * as tus from 'tus-js-client';
import { redirect } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchOnDemandData, fetchOnDemandShowById } from '../../lib/queries';
import OnDemandCard from '../components/OnDemandCard';
import { OnDemandContent, Season } from '../../types/ondemand';

// shadcn UI Imports
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

// HugeIcons
import { HugeiconsIcon } from '@hugeicons/react';
import PencilEdit01Icon from '@hugeicons/core-free-icons/dist/esm/PencilEdit01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/dist/esm/Delete02Icon';
import CloudUploadIcon from '@hugeicons/core-free-icons/dist/esm/CloudUploadIcon';
import Video01Icon from '@hugeicons/core-free-icons/dist/esm/Video01Icon';
import AddCircleIcon from '@hugeicons/core-free-icons/dist/esm/AddCircleIcon';

const functions = getFunctions(app, 'us-central1');
const functionsEu = getFunctions(app, 'europe-west1');
const queryClient = new QueryClient();

// Best-effort mirror of on-demand CRUD to Firebase (Firestore) while migrating.
// The mesh (Supabase) write is authoritative; Firebase failures are logged.
const ON_DEMAND_FIREBASE_MIRROR: Record<string, string> = {
  createShow: 'createOnDemandShow',
  updateShow: 'updateOnDemandShow',
  deleteShow: 'deleteOnDemandShow',
  createSfxEpisode: 'createSfxEpisode',
  createEpisodeFromBunnyUpload: 'createSfxEpisode',
  updateEpisode: 'updateOnDemandEpisode',
};

async function mirrorOnDemand(action: string, body: Record<string, unknown>, result?: any) {
  const fnName = ON_DEMAND_FIREBASE_MIRROR[action];
  if (!fnName) return;
  const payload: Record<string, unknown> = { ...body };
  // Inject the mesh-generated ids so the Firestore mirror uses the same ids.
  if (action === 'createShow' && result?.show?.id) payload.id = result.show.id;
  if (action === 'createShow' && result?.show?.bunnyGuid) payload.bunnyGuid = result.show.bunnyGuid;
  if ((action === 'createSfxEpisode' || action === 'createEpisodeFromBunnyUpload') && result?.episode) {
    const ep = result.episode;
    // Mesh is authoritative for ids + transcoded metadata; inject them so the
    // Firestore mirror writes the same doc the mesh produced (no re-poll).
    if (ep.id) payload.id = ep.id;
    if (ep.seasonId) payload.seasonId = ep.seasonId;
    if (ep.server) payload.server = ep.server;
    if (ep.bunnyGuid) payload.bunnyGuid = ep.bunnyGuid;
    if (ep.videoUrl) payload.videoUrl = ep.videoUrl;
    if (ep.thumbnail) payload.thumbnail = ep.thumbnail;
    if (typeof ep.duration === 'number' && ep.duration > 0) payload.duration = ep.duration;
    if (ep.title) payload.title = ep.title;
    if (ep.description) payload.description = ep.description;
    if (ep.seasonTitle) payload.seasonTitle = ep.seasonTitle;
  }
  try {
    await httpsCallable(functionsEu, fnName)(payload);
  } catch (error) {
    console.warn(`[firebase-mirror] ${fnName} failed:`, error);
  }
}

// ─── Resumable Bunny uploads ─────────────────────────────────────────────
// TUS uploads can be resumed from their current offset as long as we keep the
// videoId + file metadata. Persist across reloads; the file itself must be
// re-selected (File objects can't be stored) and resumes via the same videoId.
interface PendingUpload {
  videoId: string;
  fileName: string;
  fileType: string;
  title: string;
  description?: string;
  showId: string;
  seasonId?: string;
  seasonTitle?: string;
  startedAt: number;
}

export interface UploadJob {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  showId: string;
  showTitle: string;
  seasonId?: string;
  seasonTitle?: string;
  server: 'bunny' | 'sfx';
  status: 'queued' | 'initiating' | 'uploading' | 'transcoding' | 'done' | 'failed' | 'paused';
  progress: number;
  statusText: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
  bunnyVideoId?: string;
  sfxJobName?: string;
}

const PENDING_KEY = 'bunnyPendingUploads';

function loadPendingUploads(): PendingUpload[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistPendingUploads(list: PendingUpload[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* storage full / unavailable — resume within the session only */
  }
}

/** Call an on-demand admin operation via the server-side proxy. */
async function ondemandProxy(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch('/api/ondemand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || text || `On-demand ${action} failed (${res.status})`);
  }
  void mirrorOnDemand(action, body, data);
  return data;
}

interface SfxVideo {
  name: string;
  status?: string;
  hlsUrl?: string;
  thumbUrl?: string;
}

interface SfxJob {
  name: string;
  status?: string;
  stage?: string;
  current?: string;
  step?: number;
  total?: number;
  stagePct?: number;
  eta?: string;
  elapsed?: number;
  bucket?: string;
  hlsUrl?: string;
}

function OndemandContent() {
  const { user, role, loading } = useAuth();
  const isModerator = role === 'moderator';
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [metaTagProperty, setMetaTagProperty] = useState('');
  const [metaTagValue, setMetaTagValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const poster16x9InputRef = useRef<HTMLInputElement>(null);
  const poster2x3InputRef = useRef<HTMLInputElement>(null);
  const [uploadingPosterAspect, setUploadingPosterAspect] = useState<string | null>(null);

  // Season selection for upload
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [newSeasonMode, setNewSeasonMode] = useState(false);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');

  // State for Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<OnDemandContent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublished, setEditPublished] = useState(true);
  const [editPoster16x9, setEditPoster16x9] = useState('');
  const [editPoster2x3, setEditPoster2x3] = useState('');

  // State for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<OnDemandContent | null>(null);

  // Bundle CDN collection videos
  const [selectedVideoFromBunny, setSelectedVideoFromBunny] = useState<string | null>(null);

  // Upload server selection (Bunny CDN or SFX)
  const [uploadServer, setUploadServer] = useState<'bunny' | 'sfx'>('bunny');
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>(loadPendingUploads);
  const [uploadSectionOpen, setUploadSectionOpen] = useState(false);
  const fileRef = useRef<File | null>(null);

  // Multi-job upload queue configuration (max 3 concurrent network uploads)
  const MAX_CONCURRENT_UPLOADS = 3;
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const tusUploadsRef = useRef<Record<string, tus.Upload>>({});
  const activeUploadIdsRef = useRef<Set<string>>(new Set());
  const queuedRunnersRef = useRef<Map<string, () => void>>(new Map());
  const queueOrderRef = useRef<string[]>([]);

  const activeUploadsCount = uploadJobs.filter(
    (j) => j.status === 'uploading' || j.status === 'initiating'
  ).length;
  const queuedJobsCount = uploadJobs.filter((j) => j.status === 'queued').length;
  const transcodingJobsCount = uploadJobs.filter((j) => j.status === 'transcoding').length;
  const activeJobCount = activeUploadsCount + queuedJobsCount + transcodingJobsCount;

  const updateJob = (jobId: string, updates: Partial<UploadJob>) => {
    setUploadJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
    );
  };

  const updateQueuedJobsPositions = () => {
    setUploadJobs((prev) =>
      prev.map((j) => {
        if (j.status !== 'queued') return j;
        const idx = queueOrderRef.current.indexOf(j.id);
        if (idx === -1) return j;
        return {
          ...j,
          statusText: `Queued (#${idx + 1} in queue) — waiting for an upload slot...`,
        };
      })
    );
  };

  const processQueue = () => {
    while (activeUploadIdsRef.current.size < MAX_CONCURRENT_UPLOADS && queueOrderRef.current.length > 0) {
      const nextJobId = queueOrderRef.current.shift();
      if (!nextJobId) break;
      const runner = queuedRunnersRef.current.get(nextJobId);
      queuedRunnersRef.current.delete(nextJobId);
      if (!runner) continue;

      activeUploadIdsRef.current.add(nextJobId);
      runner();
    }
    updateQueuedJobsPositions();
  };

  const cancelJob = (jobId: string) => {
    // If job was waiting in the queue, remove it from queue
    const queueIdx = queueOrderRef.current.indexOf(jobId);
    if (queueIdx !== -1) {
      queueOrderRef.current.splice(queueIdx, 1);
      queuedRunnersRef.current.delete(jobId);
      updateJob(jobId, { status: 'failed', statusText: 'Cancelled from queue' });
      updateQueuedJobsPositions();
      return;
    }

    if (tusUploadsRef.current[jobId]) {
      try {
        tusUploadsRef.current[jobId].abort();
      } catch (e) {
        console.error('Error aborting TUS upload:', e);
      }
      delete tusUploadsRef.current[jobId];
    }
    activeUploadIdsRef.current.delete(jobId);
    updateJob(jobId, { status: 'failed', statusText: 'Cancelled by user' });
    processQueue();
  };

  const removeJob = (jobId: string) => {
    const queueIdx = queueOrderRef.current.indexOf(jobId);
    if (queueIdx !== -1) {
      queueOrderRef.current.splice(queueIdx, 1);
      queuedRunnersRef.current.delete(jobId);
    }
    if (tusUploadsRef.current[jobId]) {
      try {
        tusUploadsRef.current[jobId].abort();
      } catch (e) {
        // ignore
      }
      delete tusUploadsRef.current[jobId];
    }
    activeUploadIdsRef.current.delete(jobId);
    setUploadJobs((prev) => prev.filter((j) => j.id !== jobId));
    processQueue();
  };

  const clearFinishedJobs = () => {
    setUploadJobs((prev) => prev.filter((j) => j.status !== 'done' && j.status !== 'failed'));
  };

  // Auto-open upload section when uploading starts or any job is active
  useEffect(() => {
    if (isUploading || activeJobCount > 0) setUploadSectionOpen(true);
  }, [isUploading, activeJobCount]);

  const addPendingUpload = (p: PendingUpload) => {
    setPendingUploads(prev => {
      const next = [...prev.filter(x => x.videoId !== p.videoId), p];
      persistPendingUploads(next);
      return next;
    });
  };

  const removePendingUpload = (videoId: string) => {
    setPendingUploads(prev => {
      const next = prev.filter(x => x.videoId !== videoId);
      persistPendingUploads(next);
      return next;
    });
  };
  const [sfxStatusText, setSfxStatusText] = useState<string | null>(null);
  const [selectedSfxVideo, setSelectedSfxVideo] = useState<SfxVideo | null>(null);
  const [sfxSearch, setSfxSearch] = useState('');
  const [sfxTenant, setSfxTenant] = useState<'tv' | 'fm'>('tv');
  const [newShowMode, setNewShowMode] = useState(false);
  const [newShowTitle, setNewShowTitle] = useState('');

  const { data, isLoading, error } = useQuery<{ documents: OnDemandContent[] }>({
    queryKey: ['onDemandData', selectedFilter],
    queryFn: fetchOnDemandData,
    staleTime: 1000 * 60 * 5,
  });

  const selectedShow = data?.documents.find(d => d.id === selectedCollectionId);

  const { data: bunnyVideos, isLoading: loadingBunnyVideos } = useQuery({
    queryKey: ['bunny-collection-videos', selectedShow?.bunnyGuid],
    queryFn: async () => {
      if (!selectedShow?.bunnyGuid) return [];
      const res = await fetch(`/api/bunny/videos?collectionId=${selectedShow.bunnyGuid}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.videos || [];
    },
    enabled: !!selectedShow?.bunnyGuid,
  });

  const { data: sfxVideos, isLoading: loadingSfxVideos } = useQuery({
    queryKey: ['sfx-videos', sfxTenant],
    queryFn: async () => {
      const tenantPath = (sfxTenant === 'fm'
        ? process.env.NEXT_PUBLIC_SFX_TENANT_FM_PATH || ''
        : process.env.NEXT_PUBLIC_SFX_TENANT_TV_PATH || '').trim();
      const res = await fetch(`/api/sfx/jobs?kind=videos`);
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : [])
        .filter((v: SfxVideo) => v.status === 'done')
        .filter((v: SfxVideo) => !tenantPath || v.hlsUrl?.includes(tenantPath));
    },
    enabled: uploadServer === 'sfx' && !!selectedCollectionId,
  });

  const { data: sfxActiveJobs } = useQuery({
    queryKey: ['sfx-active-jobs', sfxTenant],
    queryFn: async () => {
      const tenantPath = (sfxTenant === 'fm'
        ? process.env.NEXT_PUBLIC_SFX_TENANT_FM_PATH || ''
        : process.env.NEXT_PUBLIC_SFX_TENANT_TV_PATH || '').trim();
      const res = await fetch(`/api/sfx/jobs`);
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : [])
        .filter((j: SfxJob) => j.status === 'queued' || j.status === 'working')
        .filter((j: SfxJob) => !tenantPath || !j.hlsUrl || j.hlsUrl.includes(tenantPath));
    },
    enabled: uploadServer === 'sfx',
    refetchInterval: 3000,
  });

  const sfxJobDisplayName = (j: SfxJob) => {
    const m = j.hlsUrl?.match(/\/hls\/(.+)\/index\.m3u8/);
    return m ? decodeURIComponent(m[1]) : j.name;
  };

  useEffect(() => {
    if (data?.documents && data.documents.length > 0 && !selectedCollectionId) {
      setSelectedCollectionId(data.documents[0].id);
    }
  }, [data?.documents, selectedCollectionId]);

  // Fetch seasons when a show is selected for upload
  useEffect(() => {
    if (!selectedCollectionId) return;
    setSeasonLoading(true);
    setSeasons([]);
    setSelectedSeasonId(null);
    setNewSeasonMode(false);
    setNewSeasonTitle('');

    fetchOnDemandShowById(selectedCollectionId)
      .then((show: any) => {
        const showSeasons = show?.seasons || [];
        setSeasons(showSeasons);
        if (showSeasons.length > 0) {
          setSelectedSeasonId(showSeasons[0].id);
        }
      })
      .catch((err: any) => console.error('Failed to load seasons:', err))
      .finally(() => setSeasonLoading(false));
  }, [selectedCollectionId]);

  if (loading) {
    return <div className="p-8 text-center">Loading authentication...</div>;
  }

  if (!user) {
    redirect('/login');
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      fileRef.current = file;
      setVideoFile(file);
      setSelectedVideoFromBunny(null);
      setSelectedSfxVideo(null);
      setVideoTitle(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if ((!videoFile && !selectedVideoFromBunny && !selectedSfxVideo) || !selectedCollectionId || !videoTitle.trim()) {
      alert('Please select a file (or existing video), a show, and provide a title.');
      return;
    }
    if (!selectedSeasonId && !newSeasonTitle.trim()) {
      alert('Please select a season or enter a new season name.');
      return;
    }

    const title = videoTitle.trim();
    const description = videoDescription.trim();
    const showId = selectedCollectionId;
    const showTitle = selectedShow?.title || 'Show';
    const seasonId = newSeasonMode ? undefined : (selectedSeasonId || undefined);
    const seasonTitle = newSeasonMode ? newSeasonTitle.trim() : (seasons.find((s) => s.id === selectedSeasonId)?.title || 'Season');
    const server = uploadServer;
    const tenant = sfxTenant;
    const currentFile = videoFile;
    const existingBunny = selectedVideoFromBunny;
    const existingSfx = selectedSfxVideo;

    // Reset the input form immediately so the admin can queue another video right away
    setVideoFile(null);
    setSelectedVideoFromBunny(null);
    setSelectedSfxVideo(null);
    setVideoTitle('');
    setVideoDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Case 1: Existing SFX video selected
    if (server === 'sfx' && existingSfx) {
      const job: UploadJob = {
        id: jobId,
        title,
        description,
        fileName: existingSfx.name,
        fileSize: 0,
        showId,
        showTitle,
        seasonId,
        seasonTitle,
        server: 'sfx',
        status: 'uploading',
        progress: 50,
        statusText: `Adding "${existingSfx.name}"...`,
        startedAt: Date.now(),
      };
      setUploadJobs((prev) => [job, ...prev]);
      runExistingSfxJob(jobId, existingSfx, { title, description, showId, seasonId, seasonTitle });
      return;
    }

    // Case 2: Existing Bunny video selected
    if (server === 'bunny' && existingBunny && !currentFile) {
      const job: UploadJob = {
        id: jobId,
        title,
        description,
        fileName: title,
        fileSize: 0,
        showId,
        showTitle,
        seasonId,
        seasonTitle,
        server: 'bunny',
        status: 'uploading',
        progress: 50,
        statusText: 'Adding existing Bunny video...',
        startedAt: Date.now(),
      };
      setUploadJobs((prev) => [job, ...prev]);
      runExistingBunnyJob(jobId, existingBunny, { title, description, showId, seasonId, seasonTitle });
      return;
    }

    if (!currentFile) {
      alert('Please select a video file to upload.');
      return;
    }

    // Case 3: SFX File Upload
    if (server === 'sfx') {
      const runner = () => {
        runSfxUploadJob(jobId, currentFile, {
          title,
          description,
          showId,
          showTitle,
          seasonId,
          seasonTitle,
          tenant,
        });
      };

      const canStartImmediately = activeUploadIdsRef.current.size < MAX_CONCURRENT_UPLOADS;

      const job: UploadJob = {
        id: jobId,
        title,
        description,
        fileName: currentFile.name,
        fileSize: currentFile.size,
        showId,
        showTitle,
        seasonId,
        seasonTitle,
        server: 'sfx',
        status: canStartImmediately ? 'initiating' : 'queued',
        progress: 0,
        statusText: canStartImmediately
          ? 'Preparing SFX upload...'
          : `Queued (#${queueOrderRef.current.length + 1} in queue) — waiting for an upload slot...`,
        startedAt: Date.now(),
      };
      setUploadJobs((prev) => [job, ...prev]);

      if (canStartImmediately) {
        activeUploadIdsRef.current.add(jobId);
        runner();
      } else {
        queueOrderRef.current.push(jobId);
        queuedRunnersRef.current.set(jobId, runner);
      }
      return;
    }

    // Case 4: Bunny CDN File Upload
    const bunnyRunner = () => {
      runBunnyUploadJob(jobId, currentFile, {
        title,
        description,
        showId,
        showTitle,
        seasonId,
        seasonTitle,
        bunnyCollectionId: selectedShow?.bunnyGuid || '',
      });
    };

    const canStartBunny = activeUploadIdsRef.current.size < MAX_CONCURRENT_UPLOADS;

    const job: UploadJob = {
      id: jobId,
      title,
      description,
      fileName: currentFile.name,
      fileSize: currentFile.size,
      showId,
      showTitle,
      seasonId,
      seasonTitle,
      server: 'bunny',
      status: canStartBunny ? 'initiating' : 'queued',
      progress: 0,
      statusText: canStartBunny
        ? 'Requesting Bunny upload signature...'
        : `Queued (#${queueOrderRef.current.length + 1} in queue) — waiting for an upload slot...`,
      startedAt: Date.now(),
    };
    setUploadJobs((prev) => [job, ...prev]);

    if (canStartBunny) {
      activeUploadIdsRef.current.add(jobId);
      bunnyRunner();
    } else {
      queueOrderRef.current.push(jobId);
      queuedRunnersRef.current.set(jobId, bunnyRunner);
    }
  };

  const runBunnyUploadJob = async (
    jobId: string,
    file: File,
    meta: {
      title: string;
      description: string;
      showId: string;
      showTitle: string;
      seasonId?: string;
      seasonTitle?: string;
      bunnyCollectionId: string;
    }
  ) => {
    try {
      updateJob(jobId, { status: 'initiating', statusText: 'Requesting Bunny upload signature...' });
      const createTusUploadCallable = httpsCallable(functions, 'createTusUpload');
      const resp = (await createTusUploadCallable({
        title: meta.title,
        collectionId: meta.showId,
        bunnyCollectionId: meta.bunnyCollectionId || '',
      })) as any;

      const tusVideoId: string = resp.data.videoId;
      if (!tusVideoId) {
        throw new Error('createTusUpload returned no videoId');
      }
      const { expirationTime, signature } = resp.data;

      updateJob(jobId, {
        bunnyVideoId: tusVideoId,
        status: 'uploading',
        statusText: 'Uploading to Bunny CDN (0%)...',
      });

      addPendingUpload({
        videoId: tusVideoId,
        fileName: file.name,
        fileType: file.type || 'video/mp4',
        title: meta.title,
        description: meta.description,
        showId: meta.showId,
        seasonId: meta.seasonId,
        seasonTitle: meta.seasonTitle,
        startedAt: Date.now(),
      });

      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: expirationTime.toString(),
          VideoId: tusVideoId,
          LibraryId: '307069',
        },
        metadata: {
          filename: file.name,
          filetype: file.type,
          title: meta.title,
          collection: meta.bunnyCollectionId || '',
        },
        onError: function (error) {
          console.error(`Bunny upload error for job ${jobId}:`, error);
          delete tusUploadsRef.current[jobId];
          activeUploadIdsRef.current.delete(jobId);
          processQueue();
          updateJob(jobId, {
            status: 'failed',
            error: String(error),
            statusText: 'Upload failed: ' + error,
          });
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = parseFloat(((bytesUploaded / bytesTotal) * 100).toFixed(1));
          updateJob(jobId, {
            progress: percentage,
            status: 'uploading',
            statusText: `Uploading to Bunny CDN (${percentage}%)...`,
          });
        },
        onSuccess: async function () {
          delete tusUploadsRef.current[jobId];
          activeUploadIdsRef.current.delete(jobId);
          processQueue();
          updateJob(jobId, {
            progress: 100,
            status: 'transcoding',
            statusText: 'Upload finished. Registering episode record...',
          });

          try {
            const episodePayload: Record<string, unknown> = {
              showId: meta.showId,
              videoId: tusVideoId,
              title: meta.title,
              description: meta.description,
              server: 'bunny',
            };
            if (meta.seasonId) {
              episodePayload.seasonId = meta.seasonId;
            } else if (meta.seasonTitle) {
              episodePayload.seasonTitle = meta.seasonTitle;
            }

            await ondemandProxy('createEpisodeFromBunnyUpload', episodePayload);
            removePendingUpload(tusVideoId);
            updateJob(jobId, {
              status: 'done',
              statusText: 'Completed! Ready on Bunny CDN.',
              completedAt: Date.now(),
            });
            queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
          } catch (err: any) {
            console.error(`Failed to create episode record for ${jobId}:`, err);
            updateJob(jobId, {
              status: 'failed',
              error: err.message,
              statusText: 'Upload completed but episode creation failed: ' + err.message,
            });
          }
        },
      });

      tusUploadsRef.current[jobId] = upload;
      upload.start();
    } catch (err: any) {
      console.error(`Error initializing Bunny upload for job ${jobId}:`, err);
      delete tusUploadsRef.current[jobId];
      activeUploadIdsRef.current.delete(jobId);
      processQueue();
      updateJob(jobId, {
        status: 'failed',
        error: err.message,
        statusText: 'Init failed: ' + err.message,
      });
    }
  };

  const runSfxUploadJob = async (
    jobId: string,
    file: File,
    meta: {
      title: string;
      description: string;
      showId: string;
      showTitle: string;
      seasonId?: string;
      seasonTitle?: string;
      tenant: 'tv' | 'fm';
    }
  ) => {
    const sanitizePathSegment = (s: string) =>
      s.trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'Untitled';

    const showTitle = sanitizePathSegment(meta.showTitle || 'Show');
    const seasonTitle = sanitizePathSegment(meta.seasonTitle || 'Season');
    const episodeTitle = sanitizePathSegment(meta.title || file.name.replace(/\.[^.]+$/, ''));
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';

    const uploadFilename = `${showTitle}/${seasonTitle}/${episodeTitle}${ext}`;
    const jobName = uploadFilename.replace(/\.[^.]+$/, '');

    updateJob(jobId, {
      sfxJobName: jobName,
      status: 'uploading',
      statusText: 'Uploading to SFX Server (0%)...',
    });

    const upload = new tus.Upload(file, {
      endpoint: 'https://upload.solofx.net/files',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 50 * 1024 * 1024,
      metadata: {
        filename: uploadFilename,
        tenant: (meta.tenant === 'fm'
          ? process.env.NEXT_PUBLIC_SFX_TENANT_FM || ''
          : process.env.NEXT_PUBLIC_SFX_TENANT_TV || '').trim(),
        codec: 'av1',
      },
      storeFingerprintForResuming: true,
      onError: function (error) {
        console.error(`SFX upload error for job ${jobId}:`, error);
        delete tusUploadsRef.current[jobId];
        activeUploadIdsRef.current.delete(jobId);
        processQueue();
        updateJob(jobId, {
          status: 'failed',
          error: String(error),
          statusText: 'SFX upload failed: ' + error,
        });
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        const percentage = parseFloat(((bytesUploaded / bytesTotal) * 100).toFixed(1));
        updateJob(jobId, {
          progress: percentage,
          status: 'uploading',
          statusText: `Uploading to SFX Server (${percentage}%)...`,
        });
      },
      onSuccess: async function () {
        delete tusUploadsRef.current[jobId];
        activeUploadIdsRef.current.delete(jobId);
        processQueue();
        updateJob(jobId, {
          progress: 100,
          status: 'transcoding',
          statusText: 'Upload finished. Registering early episode...',
        });

        // Register episode early in Supabase
        let episodeRef: { id: string; seasonId: string } | null = null;
        try {
          const tenantPath = (meta.tenant === 'fm'
            ? process.env.NEXT_PUBLIC_SFX_TENANT_FM_PATH || ''
            : process.env.NEXT_PUBLIC_SFX_TENANT_TV_PATH || '').trim();
          const constructedUrl = `https://objects.solofx.net${tenantPath}/hls/${jobName.split('/').map(encodeURIComponent).join('/')}/index.m3u8`;
          const payload: Record<string, unknown> = {
            showId: meta.showId,
            videoUrl: constructedUrl,
            sfxJobName: jobName,
            title: meta.title,
            description: meta.description,
            published: false,
            processing: true,
          };
          if (meta.seasonId) payload.seasonId = meta.seasonId;
          else if (meta.seasonTitle) payload.seasonTitle = meta.seasonTitle;

          const res = await ondemandProxy('createSfxEpisode', payload);
          episodeRef = res.episode as { id: string; seasonId: string } | null;
        } catch (err: any) {
          console.error(`Failed to register early SFX episode for ${jobId}:`, err);
        }

        // Poll SFX transcode job
        updateJob(jobId, {
          status: 'transcoding',
          statusText: `Transcoding started on SFX (${jobName})...`,
        });

        let attempts = 0;
        while (attempts < 600) {
          await new Promise((r) => setTimeout(r, 3000));
          attempts++;
          try {
            const res = await fetch(`/api/sfx/jobs?name=${encodeURIComponent(jobName)}`);
            if (!res.ok) continue;
            const sfx = await res.json();
            const sfxStatus = sfx.status || '';
            const stage = sfx.stage || 'encoding';
            const stagePct = typeof sfx.stagePct === 'number' ? sfx.stagePct : 0;

            updateJob(jobId, {
              progress: stagePct > 0 ? stagePct : 100,
              statusText: `Transcoding on SFX (${stage}${sfx.current ? ' — ' + sfx.current : ''}${sfx.eta ? ' — ETA ' + sfx.eta : ''})...`,
            });

            if (sfxStatus === 'done') {
              let duration = 0;
              try {
                const durRes = await fetch(`/api/sfx/jobs?name=${encodeURIComponent(jobName)}&kind=duration`);
                if (durRes.ok) {
                  const dur = await durRes.json();
                  duration = typeof dur.duration === 'number' ? dur.duration : 0;
                }
              } catch (err) {
                console.error('SFX duration fetch error:', err);
              }

              const thumbnail = sfx.hlsUrl?.replace(/\/index\.m3u8$/, '/poster.jpg') || '';
              if (episodeRef) {
                await ondemandProxy('updateEpisode', {
                  showId: meta.showId,
                  seasonId: episodeRef.seasonId,
                  episodeId: episodeRef.id,
                  updates: {
                    videoUrl: sfx.hlsUrl || '',
                    thumbnail,
                    duration,
                    processing: false,
                  },
                });
              }

              updateJob(jobId, {
                status: 'done',
                progress: 100,
                statusText: 'Transcoding complete! Video ready.',
                completedAt: Date.now(),
              });
              queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
              return;
            }

            if (sfxStatus === 'failed') {
              if (episodeRef) {
                await ondemandProxy('updateEpisode', {
                  showId: meta.showId,
                  seasonId: episodeRef.seasonId,
                  episodeId: episodeRef.id,
                  updates: { processing: false },
                });
              }
              updateJob(jobId, {
                status: 'failed',
                statusText: `SFX transcoding failed for job "${jobName}".`,
              });
              return;
            }
          } catch (pollErr) {
            console.error('Error polling SFX job:', pollErr);
          }
        }

        updateJob(jobId, {
          status: 'failed',
          statusText: 'Timed out waiting for SFX transcode to complete.',
        });
      },
    });

    tusUploadsRef.current[jobId] = upload;
    upload.start();
  };

  const runExistingSfxJob = async (
    jobId: string,
    video: SfxVideo,
    meta: { title: string; description: string; showId: string; seasonId?: string; seasonTitle?: string }
  ) => {
    let duration = 0;
    try {
      const durRes = await fetch(`/api/sfx/jobs?name=${encodeURIComponent(video.name)}&kind=duration`);
      if (durRes.ok) {
        const dur = await durRes.json();
        duration = typeof dur.duration === 'number' ? dur.duration : 0;
      }
    } catch (err) {
      console.error('SFX duration fetch error:', err);
    }

    try {
      const episodePayload: Record<string, unknown> = {
        showId: meta.showId,
        videoUrl: video.hlsUrl || '',
        sfxJobName: video.name,
        title: meta.title,
        description: meta.description,
        duration,
        thumbnail: video.thumbUrl || '',
      };
      if (meta.seasonId) episodePayload.seasonId = meta.seasonId;
      else if (meta.seasonTitle) episodePayload.seasonTitle = meta.seasonTitle;

      await ondemandProxy('createSfxEpisode', episodePayload);
      updateJob(jobId, {
        status: 'done',
        progress: 100,
        statusText: 'Added successfully!',
        completedAt: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
    } catch (err: any) {
      updateJob(jobId, {
        status: 'failed',
        error: err.message,
        statusText: 'Failed: ' + err.message,
      });
    }
  };

  const runExistingBunnyJob = async (
    jobId: string,
    videoId: string,
    meta: { title: string; description: string; showId: string; seasonId?: string; seasonTitle?: string }
  ) => {
    try {
      const episodePayload: Record<string, unknown> = {
        showId: meta.showId,
        videoId,
        title: meta.title,
        description: meta.description,
        server: 'bunny',
      };
      if (meta.seasonId) episodePayload.seasonId = meta.seasonId;
      else if (meta.seasonTitle) episodePayload.seasonTitle = meta.seasonTitle;

      await ondemandProxy('createEpisodeFromBunnyUpload', episodePayload);
      updateJob(jobId, {
        status: 'done',
        progress: 100,
        statusText: 'Added successfully!',
        completedAt: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
    } catch (err: any) {
      updateJob(jobId, {
        status: 'failed',
        error: err.message,
        statusText: 'Failed: ' + err.message,
      });
    }
  };

  const runResumeUploadAction = async (jobId: string, file: File, pending: PendingUpload) => {
    try {
      const resumeCallable = httpsCallable(functions, 'resumeTusUpload');
      const resp = (await resumeCallable({ videoId: pending.videoId })) as any;
      const { expirationTime, signature } = resp.data;

      const upload = new tus.Upload(file, {
        uploadUrl: `https://video.bunnycdn.com/tusupload/${pending.videoId.replace(/-/g, '')}`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: expirationTime.toString(),
          VideoId: pending.videoId,
          LibraryId: '307069',
        },
        metadata: {
          filename: pending.fileName,
          filetype: pending.fileType,
          title: pending.title,
          collection: '',
        },
        onError: function (error) {
          console.error('Resume failed:', error);
          delete tusUploadsRef.current[jobId];
          activeUploadIdsRef.current.delete(jobId);
          processQueue();
          const msg = error?.message || String(error);
          const code = msg.match(/response code: (\d+)/)?.[1];
          if (code === '404') {
            console.warn('[resumeUpload] upload session gone, finalizing episode:', pending.videoId);
            ondemandProxy('createEpisodeFromBunnyUpload', {
              showId: pending.showId,
              videoId: pending.videoId,
              title: pending.title,
              description: pending.description || '',
              seasonId: pending.seasonId,
              seasonTitle: pending.seasonTitle,
              server: 'bunny',
            })
              .then(() => {
                removePendingUpload(pending.videoId);
                updateJob(jobId, { status: 'done', progress: 100, statusText: 'Finalized!' });
                queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
              })
              .catch((err) => {
                updateJob(jobId, { status: 'failed', statusText: 'Finalize failed: ' + err.message });
              });
            return;
          }
          updateJob(jobId, { status: 'failed', statusText: 'Resume paused: ' + msg });
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = parseFloat(((bytesUploaded / bytesTotal) * 100).toFixed(1));
          updateJob(jobId, {
            progress: percentage,
            status: 'uploading',
            statusText: `Resuming upload (${percentage}%)...`,
          });
        },
        onSuccess: async function () {
          delete tusUploadsRef.current[jobId];
          activeUploadIdsRef.current.delete(jobId);
          processQueue();
          try {
            await ondemandProxy('createEpisodeFromBunnyUpload', {
              showId: pending.showId,
              videoId: pending.videoId,
              title: pending.title,
              description: pending.description || '',
              seasonId: pending.seasonId,
              seasonTitle: pending.seasonTitle,
              server: 'bunny',
            });
            removePendingUpload(pending.videoId);
            updateJob(jobId, {
              status: 'done',
              progress: 100,
              statusText: 'Resumed upload completed!',
              completedAt: Date.now(),
            });
            queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
          } catch (err: any) {
            updateJob(jobId, { status: 'failed', statusText: 'Failed: ' + err.message });
          }
        },
      });

      tusUploadsRef.current[jobId] = upload;
      upload.start();
    } catch (e: any) {
      console.error('Resume setup failed:', e);
      delete tusUploadsRef.current[jobId];
      activeUploadIdsRef.current.delete(jobId);
      processQueue();
      updateJob(jobId, { status: 'failed', statusText: 'Resume setup failed: ' + e.message });
    }
  };

  const resumeUpload = async (pending: PendingUpload) => {
    const file = fileRef.current;
    if (!file) {
      alert(`Please re-select the file "${pending.fileName}" (the same file) to resume it.`);
      return;
    }
    const jobId = `resume_${pending.videoId}_${Date.now()}`;
    const canStartImmediately = activeUploadIdsRef.current.size < MAX_CONCURRENT_UPLOADS;
    const runner = () => {
      runResumeUploadAction(jobId, file, pending);
    };

    const job: UploadJob = {
      id: jobId,
      title: pending.title,
      description: pending.description || '',
      fileName: pending.fileName,
      fileSize: file.size,
      showId: pending.showId,
      showTitle: data?.documents.find((d) => d.id === pending.showId)?.title || 'Show',
      seasonId: pending.seasonId,
      seasonTitle: pending.seasonTitle,
      server: 'bunny',
      bunnyVideoId: pending.videoId,
      status: canStartImmediately ? 'initiating' : 'queued',
      progress: 0,
      statusText: canStartImmediately
        ? 'Resuming Bunny upload...'
        : `Queued (#${queueOrderRef.current.length + 1} in queue) — waiting for an upload slot...`,
      startedAt: Date.now(),
    };
    setUploadJobs((prev) => [job, ...prev]);

    if (canStartImmediately) {
      activeUploadIdsRef.current.add(jobId);
      runner();
    } else {
      queueOrderRef.current.push(jobId);
      queuedRunnersRef.current.set(jobId, runner);
    }
  };

  const handleCreateShow = async () => {
    if (!newShowTitle.trim()) {
      alert('Please enter a show title.');
      return;
    }
    try {
      const res = await ondemandProxy('createShow', { title: newShowTitle.trim() });
      const show = res.show;
      setSelectedCollectionId(show.id);
      setNewShowMode(false);
      setNewShowTitle('');
      await queryClient.refetchQueries({ queryKey: ['onDemandData'] });
    } catch (err) {
      console.error('Failed to create show:', err);
      alert(`Failed to create show: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenEditDialog = (video: OnDemandContent) => {
    setCurrentVideo(video);
    setEditTitle(video.title || '');
    setEditDescription(video.description || '');
    setEditPublished(video.published !== false);
    setEditPoster16x9(video.posterUrl16x9 || '');
    setEditPoster2x3(video.posterUrl2x3 || '');
    setEditDialogOpen(true);
  };

  const handlePosterUpload = async (aspect: '16x9' | '2x3') => {
    if (!currentVideo) return;
    const fileInput = aspect === '16x9' ? poster16x9InputRef : poster2x3InputRef;
    const file = fileInput.current?.files?.[0];
    if (!file) return;

    setUploadingPosterAspect(aspect);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });

      const uploadResult = await ondemandProxy('uploadPoster', {
        showId: currentVideo.id,
        aspect,
        imageBase64: base64,
      });

      const url = uploadResult.url;
      if (aspect === '16x9') setEditPoster16x9(url);
      else setEditPoster2x3(url);
    } catch (error: any) {
      console.error('Poster upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingPosterAspect(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!currentVideo) return;

    try {
      await ondemandProxy('updateShow', {
        showId: currentVideo.id,
        updates: {
          title: editTitle,
          description: editDescription,
          published: editPublished,
          posterUrl16x9: editPoster16x9,
          posterUrl2x3: editPoster2x3,
        },
      });
      alert('Show updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
      setEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating show:', error);
      alert(`Failed to update show: ${error.message}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;

    try {
      await ondemandProxy('deleteShow', { showId: videoToDelete.id });
      alert('Show deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
      setDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting show:', error);
      alert(`Failed to delete show: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48 bg-white/20" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="frosted-glass overflow-hidden">
              <Skeleton className="aspect-video w-full bg-white/20" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/20" />
                <Skeleton className="h-3 w-1/2 bg-white/20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div className="p-8 text-center text-red-300">Error: {error.message}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">On Demand Videos</h1>
          <p className="mt-2 text-white/70">Upload and manage on-demand content</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-xl border border-blue-500/20 rounded-xl">
        <button
          type="button"
          className="flex items-center gap-3 w-full p-6 text-left"
          onClick={() => setUploadSectionOpen((prev) => !prev)}
        >
          <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
            <HugeiconsIcon icon={CloudUploadIcon} size={22} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white">Upload New Video</h2>
            <p className="text-sm text-white/50">Upload a video file to any show</p>
          </div>
          {activeJobCount > 0 && (
            <span className="text-xs text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded-full px-2.5 py-0.5 mr-2">
              {activeUploadsCount > 0 ? `${activeUploadsCount}/3 uploading` : ''}
              {queuedJobsCount > 0 ? `${activeUploadsCount > 0 ? ' · ' : ''}${queuedJobsCount} queued` : ''}
              {transcodingJobsCount > 0 ? `${activeUploadsCount > 0 || queuedJobsCount > 0 ? ' · ' : ''}${transcodingJobsCount} transcoding` : ''}
            </span>
          )}
          <ChevronDown
            size={20}
            className={`text-white/50 transition-transform duration-200 ${uploadSectionOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {uploadSectionOpen && (
        <div className="px-6 pb-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white/80">Upload Server</Label>
            <Select
              value={uploadServer}
              onValueChange={(v) => {
                setUploadServer(v as 'bunny' | 'sfx');
                setSelectedVideoFromBunny(null);
                setSelectedSfxVideo(null);
              }}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-white/10">
                <SelectItem value="bunny" className="text-white">Bunny CDN</SelectItem>
                <SelectItem value="sfx" className="text-white">SFX Server (solofx.net)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-white/40">
              {uploadServer === 'sfx'
                ? 'Uploads to upload.solofx.net and transcodes to AV1.'
                : 'Uploads to the Bunny CDN video library.'}
            </p>
          </div>

          {uploadServer === 'sfx' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/80">Tenant</Label>
              <Select
                value={sfxTenant}
                onValueChange={(v) => setSfxTenant(v as 'tv' | 'fm')}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-white/10">
                  <SelectItem value="tv" className="text-white">Salt TV</SelectItem>
                  <SelectItem value="fm" className="text-white">Salt FM</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-white/40">
                Uploads are routed into {sfxTenant === 'fm' ? 'the Salt FM' : 'the Salt TV'} container.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/80">Show</Label>
              {!newShowMode ? (
                <div className="flex gap-2">
                  <Select
                    value={selectedCollectionId || ''}
                    onValueChange={setSelectedCollectionId}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 flex-1">
                      <SelectValue placeholder="Select a show" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/10">
                      {data?.documents.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id} className="text-white">
                          {doc.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-white border-white/10 hover:bg-white/10 shrink-0 h-10"
                    onClick={() => setNewShowMode(true)}
                  >
                    <HugeiconsIcon icon={AddCircleIcon} size={14} className="mr-1" />
                    New
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Show title (e.g. The Gang)"
                    value={newShowTitle}
                    onChange={(e) => setNewShowTitle(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder-white/40 h-10"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-white border-white/10 hover:bg-white/10 shrink-0 h-10"
                    onClick={handleCreateShow}
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-white border-white/10 hover:bg-white/10 shrink-0 h-10"
                    onClick={() => { setNewShowMode(false); setNewShowTitle(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {!videoFile ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white/80">Video File</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center h-10 rounded-lg border-2 border-dashed border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-400/40 cursor-pointer transition-all"
                >
                  <p className="text-xs text-white/40">Click to select a video file</p>
                </div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white/80">Video File</Label>
                <div className="flex items-center gap-3 h-10 px-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <HugeiconsIcon icon={Video01Icon} size={16} className="text-green-400 shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{videoFile.name}</span>
                  <button
                    onClick={() => { setVideoFile(null); setSelectedVideoFromBunny(null); setSelectedSfxVideo(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-white/40 hover:text-white/80 text-xs shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
            {selectedCollectionId && selectedShow?.bunnyGuid && !videoFile && uploadServer === 'bunny' && (
              <div className="space-y-2 col-span-full">
                <Label className="text-sm font-medium text-white/80">Or select from existing videos</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg bg-white/5 border border-white/10">
                  {loadingBunnyVideos ? (
                    <p className="text-xs text-white/40 col-span-full text-center py-4">Loading videos...</p>
                  ) : bunnyVideos?.length === 0 ? (
                    <p className="text-xs text-white/40 col-span-full text-center py-4">No existing videos in this collection</p>
                  ) : (
                    bunnyVideos?.map((v: any) => (
                      <button
                        key={v.guid}
                        onClick={() => { setSelectedVideoFromBunny(v.guid); setSelectedSfxVideo(null); setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className={`text-left p-2 rounded-lg border transition-all ${
                          selectedVideoFromBunny === v.guid
                            ? 'border-blue-400 bg-blue-500/20'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-xs text-white truncate">{v.title}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            {selectedCollectionId && uploadServer === 'sfx' && !videoFile && (
              <div className="space-y-2 col-span-full">
                <Label className="text-sm font-medium text-white/80">Or select from existing SFX videos</Label>
                <Input
                  value={sfxSearch}
                  onChange={(e) => setSfxSearch(e.target.value)}
                  placeholder={`Search ${sfxVideos?.length || 0} videos...`}
                  className="bg-white/5 border-white/10 text-white placeholder-white/40 h-9"
                />
                <div className="max-h-56 overflow-y-auto p-2 rounded-lg bg-white/5 border border-white/10">
                  {loadingSfxVideos ? (
                    <p className="text-xs text-white/40 text-center py-4">Loading videos...</p>
                  ) : sfxVideos?.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-4">No published SFX videos</p>
                  ) : (
                    sfxVideos
                      ?.filter((v) => v.name.toLowerCase().includes(sfxSearch.trim().toLowerCase()))
                      .map((v: SfxVideo) => (
                        <button
                          key={v.name}
                          onClick={() => {
                            setSelectedSfxVideo(v);
                            setSelectedVideoFromBunny(null);
                            setVideoFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                            if (!videoTitle) setVideoTitle(v.name);
                          }}
                          className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg border transition-all ${
                            selectedSfxVideo?.name === v.name
                              ? 'border-blue-400 bg-blue-500/20'
                              : 'border-transparent hover:border-white/10 hover:bg-white/5'
                          }`}
                        >
                          {v.thumbUrl && (
                            <img
                              src={v.thumbUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-12 h-8 object-cover rounded shrink-0"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                          <span className="text-xs text-white truncate flex-1 text-left">{v.name}</span>
                        </button>
                      ))
                  )}
                  {sfxSearch && sfxVideos && sfxVideos.filter((v) => v.name.toLowerCase().includes(sfxSearch.trim().toLowerCase())).length === 0 && (
                    <p className="text-xs text-white/40 text-center py-4">No videos match "{sfxSearch}"</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedCollectionId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white/80">
                  Season
                  {seasonLoading && <span className="ml-2 text-xs text-white/50">Loading...</span>}
                </Label>
                {!newSeasonMode ? (
                  <div className="flex gap-2">
                    <Select
                      value={selectedSeasonId || ''}
                      onValueChange={setSelectedSeasonId}
                      disabled={seasonLoading || seasons.length === 0}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 flex-1">
                        <SelectValue placeholder={seasonLoading ? 'Loading...' : 'Select a season'} />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10">
                        {seasons.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-white">
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-white border-white/10 hover:bg-white/10 shrink-0 h-10"
                      onClick={() => setNewSeasonMode(true)}
                    >
                      <HugeiconsIcon icon={AddCircleIcon} size={14} className="mr-1" />
                      New
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Season name (e.g. Season 2)"
                      value={newSeasonTitle}
                      onChange={(e) => setNewSeasonTitle(e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder-white/40 h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-white border-white/10 hover:bg-white/10 shrink-0 h-10"
                      onClick={() => { setNewSeasonMode(false); setNewSeasonTitle(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-white/80">Video Title</Label>
                <Input
                  id="title"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="Enter video title"
                  className="bg-white/5 border-white/10 text-white placeholder-white/40 h-10"
                />
              </div>
            </div>
          )}

          {selectedCollectionId && (
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-white/80">Description</Label>
              <Input
                id="description"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                placeholder="Brief description of the video"
                className="bg-white/5 border-white/10 text-white placeholder-white/40 h-10"
              />
            </div>
          )}

          {/* Active & Recent Upload Jobs List */}
          {uploadJobs.length > 0 && (
            <div className="space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      activeUploadsCount > 0
                        ? 'bg-blue-400 animate-pulse'
                        : queuedJobsCount > 0
                        ? 'bg-amber-400'
                        : 'bg-white/40'
                    }`}
                  />
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    Upload & Transcode Tasks ({activeUploadsCount}/3 active uploads
                    {queuedJobsCount > 0 ? ` · ${queuedJobsCount} queued` : ''}
                    {transcodingJobsCount > 0 ? ` · ${transcodingJobsCount} transcoding` : ''})
                  </h3>
                </div>
                {uploadJobs.some((j) => j.status === 'done' || j.status === 'failed') && (
                  <button
                    onClick={clearFinishedJobs}
                    className="text-xs text-white/50 hover:text-white transition"
                  >
                    Clear finished
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {uploadJobs.map((job) => {
                  const isQueued = job.status === 'queued';
                  const isRunning = job.status === 'uploading' || job.status === 'initiating' || job.status === 'transcoding';
                  const isDone = job.status === 'done';
                  const isFailed = job.status === 'failed';

                  return (
                    <div
                      key={job.id}
                      className={`p-3 rounded-lg border transition ${
                        isDone
                          ? 'bg-green-950/20 border-green-500/30'
                          : isFailed
                          ? 'bg-red-950/20 border-red-500/30'
                          : isQueued
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                job.server === 'bunny' ? 'bg-orange-500/20 text-orange-300' : 'bg-purple-500/20 text-purple-300'
                              }`}
                            >
                              {job.server === 'bunny' ? 'Bunny CDN' : 'SFX'}
                            </span>
                            {isQueued && (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Queued
                              </span>
                            )}
                            <span className="text-sm font-medium text-white truncate">{job.title}</span>
                            {job.fileSize > 0 && (
                              <span className="text-xs text-white/40 shrink-0">
                                ({(job.fileSize / (1024 * 1024)).toFixed(1)} MB)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-white/50 truncate">
                            {job.showTitle} → {job.seasonTitle || 'Season'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(isRunning || isQueued) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelJob(job.id)}
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                            >
                              Cancel
                            </Button>
                          )}
                          {(isDone || isFailed) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeJob(job.id)}
                              className="h-7 text-xs text-white/40 hover:text-white px-2"
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDone
                                ? 'bg-green-500'
                                : isFailed
                                ? 'bg-red-500'
                                : isQueued
                                ? 'bg-amber-400/40'
                                : 'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                            style={{ width: `${isQueued ? 0 : Math.min(100, Math.max(0, job.progress))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={`truncate max-w-[80%] ${
                              isDone
                                ? 'text-green-400'
                                : isFailed
                                ? 'text-red-400'
                                : isQueued
                                ? 'text-amber-300'
                                : 'text-white/60'
                            }`}
                          >
                            {job.statusText}
                          </span>
                          <span className="font-mono text-white/70">
                            {isQueued ? 'In Queue' : `${job.progress}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingUploads.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white/80">Pending uploads</h3>
              {pendingUploads.map((p) => (
                <div key={p.videoId} className="bg-white/5 border border-amber-500/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{p.fileName}</div>
                      <div className="text-xs text-white/50">→ {p.title} (started {new Date(p.startedAt).toLocaleString()})</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => resumeUpload(p)}
                        className="bg-amber-600 hover:bg-amber-700 text-white h-8"
                      >
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removePendingUpload(p.videoId)}
                        className="h-8"
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleUpload}
              disabled={(!videoFile && !selectedVideoFromBunny && !selectedSfxVideo) || !selectedCollectionId || !videoTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
            >
              <HugeiconsIcon icon={CloudUploadIcon} size={16} className="mr-2" />
              {selectedVideoFromBunny || selectedSfxVideo
                ? 'Save Episode'
                : activeUploadsCount >= 3
                ? 'Queue Upload (Limit 3)'
                : uploadJobs.length > 0
                ? 'Start Upload'
                : 'Start Upload'}
            </Button>
            {videoFile && (
              <span className="text-xs text-white/40">
                Selected: {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(1)} MB)
              </span>
            )}
            {selectedVideoFromBunny && (
              <span className="text-xs text-green-400/60">Existing Bunny video selected</span>
            )}
            {selectedSfxVideo && (
              <span className="text-xs text-green-400/60">Existing SFX video selected</span>
            )}
          </div>
        </div>
        )}
      </div>

      {uploadServer === 'sfx' && sfxActiveJobs && sfxActiveJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <h3 className="text-lg font-semibold text-white">Transcoding on SFX</h3>
          </div>
          {sfxActiveJobs.map((job) => {
            const pct = job.status === 'queued'
              ? 0
              : job.stagePct || Math.round(((job.step || 0) / (job.total || 1)) * 100);
            return (
              <div key={job.name + (job.hlsUrl || '')} className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-white font-medium truncate">{sfxJobDisplayName(job)}</span>
                  <span className="text-xs text-white/50 shrink-0">
                    {job.status === 'queued'
                      ? 'Queued'
                      : `${job.stage || 'encoding'}${job.current ? ' — ' + job.current : ''}${job.eta ? ' — ETA ' + job.eta : ''}`}
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-white/40">
                  <span>Step {job.step || 0}/{job.total || 0}</span>
                  <span>
                    {job.elapsed != null && `${Math.floor(job.elapsed / 60)}m ${String(job.elapsed % 60).padStart(2, '0')}s`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.documents && data.documents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.documents.map((item: OnDemandContent) => (
            <div key={item.id} className="group relative">
              <OnDemandCard
                image={item.image}
                title={item.title}
                description={item.description}
                link={`/ondemand/${item.id}`}
              />
<div className="absolute top-2 right-2 flex gap-1">
                <button
                  className="flex size-8 items-center justify-center rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  onClick={() => handleOpenEditDialog(item)}
                  title="Edit"
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} color="white" />
                </button>
                {!isModerator && (
                  <button
                    className="flex size-8 items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
                    onClick={() => {
                      setVideoToDelete(item);
                      setDeleteDialogOpen(true);
                    }}
                    title="Delete"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} color="white" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="frosted-glass text-center py-12 text-white/50 border-dashed border-white/20">
          No on-demand content available.
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Show Details</DialogTitle>
            <DialogDescription>
              Update the metadata for this show.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input 
                id="edit-title" 
                value={editTitle} 
                onChange={(e) => setEditTitle(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input 
                id="edit-description" 
                value={editDescription} 
                onChange={(e) => setEditDescription(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-poster16x9">Poster 16:9 (landscape)</Label>
              <div className="flex gap-2">
                <Input 
                  id="edit-poster16x9" 
                  value={editPoster16x9} 
                  onChange={(e) => setEditPoster16x9(e.target.value)}
                  placeholder="https://..." 
                  className="flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={poster16x9InputRef}
                  className="hidden"
                  onChange={() => handlePosterUpload('16x9')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingPosterAspect === '16x9'}
                  onClick={() => poster16x9InputRef.current?.click()}
                  className="shrink-0"
                >
                  {uploadingPosterAspect === '16x9' ? '...' : 'Upload'}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-poster2x3">Poster 2:3 (portrait)</Label>
              <div className="flex gap-2">
                <Input 
                  id="edit-poster2x3" 
                  value={editPoster2x3} 
                  onChange={(e) => setEditPoster2x3(e.target.value)}
                  placeholder="https://..." 
                  className="flex-1"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={poster2x3InputRef}
                  className="hidden"
                  onChange={() => handlePosterUpload('2x3')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingPosterAspect === '2x3'}
                  onClick={() => poster2x3InputRef.current?.click()}
                  className="shrink-0"
                >
                  {uploadingPosterAspect === '2x3' ? '...' : 'Upload'}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-published"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-white/10 text-blue-600"
              />
              <Label htmlFor="edit-published" className="cursor-pointer">Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{videoToDelete?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Delete Show</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OndemandPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <OndemandContent />
    </QueryClientProvider>
  );
}