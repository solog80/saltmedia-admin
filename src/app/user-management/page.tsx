'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface User {
  id: string;
  email?: string | null;
  role: string;
  name?: string;
}

interface GetUsersPaginatedResponse {
  users: User[];
  nextPageToken: string | null;
  total: number;
  page: number;
  limit: number;
}

interface UpdateUserRolePayload {
  userId: string;
  newRole: string;
}

interface CreateUserPayload {
  email: string;
  password: string;
  role: string;
}

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'email' | 'anonymous'>('email');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search so we don't fire a query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 whenever the tab or debounced search changes.
  useEffect(() => {
    setPage(1);
  }, [tab, searchTerm]);

  const effectiveSearch = searchTerm.trim().length >= 2 ? searchTerm : '';

  const { data, isLoading, isError, error, isFetching } = useQuery<GetUsersPaginatedResponse, Error>({
    queryKey: ['users', tab, effectiveSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('hasEmail', tab === 'email' ? 'true' : 'false');
      if (effectiveSearch) params.set('searchTerm', effectiveSearch);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      const res = await fetch(`/api/users?${params.toString()}`);
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateUserRoleMutation = useMutation<{
    message: string;
  }, Error, UpdateUserRolePayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateUserRole', ...payload }),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tab, effectiveSearch] });
      setIsEditModalOpen(false);
      setEditingUser(null);
      setSelectedRole('');
    },
    onError: (err) => {
      console.error("Error updating user role:", err);
      alert(`Failed to update role: ${err.message}`);
    },
  });

  const createUserMutation = useMutation<{
    message: string;
  }, Error, CreateUserPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createUser', ...payload }),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', tab, effectiveSearch] });
      setIsCreateModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewRole('viewer');
    },
    onError: (err) => {
      console.error("Error creating user:", err);
      alert(`Failed to create user: ${err.message}`);
    },
  });

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setIsEditModalOpen(true);
  };

  const handleSaveRole = () => {
    if (editingUser && selectedRole) {
      updateUserRoleMutation.mutate({ userId: editingUser.id, newRole: selectedRole });
    }
  };

  const handleCreateUser = () => {
    createUserMutation.mutate({ email: newEmail, password: newPassword, role: newRole });
  };

  const allUsers = data?.users || [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="mt-2 text-white/70">Manage user roles and permissions</p>
        </div>
        {tab === 'email' && (
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create New User
          </Button>
        )}
      </div>

      <div className="frosted-glass">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'email' | 'anonymous')}
            >
              <TabsList className="bg-white/10 border border-white/20">
                <TabsTrigger
                  value="email"
                  className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Users with Emails
                </TabsTrigger>
                <TabsTrigger
                  value="anonymous"
                  className="text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                >
                  Anonymous
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-white/60" />}
              <Input
                placeholder={tab === 'email' ? 'Search by name or email...' : 'Search by name...'}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-72 bg-white/10 border-white/20 text-white placeholder-white/40"
              />
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="rounded-md border border-white/20">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="text-white/80">Email</TableHead>
                  <TableHead className="text-white/80">Name</TableHead>
                  <TableHead className="text-white/80">Role</TableHead>
                  <TableHead className="text-right text-white/80">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={4} className="h-24 text-center text-white/50">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={4} className="h-24 text-center text-red-300">
                      Error: {error?.message}
                    </TableCell>
                  </TableRow>
                ) : allUsers.length > 0 ? (
                  allUsers.map((user) => (
                    <TableRow key={user.id} className="border-white/20 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{user.email || 'Anonymous'}</TableCell>
                      <TableCell className="text-white/80">{user.name || 'N/A'}</TableCell>
                      <TableCell className="capitalize text-white/80">{user.role || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          className="text-blue-300 hover:text-blue-200 hover:bg-white/10"
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-white/20">
                    <TableCell colSpan={4} className="h-24 text-center text-white/50">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-white/40">
              Page {page} of {totalPages} ({totalCount.toLocaleString()} users)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-white border-white/20 hover:bg-white/10 h-8 px-3"
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="text-white border-white/20 hover:bg-white/10 h-8 px-3"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Update the role for {editingUser?.email || 'anonymous user'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v ?? '')}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={updateUserRoleMutation.isPending}>
              {updateUserRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newEmail">Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newRole">Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v ?? '')}>
                <SelectTrigger id="newRole">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
