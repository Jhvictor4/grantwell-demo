import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { DollarSign, BarChart3, Plus, Download, FileText, Filter, Bot, TrendingUp } from 'lucide-react';
import SimpleBudgetManager from '@/components/SimpleBudgetManager';
import ContextCopilotButton from '@/components/ContextCopilotButton';
import AccessControlGuard from '@/components/AccessControlGuard';
import { EnhancedDrawdownTracker } from '@/components/EnhancedDrawdownTracker';
import { AdvancedFinancialDashboard } from '@/components/AdvancedFinancialDashboard';
import { ExpenseEntryForm } from '@/components/ExpenseEntryForm';
import { MatchCostSharePanel } from '@/components/MatchCostSharePanel';
import { formatCurrency, parseNumberWithCommas, getStatusBadgeColor, getUtilizationTextColor } from '@/lib/financial-utils';
import { fmtCurrency, fmtPercent2, toNumber } from '@/lib/formatters';
import { EditAmountModal } from '@/components/EditAmountModal';
import { toGrantShorthand } from '@/utils/grants';
import { deduplicateGrants, aggregateBudgetByGrantCategory } from '@/utils/data';

const BudgetFinancePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [grants, setGrants] = useState<any[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    fetchGrants();
  }, []);

  const fetchGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('grants')
        .select('*')
        .order('title');

      if (error) throw error;
      setGrants(data || []);
    } catch (error) {
      console.error('Error fetching grants:', error);
      toast({
        title: "Error",
        description: "Failed to load grants",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Real budget vs actual data from database
  const [budgetVsActualData, setBudgetVsActualData] = useState<any[]>([]);
  const [budgetDataLoading, setBudgetDataLoading] = useState(true);

  const fetchBudgetVsActualData = async () => {
    setBudgetDataLoading(true);
    try {
      // Fetch budget line items with grant info
      const { data: budgetItems, error: budgetError } = await supabase
        .from('budget_line_items')
        .select(`
          *,
          grants!inner(id, title, start_date)
        `);

      if (budgetError) throw budgetError;

      // Fetch expenses grouped by grant and category
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          *,
          grants!inner(id, title, start_date)
        `);

      if (expensesError) throw expensesError;

      // Process the data to match the expected format with de-duplication
      const budgetByGrantCategory = new Map();
      
      // Group budget items by grant and category with de-duplication
      const aggregatedBudgetItems = aggregateBudgetByGrantCategory(
        budgetItems?.map(item => ({
          ...item,
          grant_id: item.grants.id,
          grantName: item.grants.title,
          category: item.category === 'Other' ? 'Miscellaneous' : (item.category || 'Miscellaneous'),
          budgeted: parseFloat(String(item.budgeted_amount || 0)) || 0
        })) || []
      );
      
      aggregatedBudgetItems.forEach(item => {
        const grantNameParts = toGrantShorthand(item.grantName, {
          start_date: item.grants.start_date
        });
        
        const key = `${item.grant_id}-${item.category}`;
        budgetByGrantCategory.set(key, {
          grantId: item.grant_id,
          grantName: grantNameParts.full,
          grantShortName: grantNameParts.short,
          category: item.category,
          budgeted: item.budgeted,
          actual: 0
        });
      });

      // Add actual spending from expenses with aggregation
      const aggregatedExpenses = aggregateBudgetByGrantCategory(
        expenses?.map(expense => {
          const description = expense.description?.toLowerCase() || '';
          let category = 'Miscellaneous';
          
          if (description.includes('personnel') || description.includes('salary') || description.includes('wages')) {
            category = 'Personnel';
          } else if (description.includes('equipment') || description.includes('hardware')) {
            category = 'Equipment';
          } else if (description.includes('travel') || description.includes('mileage')) {
            category = 'Travel';
          } else if (description.includes('supplies') || description.includes('materials')) {
            category = 'Supplies';
          }

          return {
            ...expense,
            grant_id: expense.grants.id,
            grantName: expense.grants.title,
            category,
            actual: parseFloat(String(expense.amount || 0)) || 0
          };
        }) || []
      );

      aggregatedExpenses.forEach(expense => {
        const grantNameParts = toGrantShorthand(expense.grantName, {
          start_date: expense.grants.start_date
        });
        
        const key = `${expense.grant_id}-${expense.category}`;
        if (!budgetByGrantCategory.has(key)) {
          budgetByGrantCategory.set(key, {
            grantId: expense.grant_id,
            grantName: grantNameParts.full,
            grantShortName: grantNameParts.short,
            category: expense.category,
            budgeted: 0,
            actual: 0
          });
        }
        const existing = budgetByGrantCategory.get(key);
        existing.actual += expense.actual;
      });

      // Convert to array and calculate metrics
      const processedData = Array.from(budgetByGrantCategory.values()).map((item, index) => {
        const remaining = item.budgeted - item.actual;
        const utilization = item.budgeted > 0 ? (item.actual / item.budgeted) * 100 : 0;
        const status = utilization > 100 ? 'over-budget' : 'on-track';

        return {
          id: index + 1,
          ...item,
          remaining,
          utilization: parseFloat(utilization.toFixed(2)),
          status
        };
      });

      setBudgetVsActualData(processedData);
    } catch (error) {
      console.error('Error fetching budget vs actual data:', error);
      toast({
        title: "Error",
        description: "Failed to load budget comparison data",
        variant: "destructive"
      });
    } finally {
      setBudgetDataLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetVsActualData();
  }, []);

  // Listen for budget data updates from Budget Builder
  useEffect(() => {
    const handleBudgetUpdate = () => {
      console.log('🔄 BudgetFinancePage: Refreshing budget vs actual data due to budget update');
      fetchBudgetVsActualData();
    };

    window.addEventListener('budgetDataUpdated', handleBudgetUpdate);
    return () => window.removeEventListener('budgetDataUpdated', handleBudgetUpdate);
  }, []);


  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Received':
      case 'on-track':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'over-budget':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Export function
  const exportBudgetVsActual = () => {
    const csvHeaders = ['Grant Name', 'Category', 'Budgeted', 'Actual', 'Remaining', 'Utilization %', 'Status'];
    const csvRows = [
      csvHeaders.join(','),
      ...budgetVsActualData.map(item => [
        `"${item.grantName}"`,
        `"${item.category}"`,
        item.budgeted,
        item.actual,
        item.remaining,
        item.utilization,
        `"${item.status}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-vs-actual-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete", 
      description: "Budget vs Actual report exported successfully.",
    });
  };

  // Get category totals for chart
  const getCategoryTotals = () => {
    const categoryMap = new Map();
    budgetVsActualData.forEach(item => {
      if (categoryMap.has(item.category)) {
        const existing = categoryMap.get(item.category);
        existing.budgeted += item.budgeted;
        existing.actual += item.actual;
      } else {
        categoryMap.set(item.category, {
          category: item.category,
          budgeted: item.budgeted,
          actual: item.actual
        });
      }
    });
    return Array.from(categoryMap.values());
  };

  const filteredBudgetData = budgetVsActualData.filter(item => 
    selectedGrant === 'all' || item.grantName === selectedGrant
  );

  const uniqueGrants = [...new Set(budgetVsActualData.map(item => item.grantName))];

  const formatBudgetContext = () => {
    const totalBudgeted = budgetVsActualData.reduce((sum, item) => sum + item.budgeted, 0);
    const totalActual = budgetVsActualData.reduce((sum, item) => sum + item.actual, 0);
    const categories = getCategoryTotals();
    
    return `Budget Analysis Summary:
Total Budgeted: ${formatCurrency(totalBudgeted)}
Total Actual: ${formatCurrency(totalActual)}
Utilization Rate: ${((totalActual / totalBudgeted) * 100).toFixed(1)}%

Category Breakdown:
${categories.map(cat => 
  `${cat.category}: Budgeted ${formatCurrency(cat.budgeted)}, Actual ${formatCurrency(cat.actual)} (${((cat.actual / cat.budgeted) * 100).toFixed(1)}%)`
).join('\n')}

Individual Line Items:
${budgetVsActualData.map(item => 
  `${item.grantName} - ${item.category}: ${formatCurrency(item.actual)}/${formatCurrency(item.budgeted)} (${item.utilization}%) - ${item.status}`
).join('\n')}`;
  };

  return (
    <AccessControlGuard requiredRoles={['admin', 'manager', 'writer']}>
      <div className="min-h-screen bg-slate-50">
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Budget & Finance</h1>
              </div>
              <p className="text-slate-600 text-sm md:text-base">
                Budget management, expenditure tracking, and financial compliance
              </p>
            </div>
          </div>

          {/* Main Content - Correct Tab Order */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Financial Overview</TabsTrigger>
              <TabsTrigger value="builder">Budget Builder</TabsTrigger>
              <TabsTrigger value="vs-actual">Budget vs. Actual</TabsTrigger>
              <TabsTrigger value="drawdowns">Drawdown Tracker</TabsTrigger>
              <TabsTrigger value="match">Match/Cost-Share</TabsTrigger>
            </TabsList>

            {/* Tab 1: Financial Overview (moved from Tab 4) */}
            <TabsContent value="overview" className="space-y-6">
              <AdvancedFinancialDashboard key={`overview-${Date.now()}`} />
            </TabsContent>

            {/* Tab 3: Budget Builder */}
            <TabsContent value="builder" className="space-y-6">
              <div className="text-sm text-slate-600 mb-4">
                Add budget items and classify by type, category, and reimbursement status.
              </div>
              <SimpleBudgetManager />
            </TabsContent>

              {/* Tab 2: Budget vs. Actual */}
            <TabsContent value="vs-actual" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Budget vs. Actual Analysis</h2>
                  <p className="text-sm text-slate-600">Compare planned vs. actual spending for any tracked grant.</p>
                </div>
                <div className="flex items-center gap-2">
                  <ExpenseEntryForm onExpenseAdded={fetchBudgetVsActualData} />
                  <ContextCopilotButton
                    context={formatBudgetContext()}
                    promptTemplate="Please analyze this budget vs actual data and flag any unusual spending trends, variances, or areas of concern. Provide recommendations for budget management."
                    buttonText="Flag Spending Trends"
                    title="Budget Analysis"
                  />
                  <Button variant="outline" onClick={exportBudgetVsActual}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <Label htmlFor="grant-filter">Filter by Grant:</Label>
                    </div>
                    <Select value={selectedGrant} onValueChange={setSelectedGrant}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Grants</SelectItem>
                        {uniqueGrants.map(grant => (
                          <SelectItem key={grant} value={grant}>
                            {toGrantShorthand(grant).short}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Quarters</SelectItem>
                        <SelectItem value="q1">Q1 2024</SelectItem>
                        <SelectItem value="q2">Q2 2024</SelectItem>
                        <SelectItem value="q3">Q3 2024</SelectItem>
                        <SelectItem value="q4">Q4 2024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Budget vs Actual Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Expenditure Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {budgetDataLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : budgetVsActualData.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No budget data found</h3>
                      <p className="text-slate-600">
                        Start by adding budget items in the Budget Builder tab.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-300">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Grant</th>
                            <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Category</th>
                            <th className="border border-slate-300 p-3 text-right text-sm font-medium text-slate-900">Budgeted</th>
                            <th className="border border-slate-300 p-3 text-right text-sm font-medium text-slate-900">Actual</th>
                            <th className="border border-slate-300 p-3 text-right text-sm font-medium text-slate-900">Remaining</th>
                            <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Utilization</th>
                            <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                           {filteredBudgetData.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="border border-slate-300 p-3 text-sm" title={item.grantName}>
                                  {item.grantShortName || item.grantName}
                                </td>
                                <td className="border border-slate-300 p-3 text-sm">{item.category}</td>
                                  <td className="border border-slate-300 p-3 text-right text-sm cursor-pointer hover:bg-blue-50" 
                                      onClick={() => {
                                        setEditingItem(item);
                                        setEditModalOpen(true);
                                      }}>
                                    {fmtCurrency(item.budgeted)}
                                  </td>
                                  <td className="border border-slate-300 p-3 text-right text-sm cursor-pointer hover:bg-blue-50"
                                      onClick={() => {
                                        setEditingItem(item);
                                        setEditModalOpen(true);
                                      }}>
                                    {fmtCurrency(item.actual)}
                                  </td>
                                 <td className={`border border-slate-300 p-3 text-sm text-right ${item.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                   {fmtCurrency(item.remaining)}
                                 </td>
                                  <td className={`border border-slate-300 p-3 text-sm text-center font-medium ${getUtilizationTextColor(item.utilization)}`}>
                                    {fmtPercent2(item.utilization)}
                                  </td>
                                <td className="border border-slate-300 p-3 text-center">
                                  <Badge className={getStatusColor(item.status)}>
                                    {item.status === 'on-track' ? 'On Track' : 'Over Budget'}
                                  </Badge>
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Category Summary Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {getCategoryTotals().map((category) => (
                  <Card key={category.category}>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-slate-900 mb-2">{category.category}</h3>
                       <div className="space-y-1">
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-600">Budgeted:</span>
                           <span className="font-medium">{formatCurrency(category.budgeted)}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-600">Actual:</span>
                           <span className="font-medium">{formatCurrency(category.actual)}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-600">Remaining:</span>
                           <span className={`font-medium ${category.budgeted - category.actual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                             {formatCurrency(category.budgeted - category.actual)}
                           </span>
                         </div>
                         <div className="mt-2">
                           <div className="flex justify-between text-xs mb-1">
                              <span>Utilization</span>
                              <span className={getUtilizationTextColor((category.actual / category.budgeted) * 100)}>
                                {category.budgeted > 0 ? fmtPercent2((category.actual / category.budgeted) * 100) : '0.00%'}
                              </span>
                           </div>
                           <div className="w-full bg-gray-200 rounded-full h-2">
                             <div 
                               className="h-2 rounded-full transition-all duration-300"
                               style={{ 
                                 width: `${category.budgeted > 0 ? Math.min((category.actual / category.budgeted) * 100, 100) : 0}%`,
                                 backgroundColor: category.budgeted > 0 
                                   ? (category.actual / category.budgeted * 100) <= 75 
                                     ? '#10B981' 
                                     : (category.actual / category.budgeted * 100) <= 90 
                                       ? '#F59E0B' 
                                       : '#EF4444'
                                   : '#9CA3AF'
                               }}
                             />
                           </div>
                         </div>
                       </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Edit Amount Modal */}
            {editingItem && (
              <EditAmountModal
                isOpen={editModalOpen}
                onClose={() => {
                  setEditModalOpen(false);
                  setEditingItem(null);
                }}
                onSave={async (budgeted, actual, notes) => {
                  // Update budget line item in database
                  try {
                    // Find or create budget line item
                    const { data: existingItems, error: fetchError } = await supabase
                      .from('budget_line_items')
                      .select('*')
                      .eq('grant_id', editingItem.grantId)
                      .eq('category', editingItem.category)
                      .limit(1);

                    if (fetchError) throw fetchError;

                    if (existingItems && existingItems.length > 0) {
                      // Update existing item
                      const { error: updateError } = await supabase
                        .from('budget_line_items')
                        .update({ 
                          budgeted_amount: budgeted,
                          allocated_amount: actual,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', existingItems[0].id);

                      if (updateError) throw updateError;
                    } else {
                      // Create new item
                      const { error: insertError } = await supabase
                        .from('budget_line_items')
                        .insert({
                          grant_id: editingItem.grantId,
                          category: editingItem.category,
                          item_name: `${editingItem.category} - ${editingItem.grantName}`,
                          budgeted_amount: budgeted,
                          allocated_amount: actual,
                          fiscal_year: new Date().getFullYear()
                        });

                      if (insertError) throw insertError;
                    }

                    // Update local state optimistically
                    setBudgetVsActualData(prev => prev.map(item => 
                      item.id === editingItem.id 
                        ? { 
                            ...item, 
                            budgeted: budgeted,
                            actual: actual,
                            remaining: budgeted - actual,
                            utilization: parseFloat(((actual / budgeted) * 100).toFixed(2))
                          }
                        : item
                    ));

                    // Trigger global refresh
                    window.dispatchEvent(new CustomEvent('budgetDataUpdated'));
                    
                    toast({
                      title: "Budget Updated",
                      description: "Budget amounts have been saved successfully",
                    });

                  } catch (error: any) {
                    console.error('Error updating budget:', error);
                    toast({
                      title: "Save Failed",
                      description: error.message || "Failed to save budget changes",
                      variant: "destructive"
                    });
                    throw error;
                  }
                }}
                currentBudgeted={editingItem.budgeted}
                currentActual={editingItem.actual}
                grantName={editingItem.grantName}
                category={editingItem.category}
              />
            )}

            {/* Tab 3: Enhanced Drawdown Tracker */}
            <TabsContent value="drawdowns" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Drawdown Tracker</h2>
                  <p className="text-sm text-slate-600">Track submitted and reimbursed drawdowns per grant.</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-600">Loading grants...</div>
                </div>
              ) : grants.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No awarded grants found</h3>
                    <p className="text-slate-600">
                      Drawdown tracking is available for awarded grants only.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {grants.map((grant) => (
                    <div key={grant.id} className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">{grant.title}</h3>
                      <EnhancedDrawdownTracker
                        grantId={grant.id}
                        grantTitle={grant.title}
                        awardAmount={grant.amount_awarded || 0}
                        canEdit={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab 5: Match/Cost-Share */}
            <TabsContent value="match" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Match/Cost-Share Tracking</h2>
                  <p className="text-sm text-slate-600">Track matching fund requirements and fulfillment.</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-600">Loading grants...</div>
                </div>
              ) : grants.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No grants found</h3>
                    <p className="text-slate-600">
                      Match/cost-share tracking is available for active grants.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {grants.map((grant) => (
                    <div key={grant.id} className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">{grant.title}</h3>
                      <MatchCostSharePanel grantId={grant.id} />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </AccessControlGuard>
  );
};

export default BudgetFinancePage;
