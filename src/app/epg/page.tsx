'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, AlertCircle, Zap, Star, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FrostedDialog } from '../components/FrostedDialog';
import { programSchema, type ProgramFormData } from '@/lib/schemas/program';
import { eventSchema, type EventFormData } from '@/lib/schemas/event';
import { useEPGStore } from '@/lib/stores/epgStore';
import { useEPGData, useEPGSearch, useAddProgram, useUpdateProgram, useDeleteProgram } from '@/lib/hooks/useEPGData';
import { useEventsData, useAddEvent, useUpdateEvent, useDeleteEvent } from '@/lib/hooks/useEventsData';
import { utcToLocal, localToUtc, utcDatetimeToLocal } from '@/lib/utils/timeConversion';

interface Program {
  programName: string;
  tvProgramId: string;
  genre: string;
  language: string;
  details: string;
  startTime: string;
  endTime: string;
  targetAudience: string;
  image?: string;
  thumbnail?: string;
  days: string;
}

interface StationData {
  programs: Program[];
  stationImageUrl?: string;
  stationUrl: string;
  isPayPerView: boolean;
  price?: string;
  currency?: string;
  isLive: boolean;
}

export default function EPGPage() {
  const ITEMS_PER_PAGE = 6;
  const [epgType, setEpgType] = React.useState<'tv' | 'radio' | 'events'>('tv');

  // EPG program search (OpenSearch-backed, debounced)
  const [searchInput, setSearchInput] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedProgramIdx, setHighlightedProgramIdx] = React.useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);
  const { data: epgSearch, isFetching: epgSearching } = useEPGSearch(searchQuery);

  // Use React Query for data fetching
  const { data: epgResponse, isLoading, error } = useEPGData();
  const fullData = epgResponse?.data as any || { tv: {}, radio: undefined };
  const epgData = epgType === 'tv' ? (fullData.tv || {}) : (fullData.radio ? { radio: fullData.radio } : {});
  const source = epgResponse?.source || '';
  const stationCount = epgType === 'tv' ? Object.keys(fullData.tv || {}).length : (fullData.radio ? 1 : 0);

  // Zustand state management
  const {
    addDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    selectedProgramIndex,
    selectedStation,
    currentPage,
    imagePreview,
    imageLandscapePreview,
    openAddDialog,
    closeAddDialog,
    openEditDialog,
    closeEditDialog,
    openDeleteDialog,
    closeDeleteDialog,
    setSelectedStation,
    setCurrentPage,
    setImagePreview,
    setImageLandscapePreview,
    clearImagePreviews,
  } = useEPGStore();

  // Scroll to + reveal a program picked from search once its page is rendered.
  useEffect(() => {
    if (highlightedProgramIdx == null) return;
    const t = setTimeout(() => {
      document
        .getElementById(`epg-program-${highlightedProgramIdx}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(t);
  }, [highlightedProgramIdx, currentPage, selectedStation, epgType]);

  // React Hook Form with Zod validation
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      programName: '',
      tvProgramId: '',
      genre: '',
      language: '',
      details: '',
      startTime: '',
      endTime: '',
      targetAudience: '',
      days: '',
      image: '',
      imageLandscape: '',
      presenter: '',
      type: '',
      thumbnail: '',
      isInterruptive: false,
      shouldShow: true,
    },
  });

  // Events state
  const [eventsTabOpen, setEventsTabOpen] = React.useState(false);
  const [addEventDialogOpen, setAddEventDialogOpen] = React.useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = React.useState(false);
  const [deleteEventDialogOpen, setDeleteEventDialogOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<any>(null);


  // Mutations
  const addMutation = useAddProgram();
  const updateMutation = useUpdateProgram();
  const deleteMutation = useDeleteProgram();

  // Events mutations
  const { data: eventsData, isLoading: eventsLoading } = useEventsData();
  const addEventMutation = useAddEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();

  // Event form (separate from program form)
  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      imageUrl: '',
      presenter: '',
      startDate: '',
      endDate: '',
      platform: 'tv',
      stations: [],
    },
  });

  const tvStations = Object.keys(fullData.tv || {});
  const selectedPlatform = eventForm.watch('platform');
  const showStationPicker = selectedPlatform === 'tv' || selectedPlatform === 'both';

  // Set first station on load based on EPG type
  useEffect(() => {
    if (epgType === 'tv') {
      if (epgResponse?.data?.tv && Object.keys(epgResponse.data.tv).length > 0 && !selectedStation) {
        const firstStation = Object.keys(epgResponse.data.tv)[0];
        setSelectedStation(firstStation);
      }
    } else {
      // For radio, always set selectedStation to 'radio'
      if (!selectedStation) {
        setSelectedStation('radio');
      }
    }
  }, [epgResponse?.data, epgType, selectedStation, setSelectedStation]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, orientation: 'portrait' | 'landscape' = 'portrait') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        if (orientation === 'portrait') {
          setImagePreview(imageUrl);
        } else {
          setImageLandscapePreview(imageUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onAddProgram = async (data: ProgramFormData) => {
    if (!selectedStation) {
      alert('Please select a station');
      return;
    }

    const programData = {
      ...data,
      startTime: localToUtc(data.startTime),
      endTime: localToUtc(data.endTime),
      image: imagePreview,
      imageLandscape: imageLandscapePreview,
    };

    addMutation.mutate(
      { stationName: selectedStation, program: programData },
      {
        onSuccess: () => {
          alert('Program added successfully!');
          closeAddDialog();
          reset();
          clearImagePreviews();
        },
        onError: (error: Error) => {
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  const onEditProgram = async (data: ProgramFormData) => {
    console.log('[onEditProgram] Starting edit with data:', data);

    if (!selectedStation || selectedProgramIndex === null) {
      console.error('[onEditProgram] Missing selectedStation or selectedProgramIndex');
      alert('Please select a program to edit');
      return;
    }

    // Get the original program to extract identifying fields
    // Use the form's default values or the current data in the list
    const currentPrograms = epgType === 'tv'
      ? (fullData.tv[selectedStation]?.programs || [])
      : (fullData.radio?.programs || []);
    const currentProgram = currentPrograms[selectedProgramIndex];

    if (!currentProgram) {
      console.error('[onEditProgram] Could not find current program');
      alert('Could not find program to edit');
      return;
    }

    // Use the ORIGINAL program's identifying fields, not the edited data
    // This ensures we find the exact program in Firestore, even if the name changed
    const originalProgramName = currentProgram.programName;
    const originalDays = currentProgram.days;
    const originalStartTime = currentProgram.startTime;

    console.log('[onEditProgram] Original program identifiers:', {
      programName: originalProgramName,
      days: originalDays,
      startTime: originalStartTime,
    });

    const updates = {
      ...data,
      startTime: localToUtc(data.startTime),
      endTime: localToUtc(data.endTime),
      ...(imagePreview && { image: imagePreview }),
      ...(imageLandscapePreview && { imageLandscape: imageLandscapePreview }),
    };

    console.log('[onEditProgram] Updates object:', {
      ...updates,
      image: updates.image ? `${updates.image.substring(0, 50)}...` : undefined,
      imageLandscape: updates.imageLandscape ? `${updates.imageLandscape.substring(0, 50)}...` : undefined,
    });

    updateMutation.mutate(
      {
        stationName: selectedStation,
        programIndex: selectedProgramIndex,
        updates,
        programName: originalProgramName,
        days: originalDays,
        startTime: originalStartTime,
      },
      {
        onSuccess: () => {
          console.log('[onEditProgram] Update successful');
          alert('Program updated successfully!');
          closeEditDialog();
          reset();
          clearImagePreviews();
        },
        onError: (error: any) => {
          console.error('[onEditProgram] Update failed:', {
            message: error.message,
            code: error.code,
            details: error.details,
            fullError: error,
          });
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  const onDeleteProgram = () => {
    if (!selectedStation || selectedProgramIndex === null) {
      return;
    }

    // Get the current program to extract identifying fields
    const currentPrograms = epgType === 'tv'
      ? (fullData.tv[selectedStation]?.programs || [])
      : (fullData.radio?.programs || []);
    const currentProgram = currentPrograms[selectedProgramIndex];

    if (!currentProgram) {
      alert('Could not find program to delete');
      return;
    }

    deleteMutation.mutate(
      {
        stationName: selectedStation,
        programIndex: selectedProgramIndex,
        programName: currentProgram.programName,
        days: currentProgram.days,
        startTime: currentProgram.startTime,
      },
      {
        onSuccess: () => {
          alert('Program deleted successfully!');
          closeDeleteDialog();
        },
        onError: (error: Error) => {
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  // ===== EVENT HANDLERS =====
  const onAddEvent = (data: EventFormData) => {
    const eventData = {
      ...data,
      startDate: localToUtc(data.startDate),
      endDate: localToUtc(data.endDate),
    };
    addEventMutation.mutate(eventData, {
      onSuccess: () => {
        alert('Event added successfully!');
        setAddEventDialogOpen(false);
        eventForm.reset();
      },
      onError: (error: any) => {
        alert(`Error: ${error.message}`);
      },
    });
  };

  const onEditEvent = (data: EventFormData) => {
    if (!selectedEvent) return;
    const eventData = {
      ...data,
      startDate: localToUtc(data.startDate),
      endDate: localToUtc(data.endDate),
    };
    updateEventMutation.mutate(
      { eventId: selectedEvent.id, ...eventData },
      {
        onSuccess: () => {
          alert('Event updated successfully!');
          setEditEventDialogOpen(false);
          setSelectedEvent(null);
          eventForm.reset();
        },
        onError: (error: any) => {
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  const onDeleteEvent = () => {
    if (!selectedEvent) return;
    deleteEventMutation.mutate(
      { eventId: selectedEvent.id },
      {
        onSuccess: () => {
          alert('Event deleted successfully!');
          setDeleteEventDialogOpen(false);
          setSelectedEvent(null);
        },
        onError: (error: any) => {
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  const isEventActive = (event: any) => {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar size={32} className="text-blue-300" />
            Electronic Program Guide (EPG)
          </h1>
          <p className="mt-2 text-white/70">Loading all programs...</p>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="frosted-glass p-6 animate-pulse">
              <div className="h-6 bg-white/20 rounded mb-4 w-1/3"></div>
              <div className="space-y-2">
                <div className="h-4 bg-white/20 rounded"></div>
                <div className="h-4 bg-white/20 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Calendar size={32} className="text-blue-300" />
            Electronic Program Guide (EPG)
          </h1>
        </div>

        <div className="frosted-glass p-6 border border-red-500/50">
          <div className="flex items-start gap-4">
            <AlertCircle size={24} className="text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-red-300 font-semibold">Failed to Load EPG</h3>
              <p className="text-red-200/70 text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-sm transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  const goToProgram = (p: { station_id: string; program_name?: string }) => {
    // Jump to the station that airs this program (radio maps to the single radio tab).
    const isTv = !!(fullData.tv && fullData.tv[p.station_id]);
    const stationData = isTv ? fullData.tv[p.station_id] : fullData.radio;
    if (isTv) {
      setEpgType('tv');
      setSelectedStation(p.station_id);
    } else {
      setEpgType('radio');
      setSelectedStation('radio');
    }
    // Locate the program in the station list, page to it and highlight it.
    if (stationData?.programs) {
      const idx = stationData.programs.findIndex(
        (prog: any) =>
          (prog.programName || '').trim().toLowerCase() ===
          (p.program_name || '').trim().toLowerCase(),
      );
      if (idx >= 0) {
        setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);
        setHighlightedProgramIdx(idx);
      } else {
        setHighlightedProgramIdx(null);
      }
    } else {
      setHighlightedProgramIdx(null);
    }
    setSearchInput('');
    setSearchQuery('');
  };

  return (
    <div className="p-4 h-screen flex flex-col">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={20} className="text-blue-300" />
            Electronic Program Guide (EPG)
          </h1>
          <p className="mt-1 text-white/70 text-sm">
            {epgType === 'tv' ? stationCount : 1} {epgType === 'tv' ? 'TV' : 'Radio'} {epgType === 'tv' ? 'stations' : 'station'} • All programs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Program search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search programs…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 pr-8 w-72"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
            {searchInput.trim().length > 1 && (
              <div className="absolute right-0 z-30 mt-1 w-96 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-neutral-800 shadow-xl">
                {epgSearching && searchQuery && (
                  <div className="px-3 py-2 text-xs text-white/40">Searching…</div>
                )}
                {!epgSearching && (epgSearch?.data?.programs?.length ?? 0) === 0 && (
                  <div className="px-3 py-2 text-xs text-white/40">No programs found</div>
                )}
                {(epgSearch?.data?.programs ?? []).map((p: any) => (
                  <button
                    key={`${p.id}-${p.station_id}-${p.program_name}-${p.start_time}-${p.days}`}
                    onClick={() => goToProgram(p)}
                    className="block w-full text-left px-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/10"
                  >
                    <div className="text-sm text-white font-medium">{p.program_name}</div>
                    <div className="text-xs text-white/50">
                      {p.station_id} • {p.start_time}–{p.end_time} • {p.days}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded text-xs text-white/60">
            {source === 'redis-cache' ? (
              <>
                <Zap size={14} className="text-yellow-400" />
                <span>⚡ Cached</span>
              </>
            ) : (
              <>
                <Calendar size={14} className="text-blue-400" />
                <span>📊 Live</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* TV/Radio/Events Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setEpgType('tv');
            setSelectedStation(null);
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded text-sm font-medium transition ${
            epgType === 'tv'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
          }`}
        >
          📺 TV Channels
        </button>
        <button
          onClick={() => {
            setEpgType('radio');
            setSelectedStation('radio');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded text-sm font-medium transition ${
            epgType === 'radio'
              ? 'bg-blue-600 text-white'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
          }`}
        >
          📻 Radio Station
        </button>
        <button
          onClick={() => setEpgType('events')}
          className={`px-4 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 ${
            epgType === 'events'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
          }`}
        >
          <Star size={16} />
          Events
        </button>
      </div>


      {epgType === 'events' ? (
        <div className="frosted-glass p-4 flex flex-col overflow-hidden flex-1">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Star size={20} className="text-purple-400" />
              Special Events
            </h2>
            <Button
              onClick={() => {
                eventForm.reset({ title: '', imageUrl: '', presenter: '', startDate: '', endDate: '', platform: 'tv', stations: [] });
                setAddEventDialogOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              + Add Event
            </Button>
          </div>

          {eventsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white/5 rounded p-4 animate-pulse">
                  <div className="h-5 bg-white/20 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-white/20 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : !eventsData || eventsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Star size={48} className="text-white/20 mb-3" />
              <p className="text-white/50">No events found</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto">
              {eventsData.map((event: any) => {
                const active = isEventActive(event);
                return (
                  <div
                    key={event.id}
                    className={`rounded p-4 border transition relative group ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="absolute top-3 right-3 flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          eventForm.reset({
                            title: event.title,
                            imageUrl: event.imageUrl || '',
                            presenter: event.presenter || '',
                            startDate: utcDatetimeToLocal(event.startDate),
                            endDate: utcDatetimeToLocal(event.endDate),
                            platform: event.platform,
                            stations: event.stations || [],
                          });
                          setEditEventDialogOpen(true);
                        }}
                        className="p-1.5 bg-blue-600/80 hover:bg-blue-700 text-white rounded text-sm transition"
                        title="Edit event"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setDeleteEventDialogOpen(true);
                        }}
                        className="p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded text-sm transition"
                        title="Delete event"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-3">
                      {event.imageUrl && (
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          className="w-20 h-20 rounded object-cover flex-shrink-0"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-sm">{event.title}</h3>
                          {active && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-600/40 text-purple-200 text-xs rounded-full">
                              <span className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-pulse"></span>
                              ACTIVE
                            </span>
                          )}
                        </div>
                        {event.presenter && (
                          <p className="text-white/60 text-xs mt-1">🎙 {event.presenter}</p>
                        )}
                        <div className="flex items-center gap-2 text-white/50 text-xs mt-1.5">
                          <span>📅 {formatDate(event.startDate)}</span>
                          <span>→</span>
                          <span>{formatDate(event.endDate)}</span>
                        </div>
                        <div className="flex gap-1 mt-1.5">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            event.platform === 'both'
                              ? 'bg-green-600/30 text-green-300'
                              : event.platform === 'tv'
                              ? 'bg-blue-600/30 text-blue-300'
                              : 'bg-orange-600/30 text-orange-300'
                          }`}>
                            {event.platform === 'both' ? '📺📻 Both' : event.platform === 'tv' ? '📺 TV' : '📻 Radio'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : stationCount === 0 ? (
        <div className="frosted-glass p-12 flex flex-col items-center justify-center">
          <Calendar size={64} className="text-white/20 mb-4" />
          <p className="text-xl text-white/50">No programs scheduled for today</p>
        </div>
      ) : (
        <div className="frosted-glass p-4 flex flex-col overflow-hidden">
          {/* Station Tabs with Add Button (TV only) */}
          {epgType === 'tv' && (
          <div className="flex items-center justify-between gap-4 border-b border-white/10 mb-3 pb-3">
            <div className="grid flex-1 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.keys(epgData).map((stationName) => (
                <button
                  key={stationName}
                  onClick={() => {
                    setSelectedStation(stationName);
                    setHighlightedProgramIdx(null);
                  }}
                  className={`text-xs sm:text-sm py-2 px-2 rounded transition ${
                    selectedStation === stationName
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {stationName}
                </button>
              ))}
            </div>
            <Button
              onClick={() => {
                clearImagePreviews();
                reset();
                openAddDialog();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
            >
              + Add
            </Button>
          </div>
          )}

          {/* Station/Radio Content */}
          {selectedStation && (epgType === 'tv' ? epgData[selectedStation] : epgData.radio) && (() => {
            const stationData = epgType === 'tv' ? epgData[selectedStation] : epgData.radio;
            return (
            <>
              {/* Station/Radio Header */}
              <div className="flex items-start gap-2 mb-3 pb-2 border-b border-white/10">
                {epgType === 'tv' && stationData.stationImageUrl && (
                  <img
                    src={stationData.stationImageUrl}
                    alt={selectedStation}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{epgType === 'tv' ? selectedStation : '📻 Radio Station'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {epgType === 'tv' && stationData.isLive && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-600/30 text-red-300 text-xs rounded">
                        <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                    )}
                    {epgType === 'tv' && stationData.isPayPerView && (
                      <span className="px-2 py-1 bg-yellow-600/30 text-yellow-300 text-xs rounded">
                        💰 PPV
                      </span>
                    )}
                    <span className="text-white/60 text-xs">
                      {stationData.programs.length} programs
                    </span>
                  </div>
                </div>
              </div>

              {/* Programs Grid */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {(() => {
                  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                  const paginatedPrograms = stationData.programs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

                  return paginatedPrograms.map((program: Program, pIdx: number) => {
                    const idx = startIdx + pIdx;
                    return (
                  <div
                    id={`epg-program-${idx}`}
                    key={idx}
                    className={`bg-white/5 hover:bg-white/10 rounded p-3 border border-white/10 transition relative group ${
                      idx === highlightedProgramIdx ? 'ring-2 ring-yellow-400 bg-yellow-500/10' : ''
                    }`}
                  >
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => {
                          reset({
                            ...program,
                            startTime: utcToLocal(program.startTime),
                            endTime: utcToLocal(program.endTime),
                          });
                          clearImagePreviews();
                          openEditDialog(selectedStation!, idx);
                        }}
                        className="p-1.5 bg-blue-600/80 hover:bg-blue-700 text-white rounded text-sm transition"
                        title="Edit program"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => {
                          openDeleteDialog(selectedStation!, idx);
                        }}
                        className="p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded text-sm transition"
                        title="Delete program"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex gap-3">
                      {program.image && (
                        <img
                          src={program.image}
                          alt={program.programName}
                          className="w-28 h-28 rounded object-cover flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm mb-1">
                          {program.programName}
                        </h3>
                        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                          <span>🕐 {utcToLocal(program.startTime)}</span>
                          <span>-</span>
                          <span>{utcToLocal(program.endTime)}</span>
                        </div>
                        {program.days && (
                          <div className="text-xs text-white/50 mb-1 font-medium">
                            📅 {program.days}
                          </div>
                        )}
                        <div className="flex gap-1 flex-wrap mb-1">
                          {program.genre && (
                            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {program.genre}
                            </span>
                          )}
                          {program.language && (
                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                              {program.language}
                            </span>
                          )}
                          {program.targetAudience && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                              {program.targetAudience}
                            </span>
                          )}
                        </div>
                        {program.details && (
                          <p className="text-white/70 text-xs line-clamp-1">
                            {program.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                    );
                  });
                })()}
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                  style={{color: 'white'}}
                >
                  ← Previous
                </Button>
                <span className="text-white/70 text-sm">
                  Page {currentPage} of {Math.ceil(stationData.programs.length / ITEMS_PER_PAGE) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(stationData.programs.length / ITEMS_PER_PAGE)}
                  style={{color: 'white'}}
                >
                  Next →
                </Button>
              </div>
            </>
            );
          })()}
        </div>
      )}

      {/* Add Program Dialog */}
      <FrostedDialog
        open={addDialogOpen}
        onOpenChange={closeAddDialog}
        title="Add Program"
        footer={
          <>
            <Button variant="outline" onClick={closeAddDialog} style={{color: 'white'}}>Cancel</Button>
            <Button onClick={handleSubmit(onAddProgram)} disabled={addMutation.isPending} style={{color: 'white'}}>
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {epgType === 'tv' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="add-image" className="text-white">Program Image (Portrait)</Label>
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded object-cover" />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('add-image')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="add-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'portrait')}
                  className="hidden"
                />
                <Input
                  type="text"
                  placeholder="Or paste image URL"
                  onChange={(e) => setImagePreview(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-image-landscape" className="text-white">Program Image (Landscape)</Label>
                {imageLandscapePreview && (
                  <img src={imageLandscapePreview} alt="Preview" className="w-32 h-20 rounded object-cover" />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('add-image-landscape')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="add-image-landscape"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'landscape')}
                  className="hidden"
                />
                <Input
                  type="text"
                  placeholder="Or paste image URL"
                  onChange={(e) => setImageLandscapePreview(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          {epgType === 'radio' && (
            <div className="grid gap-2">
              <Label htmlFor="add-image" className="text-white">Program Image</Label>
              <Input
                id="add-image"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(e, 'portrait')}
                className="cursor-pointer bg-white/10 border-white/20 text-white file:text-white file:bg-blue-600/50"
              />
              <Input
                type="text"
                placeholder="Or paste image URL"
                onChange={(e) => setImagePreview(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-white/40"
              />
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded object-cover" />
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-programName" className="text-white">Program Name {errors.programName && <span className="text-red-400 text-xs">{errors.programName.message}</span>}</Label>
            <Input
              id="add-programName"
              {...register('programName')}
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
          </div>
          {epgType === 'tv' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="add-tvProgramId" className="text-white">TV Program ID</Label>
                <Input
                  id="add-tvProgramId"
                  {...register('tvProgramId')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-genre" className="text-white">Genre</Label>
                <Input
                  id="add-genre"
                  {...register('genre')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-language" className="text-white">Language</Label>
                <Input
                  id="add-language"
                  {...register('language')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-startTime" className="text-white">Start Time {errors.startTime && <span className="text-red-400 text-xs">{errors.startTime.message}</span>}</Label>
            <Input
              id="add-startTime"
              type="time"
              {...register('startTime')}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-endTime" className="text-white">End Time {errors.endTime && <span className="text-red-400 text-xs">{errors.endTime.message}</span>}</Label>
            <Input
              id="add-endTime"
              type="time"
              {...register('endTime')}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          {epgType === 'tv' && (
            <div className="grid gap-2">
              <Label htmlFor="add-targetAudience" className="text-white">Target Audience</Label>
              <Input
                id="add-targetAudience"
                {...register('targetAudience')}
                className="bg-white/10 border-white/20 text-white placeholder-white/40"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-details" className="text-white">Details</Label>
            <textarea
              id="add-details"
              {...register('details')}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40 h-20"
              placeholder="Details"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-days" className="text-white">Days {errors.days && <span className="text-red-400 text-xs">{errors.days.message}</span>}</Label>
            <Input
              id="add-days"
              {...register('days')}
              placeholder="Monday, Tuesday, etc"
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
          </div>
          {epgType === 'radio' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="add-presenter" className="text-white">Presenter</Label>
                <Input
                  id="add-presenter"
                  {...register('presenter')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-type" className="text-white">Type</Label>
                <Input
                  id="add-type"
                  {...register('type')}
                  placeholder="e.g., news, music, talk"
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="add-thumbnail" className="text-white">Thumbnail</Label>
                {imageLandscapePreview && (
                  <img src={imageLandscapePreview} alt="Preview" className="w-32 h-20 rounded object-cover" />
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('add-thumbnail')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="add-thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'landscape')}
                  className="hidden"
                />
                <Input
                  type="text"
                  placeholder="Or paste thumbnail URL"
                  {...register('thumbnail')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          {epgType === 'tv' && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isInterruptive')}
                  className="w-4 h-4 rounded bg-white/10 border-white/20"
                />
                <span className="text-white text-sm">Is Interruptive</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('shouldShow')}
                  className="w-4 h-4 rounded bg-white/10 border-white/20"
                />
                <span className="text-white text-sm">Should Show</span>
              </label>
            </div>
          )}
        </div>
      </FrostedDialog>

      {/* Edit Program Dialog */}
      <FrostedDialog
        open={editDialogOpen}
        onOpenChange={closeEditDialog}
        title="Edit Program"
        footer={
          <>
            <Button variant="outline" onClick={closeEditDialog} style={{color: 'white'}}>Cancel</Button>
            <Button onClick={handleSubmit(onEditProgram)} disabled={updateMutation.isPending} style={{color: 'white'}}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {epgType === 'tv' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="edit-image" className="text-white">Program Image (Portrait)</Label>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded object-cover" />
                ) : watch('image') ? (
                  <img src={watch('image')} alt="Preview" className="w-24 h-24 rounded object-cover" />
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('edit-image')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'portrait')}
                  className="hidden"
                />
                <Input
                  type="text"
                  placeholder="Or paste image URL"
                  onChange={(e) => setImagePreview(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-image-landscape" className="text-white">Program Image (Landscape)</Label>
                {imageLandscapePreview ? (
                  <img src={imageLandscapePreview} alt="Preview" className="w-32 h-20 rounded object-cover" />
                ) : watch('imageLandscape') ? (
                  <img src={watch('imageLandscape')} alt="Preview" className="w-32 h-20 rounded object-cover" />
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById('edit-image-landscape')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="edit-image-landscape"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'landscape')}
                  className="hidden"
                />
                <Input
                  type="text"
                  placeholder="Or paste image URL"
                  onChange={(e) => setImageLandscapePreview(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          {epgType === 'radio' && (
            <div className="grid gap-2">
              <Label htmlFor="edit-image" className="text-white">Program Image</Label>
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded object-cover" />
              ) : watch('image') ? (
                <img src={watch('image')} alt="Preview" className="w-24 h-24 rounded object-cover" />
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => document.getElementById('edit-image')?.click()}
                >
                  Upload Image
                </Button>
                <Input
                  id="edit-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'portrait')}
                  className="hidden"
                />
              </div>
              <Input
                type="text"
                placeholder="Or paste image URL"
                onChange={(e) => setImagePreview(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-white/40"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-programName" className="text-white">Program Name {errors.programName && <span className="text-red-400 text-xs">{errors.programName.message}</span>}</Label>
            <Input
              id="edit-programName"
              {...register('programName')}
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
          </div>
          {epgType === 'tv' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="edit-tvProgramId" className="text-white">TV Program ID</Label>
                <Input
                  id="edit-tvProgramId"
                  {...register('tvProgramId')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-genre" className="text-white">Genre</Label>
                <Input
                  id="edit-genre"
                  {...register('genre')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-language" className="text-white">Language</Label>
                <Input
                  id="edit-language"
                  {...register('language')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-startTime" className="text-white">Start Time {errors.startTime && <span className="text-red-400 text-xs">{errors.startTime.message}</span>}</Label>
            <Input
              id="edit-startTime"
              type="time"
              {...register('startTime')}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-endTime" className="text-white">End Time {errors.endTime && <span className="text-red-400 text-xs">{errors.endTime.message}</span>}</Label>
            <Input
              id="edit-endTime"
              type="time"
              {...register('endTime')}
              className="bg-white/10 border-white/20 text-white"
            />
          </div>
          {epgType === 'tv' && (
            <div className="grid gap-2">
              <Label htmlFor="edit-targetAudience" className="text-white">Target Audience</Label>
              <Input
                id="edit-targetAudience"
                {...register('targetAudience')}
                className="bg-white/10 border-white/20 text-white placeholder-white/40"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="edit-details" className="text-white">Details</Label>
            <textarea
              id="edit-details"
              {...register('details')}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/40 h-20"
              placeholder="Details"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-days" className="text-white">Days {errors.days && <span className="text-red-400 text-xs">{errors.days.message}</span>}</Label>
            <Input
              id="edit-days"
              {...register('days')}
              placeholder="Monday, Tuesday, etc"
              className="bg-white/10 border-white/20 text-white placeholder-white/40"
            />
          </div>
          {epgType === 'radio' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="edit-presenter" className="text-white">Presenter</Label>
                <Input
                  id="edit-presenter"
                  {...register('presenter')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-type" className="text-white">Type</Label>
                <Input
                  id="edit-type"
                  {...register('type')}
                  placeholder="e.g., news, music, talk"
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-thumbnail" className="text-white">Thumbnail</Label>
                <Input
                  id="edit-thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'landscape')}
                  className="cursor-pointer bg-white/10 border-white/20 text-white file:text-white file:bg-blue-600/50"
                />
                <Input
                  type="text"
                  placeholder="Or paste thumbnail URL"
                  {...register('thumbnail')}
                  className="bg-white/10 border-white/20 text-white placeholder-white/40"
                />
              </div>
            </>
          )}
          {epgType === 'tv' && (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isInterruptive')}
                  className="w-4 h-4 rounded bg-white/10 border-white/20"
                />
                <span className="text-white text-sm">Is Interruptive</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('shouldShow')}
                  className="w-4 h-4 rounded bg-white/10 border-white/20"
                />
                <span className="text-white text-sm">Should Show</span>
              </label>
            </div>
          )}
        </div>
      </FrostedDialog>

      {/* Delete Confirmation Dialog */}
      <FrostedDialog
        open={deleteDialogOpen}
        onOpenChange={closeDeleteDialog}
        title="Delete Program"
        footer={
          <>
            <Button variant="outline" onClick={closeDeleteDialog} style={{color: 'white'}}>Cancel</Button>
            <Button variant="destructive" onClick={onDeleteProgram} disabled={deleteMutation.isPending} style={{color: 'white'}}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-white/70">Are you sure you want to delete "{watch('programName')}"? This action cannot be undone.</p>
      </FrostedDialog>

      {/* ===== EVENTS DIALOGS ===== */}

      {/* Add Event Dialog */}
      <FrostedDialog
        open={addEventDialogOpen}
        onOpenChange={setAddEventDialogOpen}
        title="Add Special Event"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddEventDialogOpen(false)} style={{color: 'white'}}>Cancel</Button>
            <Button onClick={eventForm.handleSubmit(onAddEvent)} disabled={addEventMutation.isPending} style={{color: 'white'}}>
              {addEventMutation.isPending ? 'Adding...' : 'Add Event'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-white">Title *</Label>
            <Input {...eventForm.register('title')} className="bg-white/10 border-white/20 text-white placeholder-white/40" placeholder="e.g., Church Crusade 2026" />
            {eventForm.formState.errors.title && <span className="text-red-400 text-xs">{eventForm.formState.errors.title.message}</span>}
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Image URL</Label>
            <Input {...eventForm.register('imageUrl')} className="bg-white/10 border-white/20 text-white placeholder-white/40" placeholder="https://..." />
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Presenter</Label>
            <Input {...eventForm.register('presenter')} className="bg-white/10 border-white/20 text-white placeholder-white/40" placeholder="Presenter name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-white">Start Date *</Label>
              <Input type="datetime-local" {...eventForm.register('startDate')} className="bg-white/10 border-white/20 text-white" />
              {eventForm.formState.errors.startDate && <span className="text-red-400 text-xs">{eventForm.formState.errors.startDate.message}</span>}
            </div>
            <div className="grid gap-2">
              <Label className="text-white">End Date *</Label>
              <Input type="datetime-local" {...eventForm.register('endDate')} className="bg-white/10 border-white/20 text-white" />
              {eventForm.formState.errors.endDate && <span className="text-red-400 text-xs">{eventForm.formState.errors.endDate.message}</span>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Platform *</Label>
            <select {...eventForm.register('platform')} className="bg-white/10 border-white/20 text-white rounded px-3 py-2">
              <option value="tv">📺 TV Only</option>
              <option value="radio">📻 Radio Only</option>
              <option value="both">📺📻 Both</option>
            </select>
          </div>

          {showStationPicker && tvStations.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-white">TV Stations (leave empty for all)</Label>
              <div className="max-h-40 overflow-y-auto space-y-1.5 bg-white/5 rounded p-2 border border-white/10">
                {tvStations.map((station) => (
                  <label key={station} className="flex items-center gap-2 cursor-pointer text-white/80 hover:text-white text-sm">
                    <input
                      type="checkbox"
                      value={station}
                      checked={(eventForm.watch('stations') || []).includes(station)}
                      onChange={(e) => {
                        const current = eventForm.getValues('stations') || [];
                        if (e.target.checked) {
                          eventForm.setValue('stations', [...current, station]);
                        } else {
                          eventForm.setValue('stations', current.filter((s) => s !== station));
                        }
                      }}
                      className="w-4 h-4 rounded bg-white/10 border-white/20"
                    />
                    {station}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </FrostedDialog>

      {/* Edit Event Dialog */}
      <FrostedDialog
        open={editEventDialogOpen}
        onOpenChange={(open) => { if (!open) { setEditEventDialogOpen(false); setSelectedEvent(null); } }}
        title="Edit Special Event"
        footer={
          <>
            <Button variant="outline" onClick={() => { setEditEventDialogOpen(false); setSelectedEvent(null); }} style={{color: 'white'}}>Cancel</Button>
            <Button onClick={eventForm.handleSubmit(onEditEvent)} disabled={updateEventMutation.isPending} style={{color: 'white'}}>
              {updateEventMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-white">Title *</Label>
            <Input {...eventForm.register('title')} className="bg-white/10 border-white/20 text-white placeholder-white/40" />
            {eventForm.formState.errors.title && <span className="text-red-400 text-xs">{eventForm.formState.errors.title.message}</span>}
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Image URL</Label>
            <Input {...eventForm.register('imageUrl')} className="bg-white/10 border-white/20 text-white placeholder-white/40" placeholder="https://..." />
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Presenter</Label>
            <Input {...eventForm.register('presenter')} className="bg-white/10 border-white/20 text-white placeholder-white/40" placeholder="Presenter name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="text-white">Start Date *</Label>
              <Input type="datetime-local" {...eventForm.register('startDate')} className="bg-white/10 border-white/20 text-white" />
              {eventForm.formState.errors.startDate && <span className="text-red-400 text-xs">{eventForm.formState.errors.startDate.message}</span>}
            </div>
            <div className="grid gap-2">
              <Label className="text-white">End Date *</Label>
              <Input type="datetime-local" {...eventForm.register('endDate')} className="bg-white/10 border-white/20 text-white" />
              {eventForm.formState.errors.endDate && <span className="text-red-400 text-xs">{eventForm.formState.errors.endDate.message}</span>}
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-white">Platform *</Label>
            <select {...eventForm.register('platform')} className="bg-white/10 border-white/20 text-white rounded px-3 py-2">
              <option value="tv">📺 TV Only</option>
              <option value="radio">📻 Radio Only</option>
              <option value="both">📺📻 Both</option>
            </select>
          </div>

          {showStationPicker && tvStations.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-white">TV Stations (leave empty for all)</Label>
              <div className="max-h-40 overflow-y-auto space-y-1.5 bg-white/5 rounded p-2 border border-white/10">
                {tvStations.map((station) => (
                  <label key={station} className="flex items-center gap-2 cursor-pointer text-white/80 hover:text-white text-sm">
                    <input
                      type="checkbox"
                      value={station}
                      checked={(eventForm.watch('stations') || []).includes(station)}
                      onChange={(e) => {
                        const current = eventForm.getValues('stations') || [];
                        if (e.target.checked) {
                          eventForm.setValue('stations', [...current, station]);
                        } else {
                          eventForm.setValue('stations', current.filter((s) => s !== station));
                        }
                      }}
                      className="w-4 h-4 rounded bg-white/10 border-white/20"
                    />
                    {station}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </FrostedDialog>

      {/* Delete Event Confirmation Dialog */}
      <FrostedDialog
        open={deleteEventDialogOpen}
        onOpenChange={(open) => { if (!open) { setDeleteEventDialogOpen(false); setSelectedEvent(null); } }}
        title="Delete Event"
        footer={
          <>
            <Button variant="outline" onClick={() => { setDeleteEventDialogOpen(false); setSelectedEvent(null); }} style={{color: 'white'}}>Cancel</Button>
            <Button variant="destructive" onClick={onDeleteEvent} disabled={deleteEventMutation.isPending} style={{color: 'white'}}>
              {deleteEventMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-white/70">Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.</p>
      </FrostedDialog>
    </div>
  );
}