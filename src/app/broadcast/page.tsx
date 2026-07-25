'use client';

import { useEffect, useState } from 'react';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const PREVIEW_PORT_OFFSET = 1000;

function getPreviewUrl(streamUrl: string): string | null {
  if (!streamUrl.startsWith('srt://')) return null;
  try { const u = new URL(streamUrl.replace('srt://', 'http://')); const p = u.port ? Number(u.port) + PREVIEW_PORT_OFFSET : 0; return p ? `srt://${u.hostname}:${p}${u.search}` : null; } catch { return null; }
}

function ColorBars() { const c=['#ffffff','#ffff00','#00ffff','#00ff00','#ff00ff','#ff0000','#0000ff']; return <svg viewBox="0 0 640 480" className="w-full h-full">{c.map((x,i)=><rect key={i} x={i*91.4} y={0} width={91.4} height={280} fill={x}/>)}<rect x={0} y={280} width={213.3} height={60} fill="#406080"/><rect x={213.3} y={280} width={213.3} height={60} fill="#fff"/><rect x={426.6} y={280} width={213.3} height={60} fill="#c06080"/>{[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*91.4} y={340} width={91.4} height={140} fill={['#000','#102030','#000','#203040','#000','#101010','#000'][i]}/>)}</svg>; }

function StreamPreview({ snapshot }: { snapshot?: string }) { const url = snapshot ? `data:image/jpeg;base64,${snapshot}` : null; return url ? <img src={url} className="w-full h-full object-contain" alt="" /> : null; }

type BroadcastStatus = { id: string; broadcasterName?: string; isLive: boolean; uptime: number; bitrate: number; rttMs: number; packetsDropped: number; returnFeedUrl: string; streamUrl?: string; snapshot?: string; talkbackActive: boolean; lastSeen?: { toDate: () => Date }; };
type BroadcastConfig = Record<string, any>;

