'use client';

import React from 'react';
import Link from 'next/link';
import { Radio, BarChart3, FileText } from 'lucide-react';
import TrafficLogsSection from '@/app/components/TrafficLogsSection';

export default function RadioTrafficLogsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Sub-navigation bar across Radio pages */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/radio"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Radio size={16} />
            Stations &amp; Logs
          </Link>
          <Link
            href="/radio/reports"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <BarChart3 size={16} />
            Reports
          </Link>
          <Link
            href="/radio/logs"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow"
          >
            <FileText size={16} />
            Traffic Logs &amp; Affidavits
          </Link>
        </div>
      </div>

      <TrafficLogsSection />
    </div>
  );
}
