'use client';

import { useEffect, useState } from 'react';
import BroadcastTabs from './BroadcastTabs';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mesh, BROADCAST_CONFIG_TABLE } from '@/lib/mesh';

const PREVIEW_PORT_OFFSET = 1000;

function getPreviewUrl(streamUrl: string): string | null {
  if (!streamUrl.startsWith('srt://')) return null;
  try { const u = new URL(streamUrl.replace('srt://', 'http://')); const p = u.port ? Number(u.port) + PREVIEW_PORT_OFFSET : 0; return p ? `srt://${u.hostname}:${p}${u.search}` : null; } catch { return null; }
}

function ColorBars() { const c=['#ffffff','#ffff00','#00ffff','#00ff00','#ff00ff','#ff0000','#0000ff']; return <svg viewBox="0 0 640 480" className="w-full h-full">{c.map((x,i)=><rect key={i} x={i*91.4} y={0} width={91.4} height={280} fill={x}/>)}<rect x={0} y={280} width={213.3} height={60} fill="#406080"/><rect x={213.3} y={280} width={213.3} height={60} fill="#fff"/><rect x={426.6} y={280} width={213.3} height={60} fill="#c06080"/>{[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*91.4} y={340} width={91.4} height={140} fill={['#000','#102030','#000','#203040','#000','#101010','#000'][i]}/>)}</svg>; }

function StreamPreview({ snapshot }: { snapshot?: string }) { const url = snapshot ? `data:image/jpeg;base64,${snapshot}` : null; return url ? <img src={url} className="w-full h-full object-contain" alt="" /> : null; }

type BroadcastStatus = { id: string; uid?: string; broadcasterName?: string; isLive: boolean; uptime: number; bitrate: number; rttMs: number; packetsDropped: number; returnFeedUrl: string; streamUrl?: string; snapshot?: string; talkbackActive: boolean; lastSeen?: { toDate: () => Date }; };
type BroadcastConfig = Record<string, any>;

