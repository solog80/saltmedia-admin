'use client';

import React from 'react';
import Link from 'next/link';
import { Tv, FileText } from 'lucide-react';
import TvTrafficLogsSection from '@/app/components/TvTrafficLogsSection';

export default function TvTrafficLogsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Sub-navigation bar across TV pages */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/tv"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Tv size={16} />
            Channels
          </Link>
          <Link
            href="/tv/logs"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow"
          >
            <FileText size={16} />
            Traffic Logs &amp; Affidavits
          </Link>
        </div>
      </div>

      <TvTrafficLogsSection />
    </div>
  );
}
