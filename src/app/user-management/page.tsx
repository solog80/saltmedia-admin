'use client';

import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface User {
  id: string;
  email: string;
  role: string;
  name?: string; // Make name optional as it might not always be present
  // Add other user properties as needed
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

const getUsersPaginated = httpsCallable<{
  lastVisibleId?: string;
  searchTerm?: string;
}, GetUsersPaginatedResponse>(functions, 'getUsersPaginated');

const updateUserRoleCallable = httpsCallable<UpdateUserRolePayload, { message: string }>(functions, 'updateUserRole');

const createUserCallable = httpsCallable<CreateUserPayload, { message: string }>(functions, 'createUser');

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer'); // Default role

  const [searchTerm, setSearchTerm] = useState('');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error } = useInfiniteQuery<GetUsersPaginatedResponse, Error>({
    queryKey: ['users', searchTerm], // Include searchTerm in queryKey
    queryFn: async ({ pageParam }) => {
      const result = await getUsersPaginated({ lastVisibleId: pageParam, searchTerm });
      return result.data;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateUserRoleMutation = useMutation<{
    message: string;
  }, Error, UpdateUserRolePayload>({
    mutationFn: async (payload) => {
      const result = await updateUserRoleCallable(payload);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', searchTerm] }); // Invalidate with searchTerm
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
      const result = await createUserCallable(payload);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', searchTerm] }); // Invalidate with searchTerm
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

  if (isLoading) return <div>Loading users...</div>;
  if (isError) return <div>Error: {error?.message}</div>;

  console.log("React Query Data:", data);

  const allUsers = data?.pages.flatMap((page) => page.users) || [];

  console.log("All Users for rendering:", allUsers);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">User Management</h1>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
        >
          Create New User
        </button>
        <input
          type="text"
          placeholder="Search by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {allUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEditClick(user)} className="text-indigo-600 hover:text-indigo-900">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {isFetchingNextPage
            ? 'Loading more...'
            : hasNextPage
            ? 'Load More'
            : 'Nothing more to load'}
        </button>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-5 rounded-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4">Edit Role for {editingUser.email}</h2>
            <div className="mb-4">
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
              <select
                id="role"
                name="role"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRole}
                disabled={updateUserRoleMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateUserRoleMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            {updateUserRoleMutation.isError && (
              <p className="text-red-500 text-sm mt-2">Error: {updateUserRoleMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-5 rounded-lg shadow-xl">
            <h2 className="text-xl font-bold mb-4">Create New User</h2>
            <div className="mb-4">
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                id="newEmail"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                id="newPassword"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="newRole" className="block text-sm font-medium text-gray-700">Role</label>
              <select
                id="newRole"
                name="newRole"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
            {createUserMutation.isError && (
              <p className="text-red-500 text-sm mt-2">Error: {createUserMutation.error?.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
