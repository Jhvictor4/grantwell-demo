import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  ChevronRight,
  ChevronDown,
  BarChart3,
  PieChart,
  Download
} from 'lucide-react';

interface BudgetSummary {
  grantId: string;
  grantTitle: string;
  totalAwarded: number;
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationRate: number;
  fiscalYear: number;
  quarters: QuarterData[];
}

interface QuarterData {
  quarter: number;
  budgeted: number;
  spent: number;
  remaining: number;
  utilization: number;
}

interface EnhancedBudgetTrackerProps {
  grantId?: string;
  showAllGrants?: boolean;
}

const EnhancedBudgetTracker: React.FC<EnhancedBudgetTrackerProps> = ({ 
  grantId, 
  showAllGrants = false 
}) => {
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'all'>('all');
  const [expandedGrants, setExpandedGrants] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'summary' | 'quarterly'>('summary');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadBudgetData();
  }, [grantId, selectedFiscalYear, selectedQuarter, user]);

  const loadBudgetData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load budget line items and calculate summaries
      let query = supabase
        .from('budget_line_items')
        .select(`
          *,
          grants!inner (
            id,
            title
          )
        `)
        .eq('fiscal_year', selectedFiscalYear);

      if (grantId && !showAllGrants) {
        query = query.eq('grant_id', grantId);
      }

      if (selectedQuarter !== 'all') {
        query = query.eq('quarter', selectedQuarter);
      }

      const { data: budgetData, error } = await query;

      if (error) {
        console.error('Error loading budget data:', error);
        return;
      }

      // Process data into budget summaries
      const summariesMap = new Map<string, BudgetSummary>();

      budgetData?.forEach((item: any) => {
        const grantId = item.grant_id;
        
        if (!summariesMap.has(grantId)) {
          summariesMap.set(grantId, {
            grantId,
            grantTitle: item.grants.title,
            totalAwarded: 0, // Will be fetched separately
            totalBudgeted: 0,
            totalSpent: 0,
            totalRemaining: 0,
            utilizationRate: 0,
            fiscalYear: selectedFiscalYear,
            quarters: [
              { quarter: 1, budgeted: 0, spent: 0, remaining: 0, utilization: 0 },
              { quarter: 2, budgeted: 0, spent: 0, remaining: 0, utilization: 0 },
              { quarter: 3, budgeted: 0, spent: 0, remaining: 0, utilization: 0 },
              { quarter: 4, budgeted: 0, spent: 0, remaining: 0, utilization: 0 },
            ]
          });
        }

        const summary = summariesMap.get(grantId)!;
        summary.totalBudgeted += item.budgeted_amount || 0;
        summary.totalSpent += item.spent_amount || 0;

        // Update quarter data
        const quarterIndex = (item.quarter || 1) - 1;
        if (quarterIndex >= 0 && quarterIndex < 4) {
          summary.quarters[quarterIndex].budgeted += item.budgeted_amount || 0;
          summary.quarters[quarterIndex].spent += item.spent_amount || 0;
        }
      });

      // Calculate remaining amounts and utilization rates
      const summaries = Array.from(summariesMap.values()).map(summary => {
        summary.totalRemaining = summary.totalBudgeted - summary.totalSpent;
        summary.utilizationRate = summary.totalBudgeted > 0 
          ? (summary.totalSpent / summary.totalBudgeted) * 100 
          : 0;

        summary.quarters = summary.quarters.map(quarter => ({
          ...quarter,
          remaining: quarter.budgeted - quarter.spent,
          utilization: quarter.budgeted > 0 ? (quarter.spent / quarter.budgeted) * 100 : 0
        }));

        return summary;
      });

      setBudgetSummaries(summaries);
    } catch (error) {
      console.error('Error loading budget data:', error);
      toast({
        title: "Error",
        description: "Failed to load budget data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGrantExpansion = (grantId: string) => {
    const newExpanded = new Set(expandedGrants);
    if (newExpanded.has(grantId)) {
      newExpanded.delete(grantId);
    } else {
      newExpanded.add(grantId);
    }
    setExpandedGrants(newExpanded);
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
    if (rate < 50) return 'text-green-600';
    if (rate < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUtilizationBadgeColor = (rate: number) => {
    if (rate < 50) return 'bg-green-100 text-green-800 border-green-200';
    if (rate < 80) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const exportBudgetData = () => {
    const csvData = budgetSummaries.map(summary => ({
      Grant: summary.grantTitle,
      'Fiscal Year': summary.fiscalYear,
      'Total Budgeted': summary.totalBudgeted,
      'Total Spent': summary.totalSpent,
      'Remaining': summary.totalRemaining,
      'Utilization %': summary.utilizationRate.toFixed(1)
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-summary-${selectedFiscalYear}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Budget data has been exported to CSV.",
    });
  };

  const totalBudgeted = budgetSummaries.reduce((sum, s) => sum + s.totalBudgeted, 0);
  const totalSpent = budgetSummaries.reduce((sum, s) => sum + s.totalSpent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overallUtilization = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">Loading budget data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Budget Tracker</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'summary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('summary')}
              >
                Summary
              </Button>
              <Button
                variant={viewMode === 'quarterly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('quarterly')}
              >
                Quarterly
              </Button>
              <Button variant="outline" size="sm" onClick={exportBudgetData}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Fiscal Year:</label>
              <Select 
                value={selectedFiscalYear.toString()} 
                onValueChange={(value) => setSelectedFiscalYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {viewMode === 'quarterly' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Quarter:</label>
                <Select 
                  value={selectedQuarter.toString()} 
                  onValueChange={(value) => setSelectedQuarter(value === 'all' ? 'all' : parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Quarters</SelectItem>
                    <SelectItem value="1">Q1</SelectItem>
                    <SelectItem value="2">Q2</SelectItem>
                    <SelectItem value="3">Q3</SelectItem>
                    <SelectItem value="4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overall Summary */}
      {showAllGrants && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Budgeted</span>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Total Spent</span>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Remaining</span>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(totalRemaining)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <PieChart className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Utilization</span>
              </div>
              <div className="text-2xl font-bold">{overallUtilization.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Grant Budget Details */}
      <div className="space-y-4">
        {budgetSummaries.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Budget Data</h3>
                <p className="text-gray-600">
                  No budget information available for the selected criteria.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          budgetSummaries.map((summary) => (
            <Card key={summary.grantId} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGrantExpansion(summary.grantId)}
                      className="p-1"
                    >
                      {expandedGrants.has(summary.grantId) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <CardTitle className="text-lg">{summary.grantTitle}</CardTitle>
                  </div>
                  <Badge className={getUtilizationBadgeColor(summary.utilizationRate)}>
                    {summary.utilizationRate.toFixed(1)}% Utilized
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Budgeted</p>
                    <p className="text-lg font-semibold">{formatCurrency(summary.totalBudgeted)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Spent</p>
                    <p className="text-lg font-semibold">{formatCurrency(summary.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining</p>
                    <p className={`text-lg font-semibold ${summary.totalRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(summary.totalRemaining)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>Budget Utilization</span>
                    <span className={getUtilizationColor(summary.utilizationRate)}>
                      {summary.utilizationRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(summary.utilizationRate, 100)} 
                    className="h-2"
                  />
                </div>

                {/* Quarterly Breakdown */}
                {expandedGrants.has(summary.grantId) && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Quarterly Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      {summary.quarters.map((quarter, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Q{quarter.quarter}</span>
                            <Badge 
                              variant="outline" 
                              className={getUtilizationBadgeColor(quarter.utilization)}
                            >
                              {quarter.utilization.toFixed(0)}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span>Budgeted:</span>
                              <span>{formatCurrency(quarter.budgeted)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Spent:</span>
                              <span>{formatCurrency(quarter.spent)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Remaining:</span>
                              <span className={quarter.remaining < 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatCurrency(quarter.remaining)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EnhancedBudgetTracker;