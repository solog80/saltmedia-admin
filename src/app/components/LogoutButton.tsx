'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { HugeiconsIcon } from '@hugeicons/react';
import Logout01Icon from '@hugeicons/core-free-icons/dist/esm/Logout01Icon';

export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // cookie still cleared client-side via full navigation below
    }
    try {
      await signOut(auth);
    } catch {
      // ignore — the session cookie is the source of truth
    }
    window.location.href = '/login';
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition-all text-red-300 hover:bg-red-500/20 hover:text-red-200 rounded-md"
    >
      <HugeiconsIcon icon={Logout01Icon} size={20} />
      Logout
    </button>
  );
}