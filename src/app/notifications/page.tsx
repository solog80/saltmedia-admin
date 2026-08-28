'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Send, Loader2, Search, Check, Image as ImageIcon, Globe, Signal, Wifi, BatteryFull, Tv, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface SentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  image_url?: string;
  user_id?: string | null;
  is_broadcast: boolean;
  recipients: number;
  created_at: string;
}

type NotificationTarget = 'all' | 'individual';

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  broadcast: 'bg-slate-500',
};

const safeImgUrl = (u?: string) => (u && u.includes(' ') ? encodeURI(u) : u);

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create-form state
  const [target, setTarget] = useState<NotificationTarget>('all');
  const [userId, setUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedContentKey, setSelectedContentKey] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Sent log
  const { data, isLoading, isError } = useQuery<{ notifications: SentNotification[] }>({
    queryKey: ['sentNotifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return await res.json();
    },
    staleTime: 1000 * 30,
  });

  // User search (individual target)
  const userSearchQuery = useQuery({
    queryKey: ['user-search', userSearch],
    queryFn: async () => {
      const res = await fetch(`/api/users?searchTerm=${encodeURIComponent(userSearch)}`);
      return await res.json();
    },
    enabled: target === 'individual' && userSearch.trim().length >= 2,
  });

  // Content options (on-demand shows, events, TV + radio EPG) for the picker.
  const contentOptionsQuery = useQuery({
    queryKey: ['content-options'],
    queryFn: async () => {
      const [od, ev, epg] = await Promise.all([
        fetch('/api/ondemand').then((r) => r.json().catch(() => null)),
        fetch('/api/events').then((r) => r.json().catch(() => null)),
        fetch('/api/epg?admin=1').then((r) => r.json().catch(() => null)),
      ]);
      const shows = (od?.data?.shows || od?.shows || []).map((s: any) => ({
        key: `show:${s.id}`, kind: 'show', id: s.id, title: s.title,
        description: s.description || '', image: s.posterUrl16x9 || s.posterUrl2x3 || '',
      }));
      const events = (ev?.events || []).map((e: any) => ({
        key: `event:${e.id}`, kind: 'event', id: e.id, title: e.title,
        description: '', image: e.imageUrl || '',
      }));
      const tvPrograms: any[] = [];
      const tvSeen = new Set<string>();
      const tvData = epg?.data?.tv || {};
      Object.entries(tvData).forEach(([station, s]: any) => {
        (s?.programs || []).forEach((p: any) => {
          const key = `tv:${station}:${p.programName}`;
          if (tvSeen.has(key)) return;
          tvSeen.add(key);
          tvPrograms.push({
            key, kind: 'tv', id: `${station}|${p.programName}`,
            title: p.programName, description: p.details || '', image: p.thumbnail || p.image || '',
          });
        });
      });
      const radioSeen = new Set<string>();
      const radioPrograms = (epg?.data?.radio?.programs || [])
        .filter((p: any) => {
          const k = `radio:${p.programName}`;
          if (radioSeen.has(k)) return false;
          radioSeen.add(k);
          return true;
        })
        .map((p: any) => ({
          key: `radio:${p.programName}`, kind: 'radio', id: p.programName,
          title: p.programName, description: p.details || '', image: p.thumbnail || p.image || '',
        }));
      return [...shows, ...events, ...tvPrograms, ...radioPrograms];
    },
    enabled: dialogOpen,
  });

  const CONTENT_KIND_LABEL: Record<string, string> = {
    show: 'SHOW', event: 'EVENT', tv: 'TV', radio: 'RADIO',
  };

  const applyContent = (key: string) => {
    const c = contentOptionsQuery.data?.find((x: any) => x.key === key);
    if (!c) return;
    setTitle(c.title);
    setMessage(c.description || '');
    if (c.image) setImageUrl(encodeURI(c.image)); // encode spaces (e.g. THE%20DIALOGUE)
    setLink(`https://edge.solofx.net/${c.kind}/${encodeURIComponent(c.id)}`);
    setSelectedContentKey(key);
  };

  const sendMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send');
      return data;
    },
    onSuccess: (data) => {
      setDialogOpen(false);
      setSuccess(`Notification sent to ${data.recipients} device${data.recipients === 1 ? '' : 's'}`);
      setTimeout(() => setSuccess(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['sentNotifications'] });
      setTitle(''); setMessage(''); setType('info'); setImageUrl(''); setLink(''); setUserId(''); setUserSearch(''); setSelectedContentKey('');
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to send notification');
      setTimeout(() => setError(null), 5000);
    },
  });

  const fetchLinkMetadata = async () => {
    if (!link.startsWith('http')) return;
    setIsFetchingMeta(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getLinkMetadata', url: link }),
      });
      const data = await res.json();
      if (data?.success && data.metadata) {
        if (!title && data.metadata.title) setTitle(data.metadata.title);
        if (!message && data.metadata.description) setMessage(data.metadata.description);
        if (!imageUrl && data.metadata.image) setImageUrl(data.metadata.image);
      }
    } catch { /* ignore */ } finally {
      setIsFetchingMeta(false);
    }
  };

  const resizeImageToJpeg = (file: File, maxDim: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas unsupported'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('invalid image'));
      };
      img.src = url;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const base64 = await resizeImageToJpeg(file, 1600);
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'uploadImage', imageBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setImageUrl(data.url);
    } catch (err: any) {
      alert('Image upload failed: ' + (err?.message || err));
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (target === 'individual' && !userId) {
      setError('Select a recipient user.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    sendMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      type,
      link: link.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      userId: target === 'individual' ? userId : undefined,
    });
  };

  const notifications = data?.notifications || [];

  return (
    <div className="p-6 space-y-6">
      {error && (
        <Alert className="border-red-500/40 bg-red-500/10 text-red-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500/40 bg-green-500/10 text-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="text-blue-300" /> Notifications
          </h1>
          <p className="text-white/60 text-sm mt-1">Send broadcast push notifications to your audience.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Notification
          </Button>
          <DialogContent
            className="sm:max-w-6xl 2xl:max-w-7xl w-[min(95vw,1152px)] 2xl:w-[min(95vw,1280px)] max-h-[92vh] overflow-y-auto border-white/20 text-white"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-white">Broadcast Notification</DialogTitle>
              <DialogDescription className="text-white/60">
                Send a push notification to everyone, or to one user.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                {/* Content picker */}
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-xs">Quick content picker (optional)</Label>
                  <Select value={selectedContentKey} onValueChange={(v) => applyContent(v ?? '')}>
                    <SelectTrigger className="w-full h-9 bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder={contentOptionsQuery.isLoading ? 'Loading shows...' : 'Pick a show or event...'} />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/20 text-white max-h-72">
                      {contentOptionsQuery.data?.length ? (
                        contentOptionsQuery.data.map((c: any) => (
                          <SelectItem key={c.key} value={c.key}>
                            {CONTENT_KIND_LABEL[c.kind] || c.kind.toUpperCase()} - {c.title}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-white/50">
                          {contentOptionsQuery.isLoading ? 'Loading...' : 'No shows or events'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedContentKey && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-blue-300" onClick={() => { setSelectedContentKey(''); }}>
                      Clear selection
                    </Button>
                  )}
                </div>

                {/* Target */}
                <div className="space-y-1.5">
                  <Label className="text-white/80 text-xs">Target Audience</Label>
                  <Select value={target} onValueChange={(v) => setTarget(v as NotificationTarget)}>
                    <SelectTrigger className="w-full h-9 bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/20 text-white">
                      <SelectItem value="all">Everyone (Broadcast)</SelectItem>
                      <SelectItem value="individual">Individual User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {target === 'individual' && (
                  <div className="space-y-1.5 relative">
                    <Label className="text-white/80 text-xs">Recipient User</Label>
                    <Input
                      value={userSearch}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                      onChange={(e) => { setUserSearch(e.target.value); setSearchOpen(true); }}
                      placeholder="Search by name or email..."
                      className="h-9 bg-white/10 border-white/20 text-white placeholder-white/40"
                    />
                    {searchOpen && userSearchQuery.data?.users?.length ? (
                      <div className="absolute z-20 w-full mt-1 bg-neutral-900 border border-white/20 rounded-md shadow-xl max-h-60 overflow-y-auto">
                        {userSearchQuery.data.users.map((u: any) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 p-2 hover:bg-white/10 cursor-pointer transition"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setUserId(u.id); setUserSearch(u.email || u.name || u.id); setSearchOpen(false); }}
                          >
                            <div className="h-8 w-8 rounded-full bg-blue-600/40 flex items-center justify-center text-white font-semibold text-xs">
                              {(u.name || 'U')[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{u.name || 'User'}</p>
                              <p className="text-xs text-white/50 truncate">{u.email || u.id}</p>
                            </div>
                            {userId === u.id && <Check className="h-4 w-4 text-blue-400" />}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-white/80 text-xs">Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Episode Tonight!" className="h-9 bg-white/10 border-white/20 text-white placeholder-white/40" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/80 text-xs">Message</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="What do you want to say?" className="bg-white/10 border-white/20 text-white placeholder-white/40 min-h-[52px]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-white/80 text-xs">Style</Label>
                    <Select value={type} onValueChange={(v) => setType(v ?? 'info')}>
                      <SelectTrigger className="w-full h-9 bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-white/20 text-white">
                        <SelectItem value="info">Blue (Information)</SelectItem>
                        <SelectItem value="success">Green (Announcement)</SelectItem>
                        <SelectItem value="warning">Orange (Alert)</SelectItem>
                        <SelectItem value="error">Red (Critical)</SelectItem>
                        <SelectItem value="broadcast">Gray (Broadcast)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-white/80 text-xs">Image URL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="h-9 flex-1 bg-white/10 border-white/20 text-white placeholder-white/40" />
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => imageFileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
                      </Button>
                      <input ref={imageFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-white/80 text-xs">Action Link (optional)</Label>
                    {link.startsWith('http') && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-blue-300" onClick={fetchLinkMetadata} disabled={isFetchingMeta}>
                        {isFetchingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Fetch Info'}
                      </Button>
                    )}
                  </div>
                  <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://edge.solofx.net/..." className="h-9 bg-white/10 border-white/20 text-white placeholder-white/40" />
                </div>

                {target === 'all' && (
                  <Alert className="py-2 bg-amber-500/10 border-amber-500/30 text-amber-200">
                    <AlertDescription className="text-[11px]">
                      Sends a push notification to every registered device.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-white border-white/20">Cancel</Button>
                  <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {target === 'all' ? 'Broadcast' : 'Send'}
                  </Button>
                </div>
              </div>

              {/* Live preview */}
              <div className="space-y-3">
                <Label className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Mobile Preview
                </Label>
                <div className="relative mx-auto w-[230px] h-[420px] bg-gradient-to-b from-slate-900 to-black rounded-[2.2rem] border-[6px] border-white/15 overflow-hidden shadow-2xl">
                  {/* Screen wallpaper */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-slate-900 to-black" />
                  {/* Status bar */}
                  <div className="absolute top-3 left-0 right-0 px-5 flex justify-between items-center text-[9px] font-medium text-white/80 z-20">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                      <Signal className="w-2.5 h-2.5" />
                      <Wifi className="w-2.5 h-2.5" />
                      <BatteryFull className="w-3 h-3" />
                    </div>
                  </div>
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-b-xl z-20" />
                  {/* Notification */}
                  <div className="absolute top-9 left-0 right-0 px-3 z-10 space-y-2">
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="w-4 h-4 rounded-md bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
                        <Tv className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-[8px] font-bold text-white/90 uppercase tracking-wide">SALT TV</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 shadow-2xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full ${TYPE_COLORS[type] || TYPE_COLORS.info}`} />
                          <span className="text-[8px] font-bold text-white/90 uppercase">{type}</span>
                        </div>
                        <span className="text-[8px] text-white/40 font-medium">now</span>
                      </div>
                      <h4 className="text-[12px] font-bold text-white leading-tight">{title || 'Your Title Here'}</h4>
                      <p className="text-[10px] text-white/70 leading-snug line-clamp-3 mt-0.5">{message || 'Your message text...'}</p>
                      {imageUrl && (
  <div className="mt-2 rounded-lg overflow-hidden border border-white/10 bg-black/40">
    <img key={imageUrl} src={safeImgUrl(imageUrl)} alt="" className="w-full aspect-video object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
  </div>
)}
                    </div>
                  </div>
                  {/* Home indicator */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/25 rounded-full z-20" />
                </div>
                {link && (
                  <Card className="border-white/10 bg-white/5">
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2 text-[11px] text-white/60">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">{link}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sent log */}
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Sent History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-white/60">Title</TableHead>
                  <TableHead className="text-white/60">Type</TableHead>
                  <TableHead className="text-white/60">Target</TableHead>
                  <TableHead className="text-white/60 text-right">Recipients</TableHead>
                  <TableHead className="text-white/60 text-right">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-white/5">
                      <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow className="border-white/5">
                    <TableCell colSpan={5} className="text-white/60 text-center py-8">Failed to load sent notifications.</TableCell>
                  </TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow className="border-white/5">
                    <TableCell colSpan={5} className="text-white/40 text-center py-10">
                      No notifications sent yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n.id} className="border-white/5">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {n.image_url ? <img key={n.image_url} src={safeImgUrl(n.image_url)} alt="" className="h-8 w-12 rounded object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <div className="h-8 w-12 rounded bg-white/10 flex items-center justify-center"><Bell className="h-4 w-4 text-white/50" /></div>}
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{n.title}</p>
                            <p className="text-xs text-white/50 line-clamp-1">{n.message}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge className={`${TYPE_COLORS[n.type] || TYPE_COLORS.info} text-white`}>{n.type}</Badge></TableCell>
                      <TableCell className="text-white/60 text-sm">{n.is_broadcast ? 'Everyone' : 'Individual'}</TableCell>
                      <TableCell className="text-white/70 text-right">{n.recipients}</TableCell>
                      <TableCell className="text-white/50 text-right whitespace-nowrap text-sm">{new Date(n.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}