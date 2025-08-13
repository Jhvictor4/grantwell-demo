import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';
import { fmtCurrency } from '@/lib/formatters';

// Format large numbers with K/M suffixes
const formatLargeNumber = (num: number): string => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toLocaleString()}`;
};

interface GrantUtilizationData {
  grant_id: string;
  name: string;
  fullName: string;
  value: number;
}

interface GrantUtilizationBarProps {
  data: GrantUtilizationData[];
}

// Professional colors aligned with kanban design
const PROFESSIONAL_BAR_COLORS = [
  '#64748b', // Slate
  '#3b82f6', // Blue  
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#6366f1'  // Indigo
];

// Custom multi-line tick renderer to prevent overlap
const WrappedTick: React.FC<any> = ({ x, y, payload }) => {
  const value = String(payload?.value ?? '');
  // Split by spaces and limit each line to ~8-10 characters for better fitting
  const words = value.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + ' ' + word).length <= 10) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      // If single word is too long, break it
      if (word.length > 10) {
        const chunks = word.match(/.{1,8}/g) || [word];
        lines.push(...chunks.slice(0, -1));
        currentLine = chunks[chunks.length - 1];
      }
    }
  });
  if (currentLine) lines.push(currentLine);

  return (
    <text x={x} y={y} textAnchor="middle" fill="#374151" fontSize="10">
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 10 : 11}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

export function GrantUtilizationBar({ data }: GrantUtilizationBarProps) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data}
          margin={{ top: 2, right: 5, left: 15, bottom: 40 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name"
            tick={<WrappedTick />}
            interval={0}
          />
          <YAxis 
            tickFormatter={(value) => formatLargeNumber(Number(value))}
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              return (
                <div className="bg-white p-3 border rounded shadow">
                  <p className="font-medium">{data.fullName}</p>
                  <p className="text-sm">{fmtCurrency(data.value)}</p>
                </div>
              );
            }}
          />
          <Bar 
            dataKey="value" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PROFESSIONAL_BAR_COLORS[index % PROFESSIONAL_BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}