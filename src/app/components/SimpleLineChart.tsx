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
    return (
      <div className="bg-black/80 text-white p-2 rounded-md border border-white/20 text-sm">
        <p className="font-bold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value.toLocaleString()}`}</p>
        ))}
      </div>
    );
  }

  return null;
};

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, title, lines = [] }) => {
  return (
    <div className="h-80">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
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
          <YAxis tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          {lines.map(l => (
            <React.Fragment key={l.dataKey}>
              <Area type="monotone" dataKey={l.dataKey} stroke={l.color} fillOpacity={1} fill={`url(#${l.gradientId})`} />
              <Line type="monotone" dataKey={l.dataKey} stroke={l.color} strokeWidth={2} dot={false} name={l.label} />
            </React.Fragment>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleLineChart;
