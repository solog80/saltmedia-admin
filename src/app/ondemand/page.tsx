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
const functionsEu = getFunctions(app, 'europe-west1');
const queryClient = new QueryClient();

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
      setVideoTitle(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if ((!videoFile && !selectedVideoFromBunny) || !selectedCollectionId || !videoTitle) {
      alert('Please select a file (or existing video), a show, and provide a title.');
      return;
    }
    if (!selectedSeasonId && !newSeasonTitle) {
      alert('Please select a season or enter a new season name.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

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

      const uploadCallable = httpsCallable(functionsEu, 'uploadShowPoster');
      const result = await uploadCallable({
        showId: currentVideo.id,
        aspect,
        imageBase64: base64,
      }) as any;

      const url = result.data.url;
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
      const updateShowCallable = httpsCallable(functionsEu, 'updateOnDemandShow');
      await updateShowCallable({
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
      const deleteShowCallable = httpsCallable(functionsEu, 'deleteOnDemandShow');
      await deleteShowCallable({ showId: videoToDelete.id });
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white/80">Show</Label>
              <Select
                value={selectedCollectionId || ''}
                onValueChange={setSelectedCollectionId}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
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
                    onClick={() => { setVideoFile(null); setSelectedVideoFromBunny(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-white/40 hover:text-white/80 text-xs shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
            {selectedCollectionId && selectedShow?.bunnyGuid && !videoFile && (
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
                        onClick={() => { setSelectedVideoFromBunny(v.guid); setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
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
                <span>Uploading to Bunny CDN...</span>
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
              disabled={isUploading || (!videoFile && !selectedVideoFromBunny)}
              className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
            >
              <HugeiconsIcon icon={CloudUploadIcon} size={16} className="mr-2" />
              {isUploading ? 'Uploading...' : selectedVideoFromBunny ? 'Save' : 'Start Upload'}
            </Button>
            {videoFile && !isUploading && (
              <span className="text-xs text-white/40">{videoFile.name}</span>
            )}
            {selectedVideoFromBunny && !isUploading && (
              <span className="text-xs text-green-400/60">Existing video selected</span>
            )}
          </div>
        </div>
      </div>

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