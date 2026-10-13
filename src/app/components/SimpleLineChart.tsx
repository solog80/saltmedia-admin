'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  Legend,
} from 'recharts';

interface LineConfig {
  dataKey: string;
  color: string;
  gradientId: string;
  label: string;
}

interface SimpleLineChartProps {
  data: any[];
  title: string;
  lines: LineConfig[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload;
    const show = dataPoint?.show;
    const s1 = dataPoint?.stream1Viewers;
    const s2 = dataPoint?.stream2Viewers;
    const s1Show = dataPoint?.stream1Show;
    const s2Show = dataPoint?.stream2Show;

    // Filter out internal/duplicate area keys (e.g. dataKey without custom label or duplicates)
    const seen = new Set<string>();
    const uniqueLines = payload.filter((p: any) => {
      const name = p.name;
      if (!name || seen.has(name) || name === 'viewers' || name === 'peak') return false;
      seen.add(name);
      return true;
    });

    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-lg border border-white/20 shadow-xl text-xs space-y-2 min-w-[210px]">
        <p className="font-bold text-sm text-white/90 border-b border-white/10 pb-1">{label}</p>

        {s1 !== undefined && s2 !== undefined ? (
          <div className="space-y-1.5 py-0.5">
            <div className="flex items-start justify-between text-blue-300 gap-2">
              <span className="font-medium truncate max-w-[150px]">
                Salt TV One: <span className="text-white/80 font-normal">{s1Show || 'On-Air'}</span>
              </span>
              <span className="font-semibold shrink-0">{s1} viewers</span>
            </div>
            <div className="flex items-start justify-between text-cyan-300 gap-2">
              <span className="font-medium truncate max-w-[150px]">
                Salt TV Two: <span className="text-white/80 font-normal">{s2Show || 'On-Air'}</span>
              </span>
              <span className="font-semibold shrink-0">{s2} viewers</span>
            </div>
          </div>
        ) : show && show !== 'Live Broadcast' ? (
          <p className="text-blue-300 text-xs">{show}</p>
        ) : null}

        <div className="pt-1.5 border-t border-white/10 space-y-0.5">
          {uniqueLines.length > 0 ? (
            uniqueLines.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between" style={{ color: p.color }}>
                <span>{p.name}:</span>
                <span className="font-semibold">{Number(p.value).toLocaleString()}</span>
              </div>
            ))
          ) : (
            payload.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between" style={{ color: p.color }}>
                <span>{p.name}:</span>
                <span className="font-semibold">{Number(p.value).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
};

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, title, lines = [] }) => {
  return (
    <div className="h-80">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <defs>
            {lines.map(l => (
              <linearGradient key={l.gradientId} id={l.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={l.color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={l.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }} 
            angle={-30}
            textAnchor="end"
            height={60}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}
            tickFormatter={(v: any) => Number(v).toLocaleString()}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '8px', fontSize: '12px' }}
            iconType="circle"
          />
          <Tooltip content={<CustomTooltip />} />
          {lines.map(l => (
            <React.Fragment key={l.dataKey}>
              <Area
                type="monotone"
                dataKey={l.dataKey}
                stroke={l.color}
                fillOpacity={1}
                fill={`url(#${l.gradientId})`}
                tooltipType="none"
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey={l.dataKey}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                name={l.label}
              />
            </React.Fragment>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleLineChart;
