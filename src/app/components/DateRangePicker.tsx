'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

const PRESETS = [
  { label: 'Today', days: 0, getRange: () => ({ start: today(), end: today() }) },
  { label: '7d', days: 7, getRange: () => getDateRange(7) },
  { label: '30d', days: 30, getRange: () => getDateRange(30) },
  { label: '90d', days: 90, getRange: () => getDateRange(90) },
];

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activePreset = PRESETS.find(p => {
    const r = p.getRange();
    return r.start === startDate && r.end === endDate;
  });

  const label = activePreset ? activePreset.label : `${startDate} – ${endDate}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
      >
        <Calendar size={14} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 frosted-glass border border-white/20 rounded-xl p-4 shadow-2xl">
          <div className="flex gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => {
                  const r = p.getRange();
                  onChange(r.start, r.end);
                  setOpen(false);
                }}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activePreset?.label === p.label
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <label className="text-xs text-white/50 block">Custom range</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-white/40 block mb-1">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => onChange(e.target.value, endDate)}
                  className="w-full px-2 py-1.5 rounded-md text-xs bg-white/5 border border-white/10 text-white [color-scheme:dark] focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-white/40 block mb-1">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => onChange(startDate, e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md text-xs bg-white/5 border border-white/10 text-white [color-scheme:dark] focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
