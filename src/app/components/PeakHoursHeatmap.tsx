'use client';

import React from 'react';

interface PeakHour {
  day: number; // 1 (Sun) to 7 (Sat)
  hour: number; // 0-23
  views: number;
}

interface HeatmapProps {
  data: PeakHour[];
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

const PeakHoursHeatmap: React.FC<HeatmapProps> = ({ data }) => {
  const maxViews = Math.max(...data.map(d => d.views), 1); // Avoid division by zero

  const gridData: { [key: string]: number } = {};
  data.forEach(item => {
    // Key format: "day-hour", e.g., "1-14" for Monday 2 PM
    gridData[`${item.day}-${item.hour}`] = item.views;
  });

  const getCellColor = (views: number) => {
    if (views === 0) return 'bg-gray-800/50';
    const intensity = Math.sqrt(views / maxViews); // Use sqrt for better visual distribution
    if (intensity < 0.2) return 'bg-blue-900';
    if (intensity < 0.4) return 'bg-blue-700';
    if (intensity < 0.6) return 'bg-blue-500';
    if (intensity < 0.8) return 'bg-yellow-500';
    return 'bg-yellow-300';
  };

  return (
    <div className="p-4 bg-gray-900/50 rounded-lg border border-white/10 overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Peak Viewing Hours (UTC)</h3>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-blue-900"></div>
          <div className="w-3 h-3 rounded-sm bg-blue-700"></div>
          <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
          <div className="w-3 h-3 rounded-sm bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-sm bg-yellow-300"></div>
          <span>More</span>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>
        {/* Y-Axis Labels (Hours) */}
        <div className="text-xs text-gray-400 pr-2 pt-8">
          {hours.map(hour => (
            <div key={hour} className="h-8 flex items-center justify-end">{hour}</div>
          ))}
        </div>

        <div>
          {/* X-Axis Labels (Days) */}
          <div className="grid grid-cols-7">
            {days.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-400 pb-2">{day}</div>
            ))}
          </div>

          {/* Heatmap Grid */}
          <div className="grid grid-cols-7">
            {days.map((_, dayIndex) => (
              <div key={dayIndex} className="flex flex-col">
                {hours.map((_, hourIndex) => {
                  const day = dayIndex + 1;
                  const hour = hourIndex;
                  const views = gridData[`${day}-${hour}`] || 0;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="relative h-8 w-full group"
                    >
                      <div
                        className={`absolute inset-0.5 rounded-sm ${getCellColor(views)}`}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/50 opacity-0 group-hover:opacity-100">
                        {views > 0 ? views : ''}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {`${days[dayIndex]}, ${hours[hourIndex]} UTC`}<br/>
                        {`Views: ${views}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeakHoursHeatmap;
