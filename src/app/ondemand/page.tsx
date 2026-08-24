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

// HugeIcons
import { HugeiconsIcon } from '@hugeicons/react';
import PencilEdit01Icon from '@hugeicons/core-free-icons/dist/esm/PencilEdit01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/dist/esm/Delete02Icon';
import CloudUploadIcon from '@hugeicons/core-free-icons/dist/esm/CloudUploadIcon';
import Video01Icon from '@hugeicons/core-free-icons/dist/esm/Video01Icon';
import AddCircleIcon from '@hugeicons/core-free-icons/dist/esm/AddCircleIcon';

const functions = getFunctions(app, 'us-central1');
const queryClient = new QueryClient();

/** Call an on-demand admin operation via the server-side proxy. */
async function ondemandProxy(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch('/api/ondemand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `On-demand ${action} failed (${res.status})`);
  }
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
      setVideoFile(file);
      setSelectedVideoFromBunny(null);
      setSelectedSfxVideo(null);
      setVideoTitle(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if ((!videoFile && !selectedVideoFromBunny && !selectedSfxVideo) || !selectedCollectionId || !videoTitle) {
      alert('Please select a file (or existing video), a show, and provide a title.');
      return;
    }
    if (!selectedSeasonId && !newSeasonTitle) {
      alert('Please select a season or enter a new season name.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    if (uploadServer === 'sfx') {
      if (selectedSfxVideo) {
        await createSfxEpisodeFromExisting(selectedSfxVideo);
        return;
      }
      if (!videoFile) {
        alert('Please select a video file to upload to the SFX server.');
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }
      startSfxUpload();
      return;
    }

    try {
      let videoId = selectedVideoFromBunny;

      if (videoFile && !selectedVideoFromBunny) {
        // Upload new video via TUS
        const createTusUploadCallable = httpsCallable(functions, 'createTusUpload');

        const resp = await createTusUploadCallable({
          title: videoTitle,
          collectionId: selectedCollectionId,
        }) as any;

        videoId = resp.data.videoId;
        const { expirationTime, signature } = resp.data;

        const upload = new tus.Upload(videoFile, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            'AuthorizationSignature': signature,
            'AuthorizationExpire': expirationTime.toString(),
            'VideoId': videoId,
            'LibraryId': '307069',
          },
          metadata: {
            filename: videoFile.name,
            filetype: videoFile.type,
            title: videoTitle,
            collection: selectedCollectionId,
          },
          onError: function (error) {
            console.error("Failed because: " + error);
            alert("Upload failed: " + error);
            setIsUploading(false);
            setUploadProgress(0);
          },
          onProgress: function (bytesUploaded, bytesTotal) {
            const percentage = (bytesUploaded / bytesTotal * 100).toFixed(1);
            setUploadProgress(parseFloat(percentage));
          },
          onSuccess: async function () {
            await createEpisode(videoId);
          }
        });

        upload.start();
        return;
      }

      // Selected existing video — skip TUS, create episode directly
      await createEpisode(videoId!);

    } catch (error: any) {
      console.error('Error during upload process:', error);
      alert(`Upload failed: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const startSfxUpload = () => {
    if (!videoFile) return;

    const sanitizePathSegment = (s: string) =>
      s.trim().replace(/[\\/:*?"<>|\s]+/g, '_') || 'Untitled';

    // Build the SFX file path from the on-demand hierarchy (show/season/episode).
    // Folders in the filename metadata become collections on the server.
    const showTitle = sanitizePathSegment(selectedShow?.title || 'Show');
    const seasonTitle = sanitizePathSegment(
      newSeasonMode && newSeasonTitle
        ? newSeasonTitle
        : (seasons.find((s) => s.id === selectedSeasonId)?.title || 'Season')
    );
    const episodeTitle = sanitizePathSegment(
      videoTitle || videoFile.name.replace(/\.[^.]+$/, '')
    );
    const ext = videoFile.name.includes('.')
      ? '.' + videoFile.name.split('.').pop()
      : '';

    const uploadFilename = `${showTitle}/${seasonTitle}/${episodeTitle}${ext}`;
    const jobName = uploadFilename.replace(/\.[^.]+$/, '');

    const upload = new tus.Upload(videoFile, {
      endpoint: 'https://upload.solofx.net/files',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 50 * 1024 * 1024,
      metadata: {
        filename: uploadFilename,
        tenant: (sfxTenant === 'fm'
          ? process.env.NEXT_PUBLIC_SFX_TENANT_FM || ''
          : process.env.NEXT_PUBLIC_SFX_TENANT_TV || '').trim(),
        codec: 'av1',
      },
      storeFingerprintForResuming: true,
      onError: function (error) {
        console.error('SFX upload failed:', error);
        alert('SFX upload failed: ' + error);
        setIsUploading(false);
        setUploadProgress(0);
        setSfxStatusText(null);
      },
      onProgress: function (bytesUploaded, bytesTotal) {
        const percentage = (bytesUploaded / bytesTotal * 100).toFixed(1);
        setUploadProgress(parseFloat(percentage));
      },
      onSuccess: async function () {
        const episodeRef = await createSfxEpisodeEarly(jobName);
        pollSfxJob(jobName, episodeRef);
      }
    });

    upload.start();
  };

  const createSfxEpisodeEarly = async (jobName: string) => {
    const tenantPath = (sfxTenant === 'fm'
      ? process.env.NEXT_PUBLIC_SFX_TENANT_FM_PATH || ''
      : process.env.NEXT_PUBLIC_SFX_TENANT_TV_PATH || '').trim();
    const constructedUrl = `https://objects.solofx.net${tenantPath}/hls/${jobName.split('/').map(encodeURIComponent).join('/')}/index.m3u8`;
    try {
      const payload: Record<string, unknown> = {
        showId: selectedCollectionId,
        videoUrl: constructedUrl,
        sfxJobName: jobName,
        title: videoTitle,
        description: videoDescription,
        published: false,
        processing: true,
      };
      if (newSeasonMode && newSeasonTitle) {
        payload.seasonTitle = newSeasonTitle;
      } else if (selectedSeasonId) {
        payload.seasonId = selectedSeasonId;
      }
      const res = await ondemandProxy('createSfxEpisode', payload);
      return res.episode as { id: string; seasonId: string } | null;
    } catch (err) {
      console.error('Failed to create SFX episode early:', err);
      return null;
    }
  };

  const updateSfxEpisode = async (
    episodeRef: { id: string; seasonId: string } | null,
    updates: Record<string, unknown>
  ) => {
    if (!episodeRef) return;
    try {
      await ondemandProxy('updateEpisode', {
        showId: selectedCollectionId,
        seasonId: episodeRef.seasonId,
        episodeId: episodeRef.id,
        updates,
      });
    } catch (err) {
      console.error('Failed to update SFX episode:', err);
    }
  };

  const pollSfxJob = async (jobName: string, episodeRef?: { id: string; seasonId: string } | null) => {
    setSfxStatusText(`Transcoding started (${jobName})...`);
    let attempts = 0;
    while (attempts < 600) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;
      try {
        const res = await fetch(`/api/sfx/jobs?name=${encodeURIComponent(jobName)}`);
        if (!res.ok) continue;
        const job = await res.json();
        const status = job.status || '';
        const stage = job.stage || 'encoding';
        const stagePct = typeof job.stagePct === 'number' ? job.stagePct : 0;

        setSfxStatusText(
          `Transcoding on SFX (${stage}${job.current ? ' — ' + job.current : ''}${job.eta ? ' — ETA ' + job.eta : ''})...`
        );
        if (stagePct > 0) setUploadProgress(stagePct);

        if (status === 'done') {
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
          const thumbnail = job.hlsUrl?.replace(/\/index\.m3u8$/, '/poster.jpg') || '';
          if (episodeRef) {
            await updateSfxEpisode(episodeRef, {
              videoUrl: job.hlsUrl || '',
              thumbnail,
              duration,
              processing: false,
            });
          } else {
            await createSfxEpisode(jobName, job.hlsUrl || '', duration, thumbnail);
          }
          alert('Video uploaded and added successfully!');
          resetSfxUploadState();
          return;
        }
        if (status === 'failed') {
          if (episodeRef) {
            await updateSfxEpisode(episodeRef, { processing: false });
          }
          alert(`SFX transcoding failed for job "${jobName}".`);
          resetSfxUploadState();
          return;
        }
      } catch (err) {
        console.error('SFX job polling error:', err);
      }
    }
    alert('Timed out waiting for SFX transcode to complete. Check the SFX admin for job status.');
    resetSfxUploadState();
  };

  const createSfxEpisode = async (jobName: string, hlsUrl: string, duration: number, thumbnail: string, titleOverride?: string) => {
    try {
      const episodePayload: Record<string, unknown> = {
        showId: selectedCollectionId,
        videoUrl: hlsUrl,
        sfxJobName: jobName,
        title: titleOverride || videoTitle,
        description: videoDescription,
        duration,
        thumbnail,
      };
      if (newSeasonMode && newSeasonTitle) {
        episodePayload.seasonTitle = newSeasonTitle;
      } else if (selectedSeasonId) {
        episodePayload.seasonId = selectedSeasonId;
      }
      await ondemandProxy('createSfxEpisode', episodePayload);
    } catch (episodeError) {
      console.error('Failed to create SFX episode record:', episodeError);
    }
    alert('Video uploaded and added successfully!');
    resetSfxUploadState();
  };

  const resetSfxUploadState = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setSfxStatusText(null);
    setVideoFile(null);
    setSelectedVideoFromBunny(null);
    setSelectedSfxVideo(null);
    setVideoTitle('');
    setVideoDescription('');
    setNewSeasonMode(false);
    setNewSeasonTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
  };

  const createSfxEpisodeFromExisting = async (video: SfxVideo) => {
    setIsUploading(true);
    setUploadProgress(0);
    setSfxStatusText(`Adding "${video.name}"...`);

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

    if (!videoTitle) {
      setVideoTitle(video.name);
    }
    await createSfxEpisode(video.name, video.hlsUrl || '', duration, video.thumbUrl || '', videoTitle || video.name);
  };

  const createEpisode = async (videoId: string) => {
    try {
      const createEpisodeCallable = httpsCallable(functions, 'createEpisodeFromBunnyUpload');
      const episodePayload: any = {
        showId: selectedCollectionId,
        videoId: videoId,
        title: videoTitle,
        description: videoDescription,
      };
      if (newSeasonMode && newSeasonTitle) {
        episodePayload.seasonTitle = newSeasonTitle;
      } else if (selectedSeasonId) {
        episodePayload.seasonId = selectedSeasonId;
      }
      await createEpisodeCallable(episodePayload);
    } catch (episodeError) {
      console.error('Failed to create episode record:', episodeError);
    }
    alert('Video added successfully!');
    setIsUploading(false);
    setUploadProgress(0);
    setVideoFile(null);
    setSelectedVideoFromBunny(null);
    setVideoTitle('');
    setVideoDescription('');
    setNewSeasonMode(false);
    setNewSeasonTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    queryClient.invalidateQueries({ queryKey: ['onDemandData'] });
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

      <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 backdrop-blur-xl border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
            <HugeiconsIcon icon={CloudUploadIcon} size={22} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Upload New Video</h2>
            <p className="text-sm text-white/50">Upload a video file to any show</p>
          </div>
        </div>

        <div className="space-y-5">
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

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white/60">
                <span>
                  {uploadServer === 'sfx' && sfxStatusText
                    ? sfxStatusText
                    : `Uploading to ${uploadServer === 'sfx' ? 'SFX Server' : 'Bunny CDN'}...`}
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading || (!videoFile && !selectedVideoFromBunny && !selectedSfxVideo)}
              className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
            >
              <HugeiconsIcon icon={CloudUploadIcon} size={16} className="mr-2" />
              {isUploading ? 'Uploading...' : selectedVideoFromBunny || selectedSfxVideo ? 'Save' : 'Start Upload'}
            </Button>
            {videoFile && !isUploading && (
              <span className="text-xs text-white/40">{videoFile.name}</span>
            )}
            {selectedVideoFromBunny && !isUploading && (
              <span className="text-xs text-green-400/60">Existing video selected</span>
            )}
            {selectedSfxVideo && !isUploading && (
              <span className="text-xs text-green-400/60">Existing SFX video selected</span>
            )}
          </div>
        </div>
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
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-8 bg-blue-600/80 hover:bg-blue-700 text-white"
                  onClick={() => handleOpenEditDialog(item)}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
                </Button>
                {!isModerator && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="size-8 bg-red-600/80 hover:bg-red-700 text-white"
                    onClick={() => {
                      setVideoToDelete(item);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </Button>
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