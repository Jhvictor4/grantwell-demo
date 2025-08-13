import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';
import { fmtCurrency } from '@/lib/formatters';

interface CategorySpendingData {
  category: string;
  spent: number;
}

interface CategorySpendingPieProps {
  data: CategorySpendingData[];
}

const PROFESSIONAL_COLORS = [
  '#64748b', // Slate
  '#3b82f6', // Blue  
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#6366f1'  // Indigo
];

export function CategorySpendingPie({ data }: CategorySpendingPieProps) {
  const totalSpent = data.reduce((sum, item) => sum + item.spent, 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, category, spent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 15;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percent = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;

    return (
      <text 
        x={x} 
        y={y} 
        fill="#374151" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="11"
      >
        {`${category}: ${fmtCurrency(spent)} (${percent.toFixed(1)}%)`}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="spent"
            nameKey="category"
            cx="50%"
            cy="55%"
            outerRadius="80%"
            label={renderCustomLabel}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              const percent = totalSpent > 0 ? (data.spent / totalSpent) * 100 : 0;
              return (
                <div className="bg-white p-3 border rounded shadow">
                  <p className="font-medium">
                    {data.category} — {fmtCurrency(data.spent)} ({percent.toFixed(1)}%)
                  </p>
                </div>
              );
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            layout="horizontal"
            wrapperStyle={{ paddingTop: '50px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}