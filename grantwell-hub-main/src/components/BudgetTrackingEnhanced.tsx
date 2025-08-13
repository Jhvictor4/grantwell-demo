import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';

interface BudgetSummary {
  id: string;
  grant_id: string;
  total_awarded: number;
  total_spent: number;
  remaining_funds: number;
  quarterly_usage: any;
  last_updated: string;
}

interface Grant {
  id: string;
  title: string;
  amount_awarded?: number;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  vendor?: string;
  grant_id: string;
  grants?: { title: string };
}

interface BudgetData {
  grant: string;
  awarded: number;
  spent: number;
  remaining: number;
  utilization: number;
}

interface QuarterlyData {
  quarter: string;
  amount: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const BudgetTrackingEnhanced: React.FC = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('current_year');

  useEffect(() => {
    loadBudgetData();
  }, []);

  const loadBudgetData = async () => {
    try {
      setLoading(true);

      // Load grants
      const { data: grantsData, error: grantsError } = await supabase
        .from('grants')
        .select('id, title, amount_awarded');
      
      if (grantsError) throw grantsError;
      setGrants(grantsData || []);

      // Load budget summaries
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget_summaries')
        .select('*');
      
      if (budgetError) throw budgetError;
      setBudgetSummaries(budgetData || []);

      // Load recent expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id, amount, description, date, vendor, grant_id,
          grants!inner(title)
        `)
        .order('date', { ascending: false })
        .limit(50);
      
      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Calculate budget summaries for grants that don't have them
      for (const grant of grantsData || []) {
        const existingSummary = (budgetData || []).find(b => b.grant_id === grant.id);
        if (!existingSummary) {
          await supabase.rpc('calculate_budget_summary', { p_grant_id: grant.id });
        }
      }

      // Reload budget summaries after calculation
      const { data: updatedBudgetData } = await supabase
        .from('budget_summaries')
        .select('*');
      setBudgetSummaries(updatedBudgetData || []);

    } catch (error) {
      console.error('Error loading budget data:', error);
      toast({
        title: "Error",
        description: "Failed to load budget data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (): BudgetData[] => {
    return budgetSummaries.map(summary => {
      const grant = grants.find(g => g.id === summary.grant_id);
      const utilization = summary.total_awarded > 0 
        ? (summary.total_spent / summary.total_awarded) * 100 
        : 0;

      return {
        grant: grant?.title || 'Unknown Grant',
        awarded: summary.total_awarded,
        spent: summary.total_spent,
        remaining: summary.remaining_funds,
        utilization
      };
    });
  };

  const prepareQuarterlyData = (): QuarterlyData[] => {
    // This would be calculated from expense data in a real implementation
    // For now, we'll create sample quarterly data
    const currentYear = new Date().getFullYear();
    return [
      { quarter: `Q1 ${currentYear}`, amount: 125000 },
      { quarter: `Q2 ${currentYear}`, amount: 180000 },
      { quarter: `Q3 ${currentYear}`, amount: 95000 },
      { quarter: `Q4 ${currentYear}`, amount: 220000 },
    ];
  };

  const preparePieData = () => {
    return budgetSummaries.map((summary, index) => {
      const grant = grants.find(g => g.id === summary.grant_id);
      return {
        name: grant?.title || 'Unknown Grant',
        value: summary.total_spent,
        color: COLORS[index % COLORS.length]
      };
    });
  };

  const getTotalAwarded = () => {
    return budgetSummaries.reduce((total, summary) => total + summary.total_awarded, 0);
  };

  const getTotalSpent = () => {
    return budgetSummaries.reduce((total, summary) => total + summary.total_spent, 0);
  };

  const getTotalRemaining = () => {
    return budgetSummaries.reduce((total, summary) => total + summary.remaining_funds, 0);
  };

  const getOverallUtilization = () => {
    const totalAwarded = getTotalAwarded();
    const totalSpent = getTotalSpent();
    return totalAwarded > 0 ? (totalSpent / totalAwarded) * 100 : 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 75) return 'text-orange-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const exportToCSV = () => {
    const csvData = budgetSummaries.map(summary => {
      const grant = grants.find(g => g.id === summary.grant_id);
      return {
        Grant: grant?.title || 'Unknown',
        'Total Awarded': summary.total_awarded,
        'Total Spent': summary.total_spent,
        'Remaining Funds': summary.remaining_funds,
        'Utilization %': summary.total_awarded > 0 ? ((summary.total_spent / summary.total_awarded) * 100).toFixed(2) : '0'
      };
    });

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `budget-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return <div className="p-6">Loading budget data...</div>;
  }

  const chartData = prepareChartData();
  const quarterlyData = prepareQuarterlyData();
  const pieData = preparePieData();
  const overallUtilization = getOverallUtilization();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Budget Tracking</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Awarded</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(getTotalAwarded())}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(getTotalSpent())}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(getTotalRemaining())}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className={`text-2xl font-bold ${getUtilizationColor(overallUtilization)}`}>
                  {overallUtilization.toFixed(1)}%
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="grants">By Grant</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quarterly Spending</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="grants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grant Budget Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="grant" 
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="awarded" fill="#22c55e" name="Awarded" />
                  <Bar dataKey="spent" fill="#3b82f6" name="Spent" />
                  <Bar dataKey="remaining" fill="#f59e0b" name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {budgetSummaries.map((summary) => {
              const grant = grants.find(g => g.id === summary.grant_id);
              const utilization = summary.total_awarded > 0 
                ? (summary.total_spent / summary.total_awarded) * 100 
                : 0;

              return (
                <Card key={summary.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold">{grant?.title || 'Unknown Grant'}</h3>
                        <p className="text-sm text-muted-foreground">
                          Last updated: {new Date(summary.last_updated).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={getUtilizationColor(utilization).replace('text-', 'bg-').replace('-600', '-100')}>
                        {utilization.toFixed(1)}% utilized
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Awarded</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(summary.total_awarded)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Spent</p>
                        <p className="font-semibold text-blue-600">
                          {formatCurrency(summary.total_spent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-semibold text-orange-600">
                          {formatCurrency(summary.remaining_funds)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Budget Utilization</span>
                        <span className={getUtilizationColor(utilization)}>
                          {utilization.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={utilization} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expenses.slice(0, 10).map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.grants?.title} • {new Date(expense.date).toLocaleDateString()}
                      </p>
                      {expense.vendor && (
                        <p className="text-xs text-muted-foreground">Vendor: {expense.vendor}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                    </div>
                  </div>
                ))}
                
                {expenses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No expenses recorded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};