'use client';

import React from 'react';
import { Zap } from 'lucide-react';

export default function EventsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Zap size={32} className="text-yellow-300" />
          Events
        </h1>
        <p className="mt-2 text-white/70">
          Manage and track platform events
        </p>
      </div>

      <div className="frosted-glass p-12 flex flex-col items-center justify-center">
        <Zap size={64} className="text-white/20 mb-4" />
        <p className="text-xl text-white/50">
          Events will be displayed here
        </p>
      </div>
    </div>
  );
}