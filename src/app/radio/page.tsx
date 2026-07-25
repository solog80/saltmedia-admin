'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

interface RadioStation {
  id: string;
  name: string;
  url: string;
  description?: string;
  genre?: string;
}

export default function RadioPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Radio Stations</h1>
        <p className="mt-2 text-white/70">Manage and listen to radio stations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Station List */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Stations
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsAddingStation(!isAddingStation)}
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAddingStation && (
              <div className="space-y-3 p-3 bg-white/5 rounded-lg border border-white/10">
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
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleAddStation}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsAddingStation(false);
                      setNewStationName('');
                      setNewStationUrl('');
                      setNewStationGenre('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {stations.map((station) => (
                <div
                  key={station.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedStationId === station.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => setSelectedStationId(station.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{station.name}</p>
                      {station.genre && (
                        <p className="text-xs opacity-70">{station.genre}</p>
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
          </CardContent>
        </Card>

        {/* Player */}
        <div className="lg:col-span-2 space-y-4">
          {selectedStation && (
            <>
              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">{selectedStation.name} Player</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          <p className="text-xs text-white/60">Genre: {selectedStation.genre}</p>
                        )}
                        <p className="text-xs text-white/50">Currently tuned to this station</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center border border-white/20 border-dashed">
                      <p className="text-white/50">No stream URL configured</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Stream Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-white text-sm mb-2 block">Stream URL</Label>
                    <Input
                      value={selectedStation.url}
                      onChange={(e) => handleUpdateStationUrl(e.target.value)}
                      placeholder="https://example.com/stream.m3u or .mp3"
                      className="bg-white/10 border-white/20 text-white text-sm font-mono"
                    />
                  </div>
                  <p className="text-xs text-white/50">
                    Enter a valid stream URL (HLS .m3u8, MP3, AAC, or other audio formats) to listen to the station.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
