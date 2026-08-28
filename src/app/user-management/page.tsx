'use client';

import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

interface GetUsersPaginatedResponse {
  users: User[];
  nextPageToken: string | null;
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

  const [searchTerm, setSearchTerm] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery<GetUsersPaginatedResponse, Error>({
    queryKey: ['users', searchTerm],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set('lastVisibleId', pageParam as string);
      if (searchTerm) params.set('searchTerm', searchTerm);
      const res = await fetch(`/api/users?${params.toString()}`);
      return await res.json();
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
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
      queryClient.invalidateQueries({ queryKey: ['users', searchTerm] });
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
      queryClient.invalidateQueries({ queryKey: ['users', searchTerm] });
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

  if (isLoading) return <div className="p-8 text-center text-white">Loading users...</div>;
  if (isError) return <div className="p-8 text-center text-red-300">Error: {error?.message}</div>;

  const allUsers = data?.pages.flatMap((page) => page.users) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="mt-2 text-white/70">Manage user roles and permissions</p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Create New User
        </Button>
      </div>

      <div className="frosted-glass">
        <div className="p-6 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white mb-4">Users</h2>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs bg-white/10 border-white/20 text-white placeholder-white/40"
            />
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
                {allUsers.length > 0 ? (
                  allUsers.map((user) => (
                    <TableRow key={user.id} className="border-white/20 hover:bg-white/5">
                      <TableCell className="font-medium text-white">{user.email}</TableCell>
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

          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {isFetchingNextPage ? 'Loading more...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Update the role for {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
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
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="newRole">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
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
