'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, QueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { ChevronLeft, Play, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchOnDemandShowById, fetchOnDemandSeasonEpisodes } from '@/lib/queries';
import { useAuth } from '@/context/AuthContext';

const functionsEu = getFunctions(app, 'europe-west1');

interface Episode {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  videoUrl: string;
  dateUploaded: string;
  airDate: string;
  published?: boolean;
}

interface Season {
  id: string;
  title: string;
  order: number;
  episodeCount: number;
  episodePreview: Episode[];
  published?: boolean;
}

interface Show {
  id: string;
  title: string;
  type: string;
  description: string;
  thumbnail: string;
  seasonCount: number;
  seasons: Season[];
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function HlsPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let hls: any = null;

    const loadVideo = async () => {
      if (!videoRef.current) return;

      if (src.endsWith('.m3u8')) {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play().catch(() => {});
          });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = src;
          videoRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.src = src;
        videoRef.current.play().catch(() => {});
      }
    };

    loadVideo();

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-3xl mx-4 bg-gray-900 rounded-lg overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition"
        >
          <X className="w-5 h-5" />
        </button>
        <video
          ref={videoRef}
          controls
          className="w-full aspect-video object-contain bg-black"
          playsInline
        />
        <div className="p-4 text-white">
          <p className="text-sm text-white/70">Press close or click outside to exit</p>
        </div>
      </div>
    </div>
  );
}

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useAuth();
  const isModerator = role === 'moderator';
  const showId = params.showId as string;
  const queryClient = new QueryClient();
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);

  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [episodeToDelete, setEpisodeToDelete] = useState<Episode | null>(null);
  const [episodeToEdit, setEpisodeToEdit] = useState<Episode | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: show, isLoading, error } = useQuery<Show>({
    queryKey: ['show', showId],
    queryFn: () => fetchOnDemandShowById(showId),
    enabled: !!showId,
  });

  const handleSelectSeason = async (seasonId: string) => {
    setSelectedSeason(seasonId);
    setLoadingEpisodes(true);
    try {
      const episodes = await fetchOnDemandSeasonEpisodes(showId, seasonId);
      setSeasonEpisodes(episodes.episodes || []);
    } catch (err) {
      console.error('Error loading episodes:', err);
      setSeasonEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleDeleteSeason = async () => {
    if (!seasonToDelete) return;
    try {
      const fn = httpsCallable(functionsEu, 'deleteOnDemandSeason');
      await fn({ showId, seasonId: seasonToDelete.id });
      setSeasonToDelete(null);
      setSelectedSeason(null);
      setSeasonEpisodes([]);
      queryClient.invalidateQueries({ queryKey: ['show', showId] });
    } catch (err: any) {
      alert('Failed to delete season: ' + err.message);
    }
  };

  const handleToggleSeasonPublish = async (seasonId: string, current: boolean) => {
    try {
      const fn = httpsCallable(functionsEu, 'updateOnDemandSeason');
      await fn({ showId, seasonId, updates: { published: !current } });
      queryClient.invalidateQueries({ queryKey: ['show', showId] });
    } catch (err: any) {
      alert('Failed to update season: ' + err.message);
    }
  };

  const handleToggleEpisodePublish = async (episodeId: string, current: boolean) => {
    try {
      const fn = httpsCallable(functionsEu, 'updateOnDemandEpisode');
      await fn({ showId, seasonId: selectedSeason, episodeId, updates: { published: !current } });
      setSeasonEpisodes(prev => prev.map(e => e.id === episodeId ? { ...e, published: !current } : e));
      queryClient.invalidateQueries({ queryKey: ['show', showId] });
    } catch (err: any) {
      alert('Failed to update episode: ' + err.message);
    }
  };

  const handleDeleteEpisode = async () => {
    if (!episodeToDelete) return;
    try {
      const fn = httpsCallable(functionsEu, 'deleteOnDemandEpisode');
      await fn({ showId, seasonId: selectedSeason, episodeId: episodeToDelete.id });
      setEpisodeToDelete(null);
      setSeasonEpisodes(prev => prev.filter(e => e.id !== episodeToDelete.id));
      queryClient.invalidateQueries({ queryKey: ['show', showId] });
    } catch (err: any) {
      alert('Failed to delete episode: ' + err.message);
    }
  };

  const handleEditEpisode = async () => {
    if (!episodeToEdit) return;
    try {
      const fn = httpsCallable(functionsEu, 'updateOnDemandEpisode');
      await fn({ showId, seasonId: selectedSeason, episodeId: episodeToEdit.id, updates: { title: editTitle, description: editDescription } });
      setEpisodeToEdit(null);
      setSeasonEpisodes(prev => prev.map(e => e.id === episodeToEdit.id ? { ...e, title: editTitle, description: editDescription } : e));
      queryClient.invalidateQueries({ queryKey: ['show', showId] });
    } catch (err: any) {
      alert('Failed to update episode: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="text-white mb-6">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-64 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="text-white mb-6">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-white mb-2">Show not found</h1>
            <p className="text-gray-400">The show you're looking for doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      {playingEpisode && (
        <HlsPlayer
          src={playingEpisode.videoUrl}
          onClose={() => setPlayingEpisode(null)}
        />
      )}

      <Dialog open={!!seasonToDelete} onOpenChange={() => setSeasonToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Season</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{seasonToDelete?.title}" and all its episodes? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeasonToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSeason}>Delete Season</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!episodeToEdit} onOpenChange={() => setEpisodeToEdit(null)}>
        <DialogContent className="bg-gray-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Episode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">Title</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm resize-none placeholder-white/40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEpisodeToEdit(null)} className="text-white border-white/20">Cancel</Button>
            <Button onClick={handleEditEpisode} className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!episodeToDelete} onOpenChange={() => setEpisodeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Episode</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{episodeToDelete?.title}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEpisodeToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteEpisode}>Delete Episode</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="text-white mb-6 hover:bg-white/10">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to On-Demand
        </Button>

        <div className="mb-8 rounded-lg overflow-hidden bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-white/10 p-6">
          <div className="flex gap-6">
            {show.thumbnail && (
              <img
                src={show.thumbnail}
                alt={show.title}
                className="w-40 h-40 rounded-lg object-cover flex-shrink-0"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-white mb-2">{show.title}</h1>
              <p className="text-gray-300 mb-4">{show.description}</p>
              <div className="flex gap-4 text-sm text-gray-400">
                <div>
                  <span className="font-semibold text-white">{show.seasonCount}</span> seasons
                </div>
                <div>•</div>
                <div>
                  <span className="font-semibold text-white">{show.seasons.reduce((sum, s) => sum + s.episodeCount, 0)}</span> episodes
                </div>
              </div>
            </div>
          </div>
        </div>

        {show.seasons && show.seasons.length > 0 ? (
          <div className="space-y-6">
            {show.seasons.map((season) => (
              <div key={season.id} className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20 hover:border-blue-500/40 transition cursor-pointer"
                  onClick={() => {
                    if (selectedSeason === season.id) {
                      setSelectedSeason(null);
                      setSeasonEpisodes([]);
                    } else {
                      handleSelectSeason(season.id);
                    }
                  }}
                >
                  <div>
                    <h2 className="text-xl font-semibold text-white">{season.title}</h2>
                    <p className="text-sm text-gray-400">{season.episodeCount} episodes</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={season.published !== false}
                        onChange={() => handleToggleSeasonPublish(season.id, season.published !== false)}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-white/10 text-blue-600"
                      />
                      Published
                    </label>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (selectedSeason === season.id) {
                          setSelectedSeason(null);
                          setSeasonEpisodes([]);
                        } else {
                          handleSelectSeason(season.id);
                        }
                      }}
                    >
                      View Episodes
                    </Button>
                    {!isModerator && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="size-8 bg-red-600/80 hover:bg-red-700 text-white"
                        onClick={() => setSeasonToDelete(season)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {selectedSeason === season.id && !loadingEpisodes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                    {seasonEpisodes.length > 0 ? (
                      seasonEpisodes.map((episode, idx) => (
                        <div
                          key={episode.id}
                          className="rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 transition group cursor-pointer"
                          onClick={() => setPlayingEpisode(episode)}
                        >
                          <div className="relative aspect-video bg-gray-800 overflow-hidden">
                            {episode.thumbnail && (
                              <img
                                src={episode.thumbnail}
                                alt={episode.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition flex items-center justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlayingEpisode(episode);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 p-3 rounded-full opacity-0 group-hover:opacity-100 transition"
                              >
                                <Play className="w-6 h-6 text-white fill-white" />
                              </button>
                            </div>
                            {!isModerator && (
                              <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEpisodeToEdit(episode);
                                  setEditTitle(episode.title);
                                  setEditDescription(episode.description || '');
                                }}
                                className="absolute top-2 left-2 p-1.5 rounded-full bg-blue-600/80 hover:bg-blue-700 text-white opacity-0 group-hover:opacity-100 transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEpisodeToDelete(episode);
                                }}
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600/80 hover:bg-red-700 text-white opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              </>
                            )}
                            </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-white text-sm mb-1 line-clamp-2 flex-1">
                                {idx + 1}. {episode.title}
                              </h3>
                              <label
                                className="shrink-0 flex items-center gap-1 text-xs text-white/50 cursor-pointer"
                                onClick={e => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={episode.published !== false}
                                  onChange={() => handleToggleEpisodePublish(episode.id, episode.published !== false)}
                                  className="h-3 w-3 rounded border-gray-600 bg-white/10 text-blue-600"
                                />
                              </label>
                            </div>
                            {episode.description && (
                              <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                                {episode.description}
                              </p>
                            )}
                            <div className="flex justify-between items-center text-xs text-gray-500">
                              <span>{formatDuration(episode.duration)}</span>
                              <span>
                                {episode.airDate ? new Date(episode.airDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-8 text-gray-400">
                        No episodes found for this season.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">No seasons available for this show.</p>
          </div>
        )}
      </div>
    </div>
  );
}
