"use client"
import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { HugeiconsIcon } from '@hugeicons/react';
import PencilEdit01Icon from '@hugeicons/core-free-icons/dist/esm/PencilEdit01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/dist/esm/Delete02Icon';
import AddCircleIcon from '@hugeicons/core-free-icons/dist/esm/AddCircleIcon';
import Image01Icon from '@hugeicons/core-free-icons/dist/esm/Image01Icon';

const functionsEu = getFunctions(app, 'europe-west1');

interface HeroBanner {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  videoUrl?: string;
  showName?: string;
  showId?: string;
  platform?: string;
  days?: string;
  active?: boolean;
  order?: number;
}

const MESH_API_URL = process.env.NEXT_PUBLIC_MESH_API_URL || 'https://edge.solofx.net/rest/v1';
const MESH_ANON_KEY = process.env.NEXT_PUBLIC_MESH_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg3MzM2Mjk0LCJleHAiOjE5NDUwMTYyOTR9.9YCCl_oRCYHQIR3eAhUeLF-SiBqGIxaT9WqCS-YFtNw';

const MESH_SERVICE_KEY = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODczMzYyOTQsImV4cCI6MTk0NTAxNjI5NH0.ahzM4MIlGI6rkukPDvIQH0HkPx4dU95Pdn-Ewl-9C4s';

const meshHeaders = {
  'Content-Type': 'application/json',
  'apikey': MESH_ANON_KEY,
  'Authorization': `Bearer ${MESH_ANON_KEY}`,
};

const meshWriteHeaders = {
  'Content-Type': 'application/json',
  'apikey': MESH_SERVICE_KEY,
  'Authorization': `Bearer ${MESH_SERVICE_KEY}`,
};

async function fetchMeshBanners(): Promise<HeroBanner[] | null> {
  try {
    const res = await fetch('/api/hero-banners', { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.banners)) {
      return data.banners;
    }
    return null;
  } catch (e) {
    console.warn('[Mesh Banners] fetch failed:', e);
    return null;
  }
}