function DestForm({ form, setForm, onSave, onCancel }: any) {
  const isSrt = form.protocol === 'srt';
  const isWebRtc = form.protocol === 'webrtc';
  return <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
    <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-semibold">{form.id ? 'Edit' : 'Add'} Destination</h3>
      <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Name" value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} />
      <select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={form.protocol||'srt'} onChange={e => setForm({...form, protocol: e.target.value})}>
        <option value="srt" className="text-black">SRT</option>
        <option value="rtmp" className="text-black">RTMP</option>
        <option value="webrtc" className="text-black">WHIP (WebRTC)</option>
      </select>
      {isSrt ? (
        <div className="grid grid-cols-2 gap-2">
          <input className="col-span-2 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Host" value={form.host||''} onChange={e => setForm({...form, host: e.target.value})} />
          <input className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" placeholder="Port" value={form.port||''} onChange={e => setForm({...form, port: Number(e.target.value)})} />
          <input className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Stream ID" value={form.streamId||''} onChange={e => setForm({...form, streamId: e.target.value})} />
          <input className="col-span-2 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Passphrase" value={form.passphrase||''} onChange={e => setForm({...form, passphrase: e.target.value})} />
        </div>
      ) : isWebRtc ? (
        <div className="space-y-2">
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="WHIP URL (e.g. http://host:8080/app/stream?direction=whip)" value={form.webrtcUrl||''} onChange={e => setForm({...form, webrtcUrl: e.target.value})} />
        </div>
      ) : (
        <div className="space-y-2">
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="RTMP URL" value={form.rtmpUrl||''} onChange={e => setForm({...form, rtmpUrl: e.target.value})} />
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Stream Key" value={form.streamKey||''} onChange={e => setForm({...form, streamKey: e.target.value})} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer pt-1">
        <input type="checkbox" checked={form.isDefault||false} onChange={e => setForm({...form, isDefault: e.target.checked})} /> Default Destination
      </label>
      <div className="flex gap-2 pt-2">
        <button className="flex-1 bg-amber-500 text-black rounded py-2 text-sm font-bold" onClick={onSave}>Save</button>
        <button className="flex-1 bg-white/10 text-white rounded py-2 text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  </div>;
}

export default function BroadcastPage() {
  const [devices, setDevices] = useState<BroadcastStatus[]>([]);
  const [config, setConfig] = useState<BroadcastConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDestForm, setShowDestForm] = useState(false);
  const [destForm, setDestForm] = useState<any>({protocol:'srt'});
  const [editDest, setEditDest] = useState<any>(null);
  const [radio, setRadio] = useState<Record<string, any> | null>(null);
  const [radioSaving, setRadioSaving] = useState(false);

  // Mesh key = Firebase UID (broadcasts/<id> may use a custom broadcasterId,
  // so prefer the `uid` field when present).
  const meshUid = devices.find(d => d.id === selectedId)?.uid || selectedId || '';

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'broadcasts'), orderBy('lastSeen','desc')), snap => { const list: BroadcastStatus[] = []; snap.forEach(d => list.push({ id: d.id, ...d.data() } as BroadcastStatus)); setDevices(list); });
    return () => unsub();
  }, []);

  // TV + radio settings: protected REST load (admin session) + live Realtime.
  useEffect(() => {
    if (!selectedId) { setConfig(null); setRadio(null); return; }
    let active = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/broadcast_settings?uid=${encodeURIComponent(meshUid)}`,
          { cache: 'no-store' },
        );
        const data = res.ok ? await res.json() : null;
        if (!active) return;
        setConfig((data?.tv as BroadcastConfig) || {});
        setRadio((data?.radio as Record<string, any>) || {});
      } catch {
        if (active) { setConfig({}); setRadio({}); }
      }
    })();

    // Realtime reads use the public anon key (RLS is SELECT-only); all writes
    // go through /api/broadcast_settings.
    const channel = mesh
      .channel(`broadcast_config:${meshUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: BROADCAST_CONFIG_TABLE, filter: `user_id=eq.${meshUid}` },
        (payload: any) => {
          if (!active) return;
          const row = payload?.new;
          if (row?.tv) setConfig(row.tv as BroadcastConfig);
          if (row?.radio) setRadio(row.radio as Record<string, any>);
        },
      )
      .subscribe();

    return () => { active = false; mesh.removeChannel(channel); };
  }, [selectedId, meshUid]);

  const updateConfig = async (updates: Partial<BroadcastConfig>) => {
    if (!selectedId || !meshUid) return;
    setSaving(true);
    try {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(updates)) if (v !== undefined) clean[k] = v;
      setConfig({ ...(config || {}), ...clean });
      const res = await fetch('/api/broadcast_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: meshUid, tv: clean }),
      });
      const text = await res.text();
      if (!res.ok || !text.trim().startsWith('{')) {
        console.error('[broadcast_settings] save failed', res.status, text.slice(0, 200), { meshUid, clean });
        alert(`Save failed (${res.status}). Are you signed in via /login?`);
      } else {
        console.log('[broadcast_settings] saved', { meshUid, keys: Object.keys(clean) });
      }
    } catch (e) {
      console.error('[broadcast_settings] save error', e);
      alert(`Save error: ${e}`);
    } finally { setSaving(false); }
  };

  const setRadioField = (key: string, value: any) => setRadio({ ...(radio || {}), [key]: value });

  const saveRadio = async (patch?: Record<string, any>) => {
    if (!meshUid) return;
    const next = { ...(radio || {}), ...(patch || {}) };
    setRadio(next);
    setRadioSaving(true);
    try {
      const res = await fetch('/api/broadcast_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: meshUid, radio: next }),
      });
      const text = await res.text();
      if (!res.ok || !text.trim().startsWith('{')) {
        console.error('[broadcast_settings] radio save failed', res.status, text.slice(0, 200), { meshUid });
        alert(`Radio save failed (${res.status})`);
      }
    } finally {
      setRadioSaving(false);
    }
  };

  const saveDest = () => {
    let dests = [...(config?.destinations || [])];
    if (destForm.isDefault) {
      dests = dests.map((d: any) => ({ ...d, isDefault: false }));
    }
    if (editDest) { const i = dests.findIndex((d:any) => d.id === editDest.id); if (i>=0) dests[i] = { ...destForm, id: editDest.id }; }
    else dests.push({ ...destForm, id: `dest_${Date.now()}` });
    updateConfig({ destinations: dests }); setShowDestForm(false); setEditDest(null);
  };

  const delDest = (id: string) => updateConfig({ destinations: (config?.destinations||[]).filter((d:any) => d.id !== id) });

  const tvSections: any[] = [
    { key: 'broadcaster', label: 'Broadcaster', fields: [
      { key: 'broadcasterName', label: 'Display Name', type: 'text' },
    ]},
    { key: 'returnFeed', label: 'Return Feed', fields: [
      { key: 'url', label: 'SRT URL', type: 'text' },
      { key: 'latencyMs', label: 'Latency (ms)', type: 'number' },
      { key: 'srtPassphrase', label: 'Passphrase', type: 'text' },
      { key: 'srtSenderMode', label: 'Sender Mode', type: 'select', options: [
        {v:'caller', l:'Caller'}, {v:'listener', l:'Listener'}, {v:'rendezvous', l:'Rendezvous'}]},
      { key: 'backend', label: 'Backend', type: 'select', options: [
        {v:'auto', l:'Auto'}, {v:'srtPlatform', l:'Native SRT'}]},
      { key: 'maxHeight', label: 'Max Height', type: 'select', numeric: true, options: [
        {v:'0', l:'Full'}, {v:'1080', l:'1080p'}, {v:'720', l:'720p'}, {v:'480', l:'480p'}]},
      { key: 'autoplayOnLive', label: 'Autoplay on live', type: 'bool' },
      { key: 'startMuted', label: 'Start muted', type: 'bool' },
    ]},
    { key: 'talkback', label: 'Talkback', fields: [
      { key: 'talkbackEnabled', label: 'Enabled', type: 'bool' },
      { key: 'talkbackUrl', label: 'SRT URL', type: 'text' },
      { key: 'talkbackLatencyMs', label: 'Latency (ms)', type: 'number' },
      { key: 'talkbackPassphrase', label: 'Passphrase', type: 'text' },
    ]},
    { key: 'encoder', label: 'Encoder', fields: [
      { key: 'encoderResolution', label: 'Resolution', type: 'select', options: [
        {v:'1080p', l:'1080p'}, {v:'720p', l:'720p'}, {v:'540p', l:'540p'}]},
      { key: 'encoderFps', label: 'FPS', type: 'select', numeric: true, options: [
        {v:'25', l:'25'}, {v:'30', l:'30'}, {v:'50', l:'50'}, {v:'60', l:'60'}]},
      { key: 'encoderBitrate', label: 'Video bitrate (Mbps)', type: 'mbps' },
      { key: 'encoderCodec', label: 'Codec', type: 'select', options: [
        {v:'avc', l:'H.264'}, {v:'hevc', l:'H.265'}]},
      { key: 'audioBitrateBps', label: 'Audio bitrate (kbps)', type: 'kbps' },
      { key: 'mirrorFrontCamera', label: 'Mirror front camera', type: 'bool' },
      { key: 'oledPowerSaverEnabled', label: 'OLED power saver', type: 'bool' },
      { key: 'oledPowerSaverTimeoutSeconds', label: 'OLED timeout (s)', type: 'number' },
    ]},
    { key: 'recording', label: 'Recording', fields: [
      { key: 'recordingEnabled', label: 'Enabled', type: 'bool' },
      { key: 'recordingResolution', label: 'Resolution', type: 'select', options: [
        {v:'720p', l:'720p'}, {v:'1080p', l:'1080p'}, {v:'1440p', l:'1440p'}]},
      { key: 'recordingBitrate', label: 'Recording bitrate (Mbps)', type: 'mbps' },
      { key: 'recordingFps', label: 'FPS', type: 'select', numeric: true, options: [
        {v:'24', l:'24'}, {v:'25', l:'25'}, {v:'30', l:'30'}]},
      { key: 'recordingCodec', label: 'Codec', type: 'select', options: [
        {v:'avc', l:'H.264'}, {v:'hevc', l:'H.265'}]},
    ]},
    { key: 'destinations', label: 'Destinations', fields: [] },
  ];

  const saveLock = (key: string, locked: boolean) => {
    const locks = { ...(config?.locks || {}), [key]: locked };
    setConfig({ ...(config || {}), locks });
    updateConfig({ locks });
  };

  const renderTvField = (f: any) => {
    const v = config?.[f.key];
    if (f.type === 'bool') {
      return (
        <label key={f.key} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input type="checkbox" checked={!!v}
            onChange={e => { updateConfig({ [f.key]: e.target.checked }); }} />
          {f.label}
        </label>
      );
    }
    if (f.type === 'select') {
      return (
        <div key={f.key}>
          <label className="block text-sm text-white/60 mb-1">{f.label}</label>
          <select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
            value={v === undefined || v === null ? String(f.options[0].v) : String(v)}
            onChange={e => updateConfig({ [f.key]: f.numeric ? Number(e.target.value) : e.target.value })}>
            {f.options.map((o: any) => <option key={o.v} value={o.v} className="text-black">{o.l}</option>)}
          </select>
        </div>
      );
    }
    if (f.type === 'mbps' || f.type === 'kbps') {
      const scale = f.type === 'mbps' ? 1e6 : 1e3;
      const display = v === undefined || v === null || v === '' ? '' : String(Number(v) / scale);
      return (
        <div key={f.key}>
          <label className="block text-sm text-white/60 mb-1">{f.label}</label>
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
            type="number" step={f.type === 'mbps' ? '0.1' : '1'}
            value={display}
            onChange={e => setConfig({ ...(config || {}), [f.key]: e.target.value === '' ? 0 : Math.round(Number(e.target.value) * scale) })}
            onBlur={e => updateConfig({ [f.key]: e.target.value === '' ? 0 : Math.round(Number(e.target.value) * scale) })} />
        </div>
      );
    }
    return (
      <div key={f.key}>
        <label className="block text-sm text-white/60 mb-1">{f.label}</label>
        <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
          type={f.type === 'number' ? 'number' : 'text'}
          value={v === undefined || v === null ? '' : v}
          onChange={e => setConfig({ ...(config || {}), [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
          onBlur={e => updateConfig({ [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <BroadcastTabs />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Live TV</h1>
          <p className="text-sm text-white/50">Broadcast monitor and remote device configuration</p>
        </div>
      </div>
      {showDestForm && <DestForm form={destForm} setForm={setDestForm} onSave={saveDest} onCancel={() => { setShowDestForm(false); setEditDest(null); }} />}

      <section>
        <h2 className="text-lg font-semibold text-white/90 mb-3">Devices <span className="text-xs text-white/40 font-normal">(realtime)</span></h2>
        {devices.length === 0 ? <p className="text-white/50">No devices reporting</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {devices.map(device => {
              const lastSeen = device.lastSeen?.toDate?.();
              const stale = lastSeen && Date.now() - lastSeen.getTime() > 120_000;
              const isSel = selectedId === device.id;
              return (
                <div key={device.id} className={`bg-white/5 rounded-lg border overflow-hidden cursor-pointer transition-all ${isSel ? 'ring-2 ring-amber-500' : ''} ${stale ? 'border-yellow-500/30' : 'border-white/10'}`} onClick={() => setSelectedId(device.id)}>
                  <div className="bg-black relative" style={{ aspectRatio:'16/9' }}>
                    {device.isLive ? <StreamPreview snapshot={device.snapshot} /> : <ColorBars />}
                    <div className="absolute top-2 left-2"><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${device.isLive ? 'bg-red-500 text-white' : stale ? 'bg-yellow-500/80 text-black' : 'bg-white/10 text-white/60'}`}>{device.isLive ? 'LIVE' : stale ? 'STALE' : 'OFF'}</span></div>
                    {device.streamUrl && <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent"><code className="text-blue-400 text-[10px] break-all select-all leading-tight block truncate">{getPreviewUrl(device.streamUrl)||device.streamUrl}</code></div>}
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="font-medium text-white text-sm truncate">{device.broadcasterName||device.id}</div>
                    <div className="flex gap-2 text-[11px] text-white/50"><span>↑ {device.bitrate>0?`${(device.bitrate/1e6).toFixed(1)}M`:'-'}</span><span>⏱ {device.uptime>0?`${Math.floor(device.uptime/60)}m`:'-'}</span><span>↔ {device.rttMs>0?`${device.rttMs.toFixed(0)}ms`:'-'}</span></div>
                    {device.talkbackActive && <span className="text-[10px] text-amber-400">⚡ Talkback</span>}
                    {lastSeen && <div className="text-[10px] text-white/30">{lastSeen.toLocaleTimeString()}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedId && (
        <section>
          <h2 className="text-lg font-semibold text-white/90 mb-3">Remote Config — <span className="text-amber-400">{devices.find(d=>d.id===selectedId)?.broadcasterName||selectedId}</span></h2>
          {!config ? <p className="text-white/50">Loading...</p> : (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 space-y-4 max-w-xl">
              <div className="flex items-center gap-2 text-sm"><span className="text-white/40">ID:</span><code className="text-white/60 text-xs">{config.broadcasterId||selectedId}</code></div>
              <div className="border-t border-white/10 pt-4"/>
              <h3 className="text-sm font-semibold text-white/80">Device Settings</h3>
              <p className="text-xs text-white/40">
                Changes apply live. “Admin only” locks a section: the device still receives it but cannot change it.
              </p>
              <p className="text-xs text-white/40">
                “Admin only” locks a section: the device still receives it but cannot change it.
              </p>
              {tvSections.map((sec: any) => (
                <div key={sec.key} className="bg-white/5 border border-white/10 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/80">{sec.label}</span>
                    <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer">
                      <input type="checkbox" checked={!!config?.locks?.[sec.key]}
                        onChange={e => saveLock(sec.key, e.target.checked)} /> Admin only
                    </label>
                  </div>
                  {sec.fields.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">{sec.fields.map(renderTvField)}</div>
                  )}
                </div>
              ))}

              <div className="border-t border-white/10 pt-4"/>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white/80">Destinations</h3><button className="text-xs bg-amber-500 text-black px-3 py-1 rounded font-bold" onClick={()=>{setDestForm({protocol:'srt'});setEditDest(null);setShowDestForm(true)}}>+ Add</button></div>
              {(config.destinations||[]).length===0 ? <p className="text-sm text-white/40">No destinations</p> : (
                <div className="space-y-2">
                  {(config.destinations||[]).map((d:any,i:number) => (
                    <div key={d.id||i} className="bg-white/5 rounded p-2 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{d.name||'Unnamed'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${d.protocol==='srt'?'bg-blue-500/20 text-blue-400':d.protocol==='webrtc'?'bg-purple-500/20 text-purple-400':'bg-green-500/20 text-green-400'}`}>{d.protocol==='webrtc'?'WHIP':(d.protocol||'srt').toUpperCase()}</span>
                          {d.isDefault && <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">DEFAULT</span>}
                        </div>
                        <div className="text-xs text-white/50">{d.protocol==='srt'?`${d.host}:${d.port}`:d.protocol==='webrtc'?d.webrtcUrl:d.rtmpUrl}{d.streamId?` / ${d.streamId}`:''}</div>
                      </div>
                      <div className="flex gap-1">
                        <button className="text-xs text-blue-400 hover:text-blue-300" onClick={()=>{setDestForm(d);setEditDest(d);setShowDestForm(true)}}>Edit</button>
                        <button className="text-xs text-red-400 hover:text-red-300" onClick={()=>delDest(d.id)}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-4"/>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/80">Radio Line (SIP)</h3>
                <div className="flex items-center gap-3">
                  {radioSaving && <span className="text-xs text-amber-400">Saving...</span>}
                  <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer">
                    <input type="checkbox" checked={!!radio?.locks?.radio}
                      onChange={e => saveRadio({ locks: { ...(radio?.locks || {}), radio: e.target.checked } })} /> Admin only
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                    <input type="checkbox" checked={!!radio?.enabled} onChange={e => saveRadio({ enabled: e.target.checked })} /> Enabled
                  </label>
                </div>
              </div>
              {radio && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm text-white/60 mb-1">Name</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={radio.name||''} onChange={e=>setRadioField('name', e.target.value)} onBlur={()=>saveRadio()} /></div>
                    <div><label className="block text-sm text-white/60 mb-1">Codec</label><select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={radio.codec||'opus'} onChange={e=>{setRadioField('codec', e.target.value); saveRadio({codec: e.target.value});}}><option value="opus" className="text-black">Opus (48k)</option><option value="g722" className="text-black">G.722</option><option value="pcmu" className="text-black">G.711 µ-law</option><option value="pcma" className="text-black">G.711 A-law</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm text-white/60 mb-1">Registrar Host</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="142.54.173.186" value={radio.registrarHost||''} onChange={e=>setRadioField('registrarHost', e.target.value)} onBlur={()=>saveRadio()} /></div>
                    <div><label className="block text-sm text-white/60 mb-1">Port</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={radio.registrarPort||5060} onChange={e=>setRadioField('registrarPort', Number(e.target.value))} onBlur={()=>saveRadio()} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm text-white/60 mb-1">Username</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="field" value={radio.username||''} onChange={e=>setRadioField('username', e.target.value)} onBlur={()=>saveRadio()} /></div>
                    <div><label className="block text-sm text-white/60 mb-1">Password</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="password" value={radio.password||''} onChange={e=>setRadioField('password', e.target.value)} onBlur={()=>saveRadio()} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm text-white/60 mb-1">Extension</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="field" value={radio.extension||''} onChange={e=>setRadioField('extension', e.target.value)} onBlur={()=>saveRadio()} /></div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                        <input type="checkbox" checked={!!radio.autoAnswer} onChange={e => saveRadio({ autoAnswer: e.target.checked })} /> Auto-answer studio calls
                      </label>
                    </div>
                  </div>
                </>
              )}

              {saving && <span className="text-xs text-amber-400">Saving...</span>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
