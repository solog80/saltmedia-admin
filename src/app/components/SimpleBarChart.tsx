'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface SimpleBarChartProps {
  data: ChartData[];
  title: string;
  color: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/80 text-white p-2 rounded-md border border-white/20 text-sm">
        <p className="font-bold">{label}</p>
        <p>{`Value: ${payload[0].value.toLocaleString()}`}</p>
      </div>
    );
  }

  return null;
};

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title, color }) => {
  return (
    <div className="h-80">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 40,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={1}
            tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }} 
            interval={0}
          />
          <YAxis tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}/>
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleBarChart;