async function saveMeshBanner(bannerData: any): Promise<boolean> {
  try {
    const payload = {
      id: bannerData.id,
      title: bannerData.title,
      description: bannerData.description || '',
      image_url: bannerData.imageUrl,
      video_url: bannerData.videoUrl || null,
      show_name: bannerData.showName || null,
      show_id: bannerData.showId || null,
      platform: bannerData.platform || null,
      days: bannerData.days || '',
      active: bannerData.active !== false,
      position: bannerData.order || 0,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch('/api/hero-banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.warn('[Mesh Banners] save failed:', e);
    return false;
  }
}

async function deleteMeshBanner(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/hero-banners?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    console.warn('[Mesh Banners] delete failed:', e);
    return false;
  }
}

export default function HeroBannersPage() {
  const { user, loading } = useAuth();

  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formShowName, setFormShowName] = useState('');
  const [formShowId, setFormShowId] = useState('');
  const [formPlatform, setFormPlatform] = useState('');
  const [formDays, setFormDays] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formOrder, setFormOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showsList, setShowsList] = useState<{id: string; title: string}[]>([]);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HeroBanner | null>(null);

  useEffect(() => {
    loadBanners();
    loadShows();
  }, []);

  async function loadShows() {
    try {
      const fn = httpsCallable(functionsEu, 'getShowList');
      const result = await fn() as any;
      setShowsList(result.data.shows || []);
    } catch (_) {}
  }

  async function loadBanners() {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Try Supabase Mesh PRIMARY
      const meshBanners = await fetchMeshBanners();
      if (meshBanners) {
        setBanners(meshBanners);
        setIsLoading(false);
        return;
      }

      // 2. Fallback to Firebase
      console.warn('Falling back to Firebase getHeroBanners');
      const fn = httpsCallable(functionsEu, 'getHeroBanners');
      const result = await fn() as any;
      setBanners(result.data.banners || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormTitle('');
    setFormDescription('');
    setFormImageUrl('');
    setFormVideoUrl('');
    setFormShowName('');
    setFormShowId('');
    setFormPlatform('');
    setFormDays('');
    setFormActive(true);
    setFormOrder(0);
    setEditOpen(true);
  }

  function openEdit(banner: HeroBanner) {
    setEditing(banner);
    setFormTitle(banner.title);
    setFormDescription(banner.description || '');
    setFormImageUrl(banner.imageUrl);
    setFormVideoUrl(banner.videoUrl || '');
    setFormShowName(banner.showName || '');
    setFormShowId(banner.showId || '');
    setFormPlatform(banner.platform || '');
    setFormDays(banner.days || '');
    setFormActive(banner.active !== false);
    setFormOrder(banner.order || 0);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!formTitle || !formImageUrl) return;
    setSaving(true);
    try {
      const bannerId = editing?.id || `banner_${Date.now()}`;
      const payload = {
        id: bannerId,
        title: formTitle,
        description: formDescription,
        imageUrl: formImageUrl,
        videoUrl: formVideoUrl || null,
        showName: formShowName || null,
        showId: formShowId || null,
        platform: formPlatform || null,
        days: formDays,
        active: formActive,
        order: formOrder,
      };

      // 1. Write to Supabase Mesh (PRIMARY)
      await saveMeshBanner(payload);

      // 2. Write to Firebase Cloud Function (FALLBACK / BACKUP)
      try {
        const fn = httpsCallable(functionsEu, 'saveHeroBanner');
        await fn(payload);
      } catch (fbErr: any) {
        console.warn('Firebase saveHeroBanner fallback warning:', fbErr.message);
      }

      setEditOpen(false);
      await loadBanners();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      // 1. Delete from Supabase Mesh (PRIMARY)
      await deleteMeshBanner(deleteTarget.id);

      // 2. Delete from Firebase (FALLBACK / BACKUP)
      try {
        const fn = httpsCallable(functionsEu, 'deleteHeroBanner');
        await fn({ id: deleteTarget.id });
      } catch (fbErr: any) {
        console.warn('Firebase deleteHeroBanner fallback warning:', fbErr.message);
      }

      setDeleteOpen(false);
      await loadBanners();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  }

  if (loading) return <div className="p-8 text-center">Loading authentication...</div>;
  if (!user) redirect('/login');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Hero Banners</h1>
          <p className="mt-2 text-white/70">Manage promotional banner slides with optional video trailers</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
          <HugeiconsIcon icon={AddCircleIcon} size={16} className="mr-2" />
          New Banner
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="frosted-glass overflow-hidden">
              <Skeleton className="aspect-video w-full bg-white/20" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-white/20" />
                <Skeleton className="h-3 w-1/2 bg-white/20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="text-red-300">Error: {error}</div>}

      {!isLoading && !error && banners.length === 0 && (
        <div className="frosted-glass text-center py-12 text-white/50 border-dashed border-white/20">
          <HugeiconsIcon icon={Image01Icon} size={48} className="mx-auto mb-4 opacity-50" />
          No hero banners yet. Click "New Banner" to create one.
        </div>
      )}

      {!isLoading && banners.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banners.map((banner) => (
            <div key={banner.id} className="frosted-glass overflow-hidden group relative">
              <div className="aspect-video bg-white/10 relative overflow-hidden">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {banner.videoUrl && (
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-semibold">
                    Has Trailer
                  </span>
                )}
                <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded font-semibold ${
                  banner.active !== false ? 'bg-green-600 text-white' : 'bg-gray-600 text-white/60'
                }`}>
                  {banner.active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-white font-semibold truncate">{banner.title}</h3>
                {banner.description && (
                  <p className="text-white/60 text-sm mt-1 line-clamp-2">{banner.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                  {banner.days && <span>📅 {banner.days}</span>}
                  {banner.platform && <span>📺 {banner.platform}</span>}
                  <span>#{banner.order || 0}</span>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-8 bg-blue-600/80 hover:bg-blue-700 text-white"
                  onClick={() => openEdit(banner)}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="size-8 bg-red-600/80 hover:bg-red-700 text-white"
                  onClick={() => { setDeleteTarget(banner); setDeleteOpen(true); }}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Banner' : 'New Banner'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Banner title" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Short description" />
            </div>
            <div className="grid gap-2">
              <Label>Image URL *</Label>
              <Input value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label>Video URL (trailer — optional)</Label>
              <Input value={formVideoUrl} onChange={e => setFormVideoUrl(e.target.value)} placeholder="https://... (MP4 or HLS)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Show</Label>
                <Select
                  value={formShowId}
                  onValueChange={(val) => {
                    const show = showsList.find(s => s.id === val);
                    setFormShowId(val);
                    setFormShowName(show?.title || val);
                  }}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Select a show..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    {showsList.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-white">
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Show ID</Label>
                <Input value={formShowId} readOnly className="bg-white/5 text-white/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Platform</Label>
                <Input value={formPlatform} onChange={e => setFormPlatform(e.target.value)} placeholder="tv / radio / ondemand" />
              </div>
              <div className="grid gap-2">
                <Label>Order</Label>
                <Input type="number" value={formOrder} onChange={e => setFormOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Days (comma-separated, leave empty for all)</Label>
              <Input value={formDays} onChange={e => setFormDays(e.target.value)} placeholder="monday,wednesday,friday" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="active" className="cursor-pointer">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formTitle || !formImageUrl}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Banner</DialogTitle>
          </DialogHeader>
          <p className="text-white/70">Delete "{deleteTarget?.title}"? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
