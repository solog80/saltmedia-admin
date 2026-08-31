'use client'

import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarShell({ role, children }: { role?: string | null; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Sidebar role={role} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-md border border-white/10 md:hidden"
        title="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 overflow-y-auto relative z-10">
        {children}
      </div>
    </>
  );
}
