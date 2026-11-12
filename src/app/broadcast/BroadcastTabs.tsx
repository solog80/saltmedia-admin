'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Eye, Mic, Tv } from 'lucide-react';

export default function BroadcastTabs() {
  const path = usePathname() || '';
  const radio = path.startsWith('/broadcast/radio');
  const viewers = path.startsWith('/broadcast/viewers');
  const tv = !radio && !viewers;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
      <Link
        href="/broadcast"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
          tv
            ? 'bg-blue-600 text-white shadow'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Tv size={16} />
        Live TV
      </Link>
      <Link
        href="/broadcast/viewers"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
          viewers
            ? 'bg-blue-600 text-white shadow'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Eye size={16} />
        WHEP Viewers
      </Link>
      <Link
        href="/broadcast/radio"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
          radio
            ? 'bg-blue-600 text-white shadow'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Mic size={16} />
        Live Radio
      </Link>
    </div>
  );
}
