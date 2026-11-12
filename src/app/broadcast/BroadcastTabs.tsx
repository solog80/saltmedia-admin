'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Link2, Mic, Tv } from 'lucide-react';

export default function BroadcastTabs() {
  const path = usePathname() || '';
  const radio = path.startsWith('/broadcast/radio');
  const srtLinks = path.startsWith('/broadcast/srt-links');
  const tv = !radio && !srtLinks;

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
        href="/broadcast/srt-links"
        className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
          srtLinks
            ? 'bg-blue-600 text-white shadow'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Link2 size={16} />
        SRT Links
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
