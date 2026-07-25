'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';

interface TVChannel {
  id: string;
  name: string;
  url: string;
  description?: string;
  thumbnail?: string;
}

export default function TVPage() {
  const [channels, setChannels] = useState<TVChannel[]>([
    {
      id: '1',
      name: 'Channel 1',
      url: '',
      description: 'Main TV Channel',
    },
  ]);
  const [selectedChannelId, setSelectedChannelId] = useState('1');
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelUrl, setNewChannelUrl] = useState('');

  const selectedChannel = channels.find(ch => ch.id === selectedChannelId);

  const handleAddChannel = () => {
    if (!newChannelName || !newChannelUrl) {
      alert('Please fill in channel name and URL');
      return;
    }

    const newChannel: TVChannel = {
      id: Date.now().toString(),
      name: newChannelName,
      url: newChannelUrl,
      description: '',
    };

    setChannels([...channels, newChannel]);
    setNewChannelName('');
    setNewChannelUrl('');
    setIsAddingChannel(false);
    setSelectedChannelId(newChannel.id);
  };

  const handleUpdateChannelUrl = (url: string) => {
    if (!selectedChannel) return;
    setChannels(channels.map(ch =>
      ch.id === selectedChannelId ? { ...ch, url } : ch
    ));
  };

  const handleDeleteChannel = (id: string) => {
    if (channels.length <= 1) {
      alert('You must have at least one channel');
      return;
    }
    const newChannels = channels.filter(ch => ch.id !== id);
    setChannels(newChannels);
    if (selectedChannelId === id) {
      setSelectedChannelId(newChannels[0].id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">TV Channels</h1>
        <p className="mt-2 text-white/70">Manage and preview TV channels</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel List */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Channels
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsAddingChannel(!isAddingChannel)}
              >
                <Plus size={16} className="mr-1" />
                Add
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isAddingChannel && (
              <div className="space-y-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <Label className="text-white text-sm">Channel Name</Label>
                  <Input
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g., Channel 1"
                    className="mt-1 bg-white/10 border-white/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm">Stream URL</Label>
                  <Input
                    value={newChannelUrl}
                    onChange={(e) => setNewChannelUrl(e.target.value)}
                    placeholder="e.g., https://example.com/stream.m3u8"
                    className="mt-1 bg-white/10 border-white/20 text-white text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleAddChannel}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsAddingChannel(false);
                      setNewChannelName('');
                      setNewChannelUrl('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedChannelId === channel.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                  onClick={() => setSelectedChannelId(channel.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{channel.name}</p>
                      {channel.description && (
                        <p className="text-xs opacity-70 mt-1">{channel.description}</p>
                      )}
                    </div>
                    {selectedChannelId === channel.id && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteChannel(channel.id);
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

        {/* Preview Player */}
        <div className="lg:col-span-2 space-y-4">
          {selectedChannel && (
            <>
              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">{selectedChannel.name} Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedChannel.url ? (
                    <div className="space-y-2">
                      <VideoPlayer
                        videoUrl={selectedChannel.url}
                        className="w-full rounded-lg"
                      />
                      <p className="text-xs text-white/50">Currently playing: {selectedChannel.name}</p>
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
                  <CardTitle className="text-white text-lg">Stream URL</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-white text-sm mb-2 block">Current URL</Label>
                    <Input
                      value={selectedChannel.url}
                      onChange={(e) => handleUpdateChannelUrl(e.target.value)}
                      placeholder="https://example.com/stream.m3u8"
                      className="bg-white/10 border-white/20 text-white text-sm font-mono"
                    />
                  </div>
                  <p className="text-xs text-white/50">
                    Enter a valid HLS (.m3u8) or MP4 stream URL to preview the channel.
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
