'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Camera, Check, Code2, Copy, Eye, KeyRound, Loader2, Plus, PencilLine } from 'lucide-react';

interface EmailAccount {
  email: string;
  name?: string;
  title?: string;
  mobile?: string;
  office?: string;
  website?: string;
  updated?: number;
  avatar_url?: string | null;
  signature?: string;
}

interface AccountForm {
  local: string;
  domain: string;
  name: string;
  title: string;
  mobile: string;
  office: string;
  website: string;
  password: string;
}

const emptyForm = (): AccountForm => ({
  local: '',
  domain: 'saltmedia.ug',
  name: '',
  title: '',
  mobile: '',
  office: '',
  website: 'https://saltmedia.ug',
  password: '',
});

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function putJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}


async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const sw = size / scale;
  const sh = size / scale;
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

function AvatarThumb({ account }: { account: EmailAccount }) {
  if (account.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={account.avatar_url}
        alt=""
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
      />
    );
  }
  const local = account.email.split('@')[0].replace(/[._-]+/g, ' ');
  const parts = (account.name || local).trim().split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-700/80 text-[11px] font-semibold text-white ring-1 ring-white/20">
      {initials.toUpperCase()}
    </span>
  );
}

const EmailAccountsPage = () => {
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const [editAccount, setEditAccount] = useState<EmailAccount | null>(null);
  const [editForm, setEditForm] = useState<AccountForm>(emptyForm());

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeHtml, setCodeHtml] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const [avatarAccount, setAvatarAccount] = useState<EmailAccount | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const { data, isLoading, isError, error: queryError } = useQuery<{ accounts: EmailAccount[] }, Error>({
    queryKey: ['email-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/email-accounts');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
      return json;
    },
    staleTime: 60 * 1000,
  });

  const createMutation = useMutation<{ account: EmailAccount; password: string }, Error, AccountForm>({
    mutationFn: async (payload) =>
      postJson('/api/email-accounts', { ...payload, action: 'create' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setAddOpen(false);
      setForm(emptyForm());
      setCredentials({ email: result.account.email, password: result.password });
    },
    onError: (e) => setError(e.message),
  });

  const updateMutation = useMutation<{ account: EmailAccount }, Error, { email: string; form: AccountForm }>({
    mutationFn: async ({ email, form: f }) =>
      putJson(`/api/email-accounts/${encodeURIComponent(email)}`, {
        name: f.name,
        title: f.title,
        mobile: f.mobile,
        office: f.office,
        website: f.website,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setEditAccount(null);
    },
    onError: (e) => setError(e.message),
  });

  const passwordMutation = useMutation<{ password: string }, Error, string>({
    mutationFn: async (email) =>
      postJson(`/api/email-accounts/${encodeURIComponent(email)}`, { action: 'password' }),
    onSuccess: (result, email) => setCredentials({ email, password: result.password }),
    onError: (e) => setError(e.message),
  });


  const avatarMutation = useMutation<{ account: EmailAccount }, Error, { email: string; image: string }>({
    mutationFn: async ({ email, image }) =>
      postJson(`/api/email-accounts/${encodeURIComponent(email)}`, { action: 'avatar', image }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      setAvatarAccount(null);
      setAvatarPreview(null);
      setAvatarBusy(false);
    },
    onError: (e) => {
      setAvatarBusy(false);
      setError(e.message);
    },
  });

  const previewMutation = useMutation<{ signature: string }, Error, AccountForm & { email: string }>({
    mutationFn: async ({ email, ...f }) =>
      postJson('/api/email-accounts', {
        action: 'preview',
        email,
        name: f.name,
        title: f.title,
        mobile: f.mobile,
        office: f.office,
        website: f.website,
      }),
    onSuccess: (result) => {
      setPreviewHtml(result.signature);
      setPreviewOpen(true);
    },
    onError: (e) => setError(e.message),
  });

  const codeMutation = useMutation<{ signature: string }, Error, AccountForm & { email: string }>({
    mutationFn: async ({ email, ...f }) =>
      postJson('/api/email-accounts', {
        action: 'preview',
        email,
        name: f.name,
        title: f.title,
        mobile: f.mobile,
        office: f.office,
        website: f.website,
      }),
    onSuccess: (result, vars) => {
      setCodeHtml(result.signature);
      setCodeEmail(vars.email);
      setCodeCopied(false);
      setCodeOpen(true);
    },
    onError: (e) => setError(e.message),
  });

  const accounts = (data?.accounts ?? []).filter((a) => a.email.toLowerCase().endsWith('@saltmedia.ug'));

  const openEdit = (account: EmailAccount) => {
    const [local, domain] = account.email.split('@');
    setEditAccount(account);
    setEditForm({
      local,
      domain: domain || 'saltmedia.ug',
      name: account.name || '',
      title: account.title || '',
      mobile: account.mobile || '',
      office: account.office || '',
      website: account.website || 'https://saltmedia.ug',
      password: '',
    });
  };

  const accountToPayload = (account: EmailAccount) => ({
    ...emptyForm(),
    email: account.email,
    name: account.name || '',
    title: account.title || '',
    mobile: account.mobile || '',
    office: account.office || '',
    website: account.website || 'https://saltmedia.ug',
  });

  const previewForEdit = () => {
    if (!editAccount) return;
    previewMutation.mutate({ ...editForm, email: editAccount.email });
  };

  const previewForForm = () => {
    const email = `${form.local}@${form.domain}`;
    if (!form.local) {
      setError('Enter the part before @ first');
      return;
    }
    previewMutation.mutate({ ...form, email });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Email Accounts</h1>
          <p className="mt-2 text-white/70">
            Create mailboxes and manage the Salt Media signature used in webmail.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setForm(emptyForm());
            setAddOpen(true);
          }}
          className="bg-red-700 hover:bg-red-800 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Email Account
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="frosted-glass">
        <div className="p-6">
          <div className="rounded-md border border-white/20">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="w-14 text-white/80">Photo</TableHead>
                  <TableHead className="text-white/80">Email</TableHead>
                  <TableHead className="text-white/80">Name</TableHead>
                  <TableHead className="text-white/80">Title</TableHead>
                  <TableHead className="text-white/80">Mobile</TableHead>
                  <TableHead className="text-white/80">Updated</TableHead>
                  <TableHead className="text-right text-white/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={7} className="h-24 text-center text-white/50">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={7} className="h-24 text-center text-red-300">
                      Error: {queryError?.message}
                    </TableCell>
                  </TableRow>
                ) : accounts.length ? (
                  accounts.map((account) => (
                    <TableRow key={account.email} className="border-white/20 hover:bg-white/5">
                      <TableCell><AvatarThumb account={account} /></TableCell>
                      <TableCell className="font-medium text-white">{account.email}</TableCell>
                      <TableCell className="text-white/80">{account.name || '—'}</TableCell>
                      <TableCell className="text-white/80">{account.title || '—'}</TableCell>
                      <TableCell className="text-white/80">{account.mobile || '—'}</TableCell>
                      <TableCell className="text-white/60 text-xs">
                        {account.updated ? new Date(account.updated * 1000).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Upload photo"
                            className="text-emerald-300 hover:text-emerald-200 hover:bg-white/10"
                            onClick={() => {
                              setError(null);
                              setAvatarPreview(null);
                              setAvatarAccount(account);
                            }}
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Preview signature"
                            className="text-white/70 hover:text-white hover:bg-white/10"
                            onClick={() => previewMutation.mutate(accountToPayload(account))}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="View / copy signature HTML"
                            className="text-violet-300 hover:text-violet-200 hover:bg-white/10"
                            disabled={codeMutation.isPending}
                            onClick={() => {
                              setError(null);
                              codeMutation.mutate(accountToPayload(account));
                            }}
                          >
                            {codeMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Code2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit signature"
                            className="text-blue-300 hover:text-blue-200 hover:bg-white/10"
                            onClick={() => {
                              setError(null);
                              openEdit(account);
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reset password"
                            className="text-amber-300 hover:text-amber-200 hover:bg-white/10"
                            onClick={() => {
                              if (confirm(`Reset the password for ${account.email}?`)) {
                                passwordMutation.mutate(account.email);
                              }
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={7} className="h-24 text-center text-white/50">
                      No email accounts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-4 text-xs text-white/40">
            Mailboxes are provisioned on the mail server. New accounts get the Salt Media HTML signature automatically.
          </p>
        </div>
      </div>

      {/* Add account */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Add Email Account</DialogTitle>
            <DialogDescription>
              The mailbox is created immediately. Leave the password empty to generate one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="local">Email</Label>
                <Input
                  id="local"
                  placeholder="jane"
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain">Domain</Label>
                <Select value={form.domain} onValueChange={(v) => setForm({ ...form, domain: v ?? 'saltmedia.ug' })}>
                  <SelectTrigger id="domain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saltmedia.ug">saltmedia.ug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" placeholder="+256..." value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="office">Office / telephone</Label>
                <Input id="office" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password (optional)</Label>
                <Input id="password" type="text" placeholder="Leave blank to generate" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            {form.local && (
              <p className="text-xs text-white/50">
                Will create <span className="text-white/80">{form.local}@{form.domain}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="outline" onClick={previewForForm} disabled={previewMutation.isPending} className="border-white/20 text-white hover:bg-white/10">
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.local}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {createMutation.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit signature */}
      <Dialog open={!!editAccount} onOpenChange={(open) => !open && setEditAccount(null)}>
        <DialogContent className="max-w-2xl bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Edit signature</DialogTitle>
            <DialogDescription>{editAccount?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full name</Label>
                <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Job title</Label>
                <Input id="edit-title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-mobile">Mobile</Label>
                <Input id="edit-mobile" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-office">Office / telephone</Label>
                <Input id="edit-office" value={editForm.office} onChange={(e) => setEditForm({ ...editForm, office: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="edit-website">Website</Label>
                <Input id="edit-website" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button variant="outline" onClick={previewForEdit} disabled={previewMutation.isPending} className="border-white/20 text-white hover:bg-white/10">
              {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview
            </Button>
            <Button
              onClick={() => editAccount && updateMutation.mutate({ email: editAccount.email, form: editForm })}
              disabled={updateMutation.isPending}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save signature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Signature preview</DialogTitle>
            <DialogDescription>This is what recipients will see (images may need “Display images”).</DialogDescription>
          </DialogHeader>
          <div
            className="overflow-auto rounded-md bg-white p-4"
            dangerouslySetInnerHTML={{ __html: previewHtml || '' }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => {
                setCodeHtml(previewHtml || '');
                setCodeEmail('');
                setCodeCopied(false);
                setPreviewOpen(false);
                setCodeOpen(true);
              }}
            >
              View / copy HTML
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="border-white/20 text-white hover:bg-white/10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature HTML */}
      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-w-4xl bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Signature HTML</DialogTitle>
            <DialogDescription>
              {codeEmail ? `${codeEmail} — ` : ''}
              Paste into your mail client’s HTML signature editor. Images are loaded remotely.
            </DialogDescription>
          </DialogHeader>
          <textarea
            readOnly
            value={codeHtml}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className="h-64 w-full resize-none rounded-md border border-white/20 bg-black/50 p-3 font-mono text-xs text-white/80 outline-none focus:border-white/40"
          />
          <p className="text-xs text-white/50">
            Thunderbird: Account Settings → Signature text → enable “Use HTML” → paste. Apple Mail: Settings → Signatures → uncheck “Always match my default message font”.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              disabled={!codeHtml}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codeHtml);
                  setCodeCopied(true);
                  setTimeout(() => setCodeCopied(false), 2000);
                } catch {
                  setError('Could not copy automatically — select the code above and copy it.');
                }
              }}
            >
              {codeCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {codeCopied ? 'Copied' : 'Copy HTML'}
            </Button>
            <Button variant="outline" onClick={() => setCodeOpen(false)} className="border-white/20 text-white hover:bg-white/10">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Avatar upload */}
      <Dialog open={!!avatarAccount} onOpenChange={(open) => { if (!open) { setAvatarAccount(null); setAvatarPreview(null); setAvatarBusy(false); } }}>
        <DialogContent className="bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Profile photo</DialogTitle>
            <DialogDescription>{avatarAccount?.email}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="h-28 w-28 rounded-full object-cover ring-2 ring-white/20" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-white/20 text-xs text-white/40">
                Square photo
              </div>
            )}
            <label className="cursor-pointer rounded-md border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10">
              Choose image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setError(null);
                    setAvatarPreview(await fileToAvatarDataUrl(file));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not read image');
                  }
                }}
              />
            </label>
            <p className="max-w-sm text-center text-xs text-white/50">
              Square-cropped to 256×256. Shown in the dashboard and Roundcube webmail.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAvatarAccount(null); setAvatarPreview(null); }} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!avatarAccount || !avatarPreview) return;
                setAvatarBusy(true);
                avatarMutation.mutate({ email: avatarAccount.email, image: avatarPreview });
              }}
              disabled={!avatarPreview || avatarBusy}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {avatarBusy ? 'Saving…' : 'Save photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated credentials */}
      <Dialog open={!!credentials} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Password ready</DialogTitle>
            <DialogDescription>
              Save this now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label className="text-white/80">Email</Label>
              <div className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white">
                {credentials?.email}
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-white/80">Password</Label>
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border border-white/20 bg-black/40 px-3 py-2 font-mono text-sm text-white">
                  {credentials?.password}
                </div>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => credentials && navigator.clipboard.writeText(credentials.password)}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)} className="bg-red-700 hover:bg-red-800 text-white">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailAccountsPage;