function DestForm({ form, setForm, onSave, onCancel }: any) {
  const s = form.protocol === 'srt';
  return <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
    <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
      <h3 className="text-white font-semibold">{form.id ? 'Edit' : 'Add'} Destination</h3>
      <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Name" value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} />
      <select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={form.protocol||'srt'} onChange={e => setForm({...form, protocol: e.target.value})}>
        <option value="srt" className="text-black">SRT</option><option value="rtmp" className="text-black">RTMP</option>
      </select>
      {s ? (
        <div className="grid grid-cols-2 gap-2">
          <input className="col-span-2 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Host" value={form.host||''} onChange={e => setForm({...form, host: e.target.value})} />
          <input className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" placeholder="Port" value={form.port||''} onChange={e => setForm({...form, port: Number(e.target.value)})} />
          <input className="bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Stream ID" value={form.streamId||''} onChange={e => setForm({...form, streamId: e.target.value})} />
          <input className="col-span-2 bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Passphrase" value={form.passphrase||''} onChange={e => setForm({...form, passphrase: e.target.value})} />
        </div>
      ) : (
        <div className="space-y-2">
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="RTMP URL" value={form.rtmpUrl||''} onChange={e => setForm({...form, rtmpUrl: e.target.value})} />
          <input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="Stream Key" value={form.streamKey||''} onChange={e => setForm({...form, streamKey: e.target.value})} />
        </div>
      )}
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

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'broadcasts'), orderBy('lastSeen','desc')), snap => { const list: BroadcastStatus[] = []; snap.forEach(d => list.push({ id: d.id, ...d.data() } as BroadcastStatus)); setDevices(list); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedId) { setConfig(null); return; }
    const unsub = onSnapshot(doc(db, 'broadcastConfig', `user_${selectedId}`), snap => { if (snap.exists()) setConfig(snap.data() as BroadcastConfig); else setConfig({} as BroadcastConfig); });
    return () => unsub();
  }, [selectedId]);

  const updateConfig = async (updates: Partial<BroadcastConfig>) => {
    if (!selectedId) return; setSaving(true);
    try {
      const clean: Record<string,any> = {}; for (const [k,v] of Object.entries(updates)) if (v !== undefined) clean[k] = v;
      console.log('[Dashboard] saving config', clean);
      await setDoc(doc(db, 'broadcastConfig', `user_${selectedId}`), clean, { merge: true });
    } finally { setSaving(false); }
  };

  const saveDest = () => {
    const dests = [...(config?.destinations || [])];
    if (editDest) { const i = dests.findIndex((d:any) => d.id === editDest.id); if (i>=0) dests[i] = { ...destForm, id: editDest.id }; }
    else dests.push({ ...destForm, id: `dest_${Date.now()}` });
    updateConfig({ destinations: dests }); setShowDestForm(false); setEditDest(null);
  };

  const delDest = (id: string) => updateConfig({ destinations: (config?.destinations||[]).filter((d:any) => d.id !== id) });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Broadcast Monitor</h1>
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
              <div><label className="block text-sm text-white/60 mb-1">Display Name</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.broadcasterName||''} onChange={e=>setConfig({...config,broadcasterName:e.target.value})} onBlur={()=>updateConfig({broadcasterName:config.broadcasterName})} /></div>

              <div className="border-t border-white/10 pt-4"/><h3 className="text-sm font-semibold text-white/80">Encoder</h3>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="block text-sm text-white/60 mb-1">Bitrate (Mbps)</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" step="0.1" value={(config.encoderBitrate||3000000)/1e6} onChange={e=>setConfig({...config,encoderBitrate:Math.round(Number(e.target.value)*1e6)})} onBlur={()=>updateConfig({encoderBitrate:config.encoderBitrate})} /></div>
                <div><label className="block text-sm text-white/60 mb-1">Audio Bitrate</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={config.audioBitrateBps||128000} onChange={e=>setConfig({...config,audioBitrateBps:Number(e.target.value)})} onBlur={()=>updateConfig({audioBitrateBps:config.audioBitrateBps})} /></div>
                <div><label className="block text-sm text-white/60 mb-1">FPS</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={config.encoderFps||30} onChange={e=>setConfig({...config,encoderFps:Number(e.target.value)})} onBlur={()=>updateConfig({encoderFps:config.encoderFps})} /></div>
                <div><label className="block text-sm text-white/60 mb-1">Codec</label><select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.encoderCodec||'avc'} onChange={e=>setConfig({...config,encoderCodec:e.target.value})} onBlur={()=>updateConfig({encoderCodec:config.encoderCodec})}><option value="avc" className="text-black">H.264</option><option value="hevc" className="text-black">H.265</option></select></div>
              </div>
              <div><label className="block text-sm text-white/60 mb-1">Resolution</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.encoderResolution||'720x1280'} onChange={e=>setConfig({...config,encoderResolution:e.target.value})} onBlur={()=>updateConfig({encoderResolution:config.encoderResolution})} /></div>

              <div className="border-t border-white/10 pt-4"/><h3 className="text-sm font-semibold text-white/80">Return Feed</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2"><label className="block text-sm text-white/60 mb-1">Host</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" placeholder="salttelevision.com" value={config.returnHost||'salttelevision.com'} onChange={e=>setConfig({...config,returnHost:e.target.value})} onBlur={()=>{const h=config.returnHost||'salttelevision.com';const p=config.returnPort||8011;const pp=config.returnPassphrase||'ffeMUNNYO11';updateConfig({returnHost:h,returnPort:p,returnPassphrase:pp,url:`srt://${h}:${pp?`?passphrase=${pp}`:''}`})}} /></div>
                <div><label className="block text-sm text-white/60 mb-1">Port</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" placeholder="8011" value={config.returnPort||8011} onChange={e=>setConfig({...config,returnPort:Number(e.target.value)})} onBlur={()=>{const h=config.returnHost||'salttelevision.com';const p=config.returnPort||8011;const pp=config.returnPassphrase||'ffeMUNNYO11';updateConfig({returnHost:h,returnPort:p,returnPassphrase:pp,url:`srt://${h}:${p}${pp?`?passphrase=${pp}`:''}`})}} /></div>
                <div><label className="block text-sm text-white/60 mb-1">Latency</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={config.latencyMs||1000} onChange={e=>setConfig({...config,latencyMs:Number(e.target.value)})} onBlur={()=>updateConfig({latencyMs:config.latencyMs})} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm text-white/60 mb-1">Passphrase</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.returnPassphrase||'ffeMUNNYO11'} onChange={e=>setConfig({...config,returnPassphrase:e.target.value})} onBlur={()=>{const h=config.returnHost||'salttelevision.com';const p=config.returnPort||8011;const pp=config.returnPassphrase||'ffeMUNNYO11';updateConfig({returnHost:h,returnPort:p,returnPassphrase:pp,url:`srt://${h}:${p}${pp?`?passphrase=${pp}`:''}`})}} /></div>
                <div><label className="block text-sm text-white/60 mb-1">Mode</label><select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.returnMode||'caller'} onChange={e=>setConfig({...config,returnMode:e.target.value})} onBlur={()=>updateConfig({returnMode:config.returnMode})}><option value="caller" className="text-black">Caller</option><option value="listener" className="text-black">Listener</option></select></div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-1 text-sm text-white/70"><input type="checkbox" checked={config.startMuted!==false} onChange={e=>updateConfig({startMuted:e.target.checked})} /> Muted</label>
                  <label className="flex items-center gap-1 text-sm text-white/70"><input type="checkbox" checked={config.autoplayOnLive!==false} onChange={e=>updateConfig({autoplayOnLive:e.target.checked})} /> Auto</label>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4"/><h3 className="text-sm font-semibold text-white/80">Talkback</h3>
              <div className="flex items-center justify-between"><span className="text-sm text-white/70">Enabled</span><button className={`px-3 py-1 rounded text-xs font-bold ${config.talkbackEnabled?'bg-amber-500 text-white':'bg-white/10 text-white/60'}`} onClick={()=>updateConfig({talkbackEnabled:!config.talkbackEnabled})}>{config.talkbackEnabled?'ON':'OFF'}</button></div>
              {config.talkbackEnabled && <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm text-white/60 mb-1">Host</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.talkbackHost||''} onChange={e=>setConfig({...config,talkbackHost:e.target.value})} onBlur={()=>{const h=config.talkbackHost||'';const p=config.talkbackPort||'';const pp=config.talkbackPassphrase||'';updateConfig({talkbackHost:h,talkbackPort:p,talkbackPassphrase:pp,talkbackUrl:h?`srt://${h}${p?`:${p}`:''}${pp?`?passphrase=${pp}`:''}`:''})}} /></div>
                  <div><label className="block text-sm text-white/60 mb-1">Port</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={config.talkbackPort||''} onChange={e=>setConfig({...config,talkbackPort:Number(e.target.value)})} onBlur={()=>{const h=config.talkbackHost||'';const p=config.talkbackPort||'';const pp=config.talkbackPassphrase||'';updateConfig({talkbackHost:h,talkbackPort:p,talkbackPassphrase:pp,talkbackUrl:h?`srt://${h}${p?`:${p}`:''}${pp?`?passphrase=${pp}`:''}`:''})}} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-sm text-white/60 mb-1">Passphrase</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.talkbackPassphrase||''} onChange={e=>setConfig({...config,talkbackPassphrase:e.target.value})} onBlur={()=>{const h=config.talkbackHost||'';const p=config.talkbackPort||'';const pp=config.talkbackPassphrase||'';updateConfig({talkbackHost:h,talkbackPort:p,talkbackPassphrase:pp,talkbackUrl:h?`srt://${h}${p?`:${p}`:''}${pp?`?passphrase=${pp}`:''}`:''})}} /></div>
                  <div><label className="block text-sm text-white/60 mb-1">Mode</label><select className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" value={config.talkbackMode||'caller'} onChange={e=>setConfig({...config,talkbackMode:e.target.value})} onBlur={()=>updateConfig({talkbackMode:config.talkbackMode})}><option value="caller" className="text-black">Caller</option><option value="listener" className="text-black">Listener</option></select></div>
                </div>
                <div><label className="block text-sm text-white/60 mb-1">Latency (ms)</label><input className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm" type="number" value={config.talkbackLatencyMs||500} onChange={e=>setConfig({...config,talkbackLatencyMs:Number(e.target.value)})} onBlur={()=>updateConfig({talkbackLatencyMs:config.talkbackLatencyMs})} /></div>
              </div>}

              <div className="border-t border-white/10 pt-4"/>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white/80">Destinations</h3><button className="text-xs bg-amber-500 text-black px-3 py-1 rounded font-bold" onClick={()=>{setDestForm({protocol:'srt'});setEditDest(null);setShowDestForm(true)}}>+ Add</button></div>
              {(config.destinations||[]).length===0 ? <p className="text-sm text-white/40">No destinations</p> : (
                <div className="space-y-2">
                  {(config.destinations||[]).map((d:any,i:number) => (
                    <div key={d.id||i} className="bg-white/5 rounded p-2 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2"><span className="text-sm text-white font-medium">{d.name||'Unnamed'}</span><span className={`text-xs px-1.5 py-0.5 rounded ${d.protocol==='srt'?'bg-blue-500/20 text-blue-400':'bg-green-500/20 text-green-400'}`}>{d.protocol||'srt'}</span></div>
                        <div className="text-xs text-white/50">{d.protocol==='srt'?`${d.host}:${d.port}`:d.rtmpUrl}{d.streamId?` / ${d.streamId}`:''}</div>
                      </div>
                      <div className="flex gap-1">
                        <button className="text-xs text-blue-400 hover:text-blue-300" onClick={()=>{setDestForm(d);setEditDest(d);setShowDestForm(true)}}>Edit</button>
                        <button className="text-xs text-red-400 hover:text-red-300" onClick={()=>delDest(d.id)}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {saving && <span className="text-xs text-amber-400">Saving...</span>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
