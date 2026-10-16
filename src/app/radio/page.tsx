'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Radio, FileText, BarChart3 } from 'lucide-react';
import TrafficLogsSection from '@/app/components/TrafficLogsSection';

interface RadioStation {
  id: string;
  name: string;
  url: string;
  description?: string;
  genre?: string;
}

export default function RadioPage() {
  const [activeSection, setActiveSection] = useState<'all' | 'stations' | 'logs'>('all');
  const [stations, setStations] = useState<RadioStation[]>([
    {
      id: '1',
      name: 'Station 1',
      url: '',
      description: 'Main Radio Station',
      genre: 'General',
    },
  ]);
  const [selectedStationId, setSelectedStationId] = useState('1');
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationUrl, setNewStationUrl] = useState('');
  const [newStationGenre, setNewStationGenre] = useState('');

  const selectedStation = stations.find(st => st.id === selectedStationId);

  const handleAddStation = () => {
    if (!newStationName || !newStationUrl) {
      alert('Please fill in station name and URL');
      return;
    }

    const newStation: RadioStation = {
      id: Date.now().toString(),
      name: newStationName,
      url: newStationUrl,
      description: '',
      genre: newStationGenre,
    };

    setStations([...stations, newStation]);
    setNewStationName('');
    setNewStationUrl('');
    setNewStationGenre('');
    setIsAddingStation(false);
    setSelectedStationId(newStation.id);
  };

  const handleUpdateStationUrl = (url: string) => {
    if (!selectedStation) return;
    setStations(stations.map(st =>
      st.id === selectedStationId ? { ...st, url } : st
    ));
  };

  const handleDeleteStation = (id: string) => {
    if (stations.length <= 1) {
      alert('You must have at least one station');
      return;
    }
    const newStations = stations.filter(st => st.id !== id);
    setStations(newStations);
    if (selectedStationId === id) {
      setSelectedStationId(newStations[0].id);
    }
  };

  return (
    <div className="p-6 space-y-8">
      {/* Page Header & Section Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-white">Radio Stations &amp; Playout Logs</h1>
          <p className="mt-1 text-white/70">
            Manage live radio streams, inspect StationPlaylist studio commercial logs, and export advertiser affidavits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'all'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            All Sections
          </button>
          <button
            onClick={() => setActiveSection('stations')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'stations'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Radio size={15} />
            Stations
          </button>
          <button
            onClick={() => setActiveSection('logs')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === 'logs'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText size={15} />
            Logs
          </button>
          <Link
            href="/radio/reports"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <BarChart3 size={15} />
            Reports
          </Link>
        </div>
      </div>

      {/* SECTION 1: Radio Stations & Stream Player */}
      {(activeSection === 'all' || activeSection === 'stations') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Station List */}
          <div className="frosted-glass rounded-xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/15 flex items-center justify-between bg-white/5">
              <span className="text-white font-semibold text-sm">Stations</span>
              <button
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                onClick={() => setIsAddingStation(!isAddingStation)}
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            <div className="p-4 space-y-3">
              {isAddingStation && (
                <div className="space-y-3 p-3 bg-white/10 rounded-lg border border-white/20">
                  <div>
                    <Label className="text-white text-sm">Station Name</Label>
                    <Input
                      value={newStationName}
                      onChange={(e) => setNewStationName(e.target.value)}
                      placeholder="e.g., Jazz FM"
                      className="mt-1 bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm">Stream URL</Label>
                    <Input
                      value={newStationUrl}
                      onChange={(e) => setNewStationUrl(e.target.value)}
                      placeholder="e.g., https://example.com/stream.m3u or .mp3"
                      className="mt-1 bg-white/10 border-white/20 text-white text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm">Genre</Label>
                    <Input
                      value={newStationGenre}
                      onChange={(e) => setNewStationGenre(e.target.value)}
                      placeholder="e.g., Jazz, Pop, News"
                      className="mt-1 bg-white/10 border-white/20 text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                      onClick={handleAddStation}
                    >
                      Save
                    </button>
                    <button
                      className="flex-1 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium"
                      onClick={() => {
                        setIsAddingStation(false);
                        setNewStationName('');
                        setNewStationUrl('');
                        setNewStationGenre('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {stations.map((station) => (
                  <div
                    key={station.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedStationId === station.id
                        ? 'bg-blue-600/30 border-blue-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedStationId(station.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-white">{station.name}</p>
                        {station.genre && (
                          <p className="text-xs text-white/70">{station.genre}</p>
                        )}
                      </div>
                      {selectedStationId === station.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStation(station.id);
                          }}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Player */}
          <div className="lg:col-span-2 space-y-4">
            {selectedStation && (
              <>
                <div className="frosted-glass rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/15 bg-white/5">
                    <span className="text-white font-semibold text-sm">{selectedStation.name} Player</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {selectedStation.url ? (
                      <div className="space-y-4">
                        <audio
                          controls
                          className="w-full"
                          style={{
                            filter: 'brightness(1.2)',
                          }}
                        >
                          <source src={selectedStation.url} />
                          Your browser does not support the audio element.
                        </audio>
                        <div className="space-y-2">
                          <p className="text-sm text-white font-medium">{selectedStation.name}</p>
                          {selectedStation.genre && (
                            <p className="text-xs text-white/70">Genre: {selectedStation.genre}</p>
                          )}
                          <p className="text-xs text-white/60">Currently tuned to this station</p>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center border border-white/20 border-dashed">
                        <p className="text-white/60">No stream URL configured</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="frosted-glass rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/15 bg-white/5">
                    <span className="text-white font-semibold text-sm">Stream Configuration</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <Label className="text-white text-sm mb-2 block">Stream URL</Label>
                      <Input
                        value={selectedStation.url}
                        onChange={(e) => handleUpdateStationUrl(e.target.value)}
                        placeholder="https://example.com/stream.m3u or .mp3"
                        className="bg-white/10 border-white/20 text-white text-sm font-mono"
                      />
                    </div>
                    <p className="text-xs text-white/65">
                      Enter a valid stream URL (HLS .m3u8, MP3, AAC, or other audio formats) to listen to the station.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: StationPlaylist Traffic & Advertiser Logs */}
      {(activeSection === 'all' || activeSection === 'logs') && (
        <div className={activeSection === 'all' ? 'pt-6 border-t border-white/10' : ''}>
          <TrafficLogsSection compactHeader={activeSection === 'all'} />
        </div>
      )}
    </div>
  );
}

