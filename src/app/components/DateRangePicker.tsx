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
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-white/10 border border-white/20 text-white/90 hover:text-white hover:bg-white/20 transition-all"
      >
        <Calendar size={14} />
        <span>{label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-[100] w-72 bg-[#1c1917]/95 backdrop-blur-xl border border-white/25 rounded-xl p-4 shadow-2xl">
          <div className="flex gap-1.5 mb-3">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => {
                  const r = p.getRange();
                  onChange(r.start, r.end);
                  setOpen(false);
                }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activePreset?.label === p.label
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-white/15 pt-3 space-y-2">
            <label className="text-xs font-medium text-white/75 block">Custom range</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-[10px] text-white/60 block mb-1">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => onChange(e.target.value, endDate)}
                  className="w-full px-2 py-1.5 rounded-md text-xs bg-white/10 border border-white/20 text-white [color-scheme:dark] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <span className="text-[10px] text-white/60 block mb-1">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => onChange(startDate, e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md text-xs bg-white/10 border border-white/20 text-white [color-scheme:dark] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
