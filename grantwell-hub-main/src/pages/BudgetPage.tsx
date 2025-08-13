import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BudgetManager from '@/components/BudgetManager';

import SimpleBudgetManager from '@/components/SimpleBudgetManager';

import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  PieChart,
  BarChart3,
  Target
} from 'lucide-react';

const BudgetPage = () => {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('2024');
  const [selectedQuarter, setSelectedQuarter] = useState('all');

  // Mock budget data
  const budgetSummary = {
    totalAwarded: 850000,
    totalSpent: 420000,
    totalRemaining: 430000,
    utilizationRate: 49.4
  };

  const grantBudgets = [
    {
      id: '1',
      grantName: 'Edward Byrne Memorial JAG',
      awarded: 350000,
      spent: 175000,
      remaining: 175000,
      utilization: 50,
      status: 'on-track',
      nextReportDue: '2024-03-31'
    },
    {
      id: '2',
      grantName: 'COPS Office Community Policing',
      awarded: 300000,
      spent: 180000,
      remaining: 120000,
      utilization: 60,
      status: 'ahead',
      nextReportDue: '2024-04-15'
    },
    {
      id: '3',
      grantName: 'Research and Development',
      awarded: 200000,
      spent: 65000,
      remaining: 135000,
      utilization: 32.5,
      status: 'behind',
      nextReportDue: '2024-03-15'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'bg-green-100 text-green-800';
      case 'ahead': return 'bg-blue-100 text-blue-800';
      case 'behind': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getUtilizationStatus = (rate: number) => {
    if (rate < 25) return { color: 'text-orange-600', icon: TrendingDown, status: 'Low utilization' };
    if (rate > 75) return { color: 'text-red-600', icon: AlertTriangle, status: 'High utilization' };
    return { color: 'text-green-600', icon: TrendingUp, status: 'On track' };
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-green-600 rounded-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Budget & Finance</h1>
            </div>
            <p className="text-slate-600 text-sm md:text-base">
              Track Spending, Monitor Utilization, And Manage Fiscal Compliance
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">FY 2024</SelectItem>
                <SelectItem value="2023">FY 2023</SelectItem>
                <SelectItem value="2022">FY 2022</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <SimpleBudgetManager />
      </div>
    </div>
  );
};

export default BudgetPage;