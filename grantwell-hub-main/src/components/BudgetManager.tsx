import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Link } from 'react-router-dom';
import { 
  DollarSign, 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Download,
  Upload,
  Calculator,
  PieChart,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Target
} from 'lucide-react';

interface BudgetItem {
  id: string;
  category: 'Personnel' | 'Equipment' | 'Travel' | 'Other';
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  justification: string;
}

interface BudgetManagerProps {
  grantId?: string;
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ grantId }) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  
  // Add error boundary state
  const [hasError, setHasError] = useState(false);
  
  // Catch any errors during component lifecycle
  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      logger.error('BudgetManager Error:', error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Initialization logging
  logger.debug('BudgetManager initializing', { grantId, userRole });
  const [grants, setGrants] = useState([]);
  const [selectedGrantId, setSelectedGrantId] = useState(grantId || '');
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear());

  const canEdit = userRole === 'admin' || userRole === 'manager';

  const dojCategories = [
    { value: 'Personnel', label: 'Personnel', description: 'Salaries, benefits, consultant fees' },
    { value: 'Equipment', label: 'Equipment', description: 'Vehicles, technology, protective gear' },
    { value: 'Travel', label: 'Travel', description: 'Transportation, lodging, per diem' },
    { value: 'Other', label: 'Other', description: 'Supplies, training, indirect costs' }
  ];

  // Form states
  const [lineItemForm, setLineItemForm] = useState({
    category_id: '',
    item_name: '',
    description: '',
    budgeted_amount: '',
    fiscal_year: new Date().getFullYear(),
    quarter: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    budget_line_item_id: '',
    expense_date: '',
    amount: '',
    description: '',
    vendor: '',
    invoice_number: ''
  });

  useEffect(() => {
    try {
      loadInitialData();
    } catch (error) {
      logger.error('Error in useEffect loadInitialData:', error);
      setHasError(true);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGrantId) {
      loadBudgetData();
      fetchBudgetItems();
    }
  }, [selectedGrantId, selectedFiscalYear]);

  const loadInitialData = async () => {
    logger.debug('Loading initial budget data');
    try {
      const [grantsResult, categoriesResult] = await Promise.all([
        supabase.from('grants').select('id, title, status').order('title'),
        supabase.from('budget_categories').select('*').order('name')
      ]);
      
      logger.debug('Data loaded', { 
        grants: grantsResult.data?.length || 0,
        categories: categoriesResult.data?.length || 0
      });

      if (grantsResult.error) throw grantsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setGrants(grantsResult.data || []);
      setBudgetCategories(categoriesResult.data || []);

      if (!selectedGrantId && grantsResult.data?.[0]) {
        setSelectedGrantId(grantsResult.data[0].id);
      }
    } catch (error) {
      logger.error('Error loading initial data', error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const loadBudgetData = async () => {
    if (!selectedGrantId) return;
    
    setLoading(true);
    try {
      // Try to get budget summary, but don't fail if RPC doesn't exist
      let summaryResult = { data: null, error: null };
      try {
        summaryResult = await supabase.rpc('get_budget_summary', { p_grant_id: selectedGrantId });
      } catch (rpcError) {
        logger.info('Budget summary RPC not available, using fallback');
        // Create a simple fallback summary
        summaryResult.data = [{
          total_budgeted: 0,
          total_spent: 0,
          remaining_budget: 0,
          utilization_rate: 0
        }];
      }

      const [lineItemsResult, expensesResult] = await Promise.all([
        supabase.from('budget_line_items')
          .select(`
            *,
            budget_categories(name, color)
          `)
          .eq('grant_id', selectedGrantId)
          .eq('fiscal_year', selectedFiscalYear),
        supabase.from('expenses')
          .select(`
            *,
            budget_line_items(item_name, budget_categories(name))
          `)
          .eq('grant_id', selectedGrantId)
          .gte('expense_date', `${selectedFiscalYear}-01-01`)
          .lte('expense_date', `${selectedFiscalYear}-12-31`)
      ]);

      if (lineItemsResult.error) {
        logger.error('Budget line items error', lineItemsResult.error);
        // Continue with empty data instead of failing
      }
      if (expensesResult.error) {
        logger.error('Expenses error', expensesResult.error);
        // Continue with empty data instead of failing
      }

      setBudgetSummary(summaryResult.data?.[0] || {
        total_budgeted: 0,
        total_spent: 0,
        remaining_budget: 0,
        utilization_rate: 0
      });
      setExpenses(expensesResult.data || []);
      
    } catch (error) {
      logger.error('Budget data loading error', error);
      toast({
        title: "Error loading budget data",
        description: "Some budget features may not be available. Please check your permissions.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetItems = async () => {
    if (!selectedGrantId) return;
    
    try {
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('*')
        .eq('grant_id', selectedGrantId);

      if (error) {
        logger.error('Budget items error', error);
        setBudgetItems([]);
        return;
      }

      const transformedData = data?.map(item => ({
        id: item.id,
        category: 'Personnel' as const, // Default category, will be updated from actual data later
        description: item.description || 'Budget Item',
        quantity: 1,
        unit_cost: item.budgeted_amount || 0,
        total_cost: item.budgeted_amount || 0,
        justification: item.description || ''
      })) || [];

      setBudgetItems(transformedData);
    } catch (error) {
      logger.error('Error fetching budget items', error);
      setBudgetItems([]);
      // Don't show error toast for budget items as it's not critical
    }
  };

  const addBudgetItem = () => {
    const newItem: BudgetItem = {
      id: Date.now().toString(),
      category: 'Personnel',
      description: '',
      quantity: 1,
      unit_cost: 0,
      total_cost: 0,
      justification: ''
    };
    setBudgetItems([...budgetItems, newItem]);
  };

  const updateBudgetItem = (id: string, field: keyof BudgetItem, value: any) => {
    setBudgetItems(items => items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_cost') {
          updatedItem.total_cost = updatedItem.quantity * updatedItem.unit_cost;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const deleteBudgetItem = (id: string) => {
    setBudgetItems(items => items.filter(item => item.id !== id));
  };

  const saveBudget = async () => {
    if (!selectedGrantId) return;

    try {
      // Delete existing budget items for this grant
      await supabase
        .from('budget_line_items')
        .delete()
        .eq('grant_id', selectedGrantId);

      // Insert new budget items
      const itemsToInsert = budgetItems.map(item => ({
        grant_id: selectedGrantId,
        item_name: item.description,
        description: item.justification,
        budgeted_amount: item.total_cost,
        fiscal_year: selectedFiscalYear
      }));

      const { error } = await supabase
        .from('budget_line_items')
        .insert(itemsToInsert);

      if (error) throw error;

      toast({
        title: "Budget saved successfully",
        description: "All budget items have been saved to the database.",
      });

      // Reload budget data to reflect changes
      await loadBudgetData();
    } catch (error) {
      toast({
        title: "Error saving budget",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const totalBudget = budgetItems.reduce((sum, item) => sum + item.total_cost, 0);
  const categoryTotals = budgetItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.total_cost;
    return acc;
  }, {} as Record<string, number>);

  // Show error state if something went wrong
  if (hasError) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Budget Manager Error</h3>
            <p className="text-slate-600 mb-6">
              There was an error loading the budget manager. Please refresh the page or check the console for details.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state during initial load
  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading budget manager...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budget Manager</h1>
          <p className="text-slate-600">Manage budgets, track expenses, and monitor spending</p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Select value={selectedGrantId} onValueChange={setSelectedGrantId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={grants.length > 0 ? "Select Grant" : "No grants available"} />
            </SelectTrigger>
            <SelectContent>
              {grants.length > 0 ? (
                grants.map((grant: any) => (
                  <SelectItem key={grant.id} value={grant.id}>
                    {grant.title}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-grants" disabled>
                  No grants found - create a grant first
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {!selectedGrantId ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-16 w-16 text-slate-300 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a Grant to Get Started</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Choose a grant from the dropdown above to start building your budget, tracking expenses, and managing financial data.
            </p>
            {grants.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>No grants found.</strong> Create your first grant to start budget management.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/grants">
                    <Plus className="h-4 w-4 mr-2" />
                    Find Grants
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <PieChart className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="builder">
            <Calculator className="h-4 w-4 mr-2" />
            Budget Builder
          </TabsTrigger>
          <TabsTrigger value="tracking">
            <DollarSign className="h-4 w-4 mr-2" />
            Expense Tracking
          </TabsTrigger>
          <TabsTrigger value="reporting">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {budgetSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Budget</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(budgetSummary.total_budget)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Spent</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(budgetSummary.total_expenses)}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Remaining</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(budgetSummary.remaining_budget)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Utilization</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {budgetSummary.budget_utilization?.toFixed(1)}%
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Budget Builder Tab */}
        <TabsContent value="builder" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Budget Line Items</CardTitle>
                  <CardDescription>
                    Build your grant budget by adding line items for each category
                  </CardDescription>
                </div>
                {canEdit && (
                  <div className="flex space-x-2">
                    <Button onClick={addBudgetItem} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                    <Button onClick={saveBudget} variant="outline" size="sm">
                      Save Budget
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {dojCategories.map(category => (
                  <Card key={category.value} className="border-slate-200">
                    <CardContent className="p-4">
                      <h4 className="font-medium text-slate-900 mb-1">{category.label}</h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(categoryTotals[category.value] || 0)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">{category.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Budget Items List */}
              {budgetItems.length > 0 ? (
                <div className="space-y-4">
                  {budgetItems.map((item) => (
                    <Card key={item.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 items-start">
                          <div>
                            <Label htmlFor={`category-${item.id}`} className="text-sm font-medium">
                              Category
                            </Label>
                            <Select
                              value={item.category}
                              onValueChange={(value) => updateBudgetItem(item.id, 'category', value)}
                              disabled={!canEdit}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {dojCategories.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor={`description-${item.id}`} className="text-sm font-medium">
                              Description
                            </Label>
                            <Input
                              value={item.description}
                              onChange={(e) => updateBudgetItem(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                              disabled={!canEdit}
                            />
                          </div>

                          <div>
                            <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
                              Quantity
                            </Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateBudgetItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                              min="0"
                              disabled={!canEdit}
                            />
                          </div>

                          <div>
                            <Label htmlFor={`unit-cost-${item.id}`} className="text-sm font-medium">
                              Unit Cost
                            </Label>
                            <Input
                              type="number"
                              value={item.unit_cost}
                              onChange={(e) => updateBudgetItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              disabled={!canEdit}
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Total Cost</Label>
                            <div className="text-lg font-bold text-green-600 mt-2">
                              {formatCurrency(item.total_cost)}
                            </div>
                          </div>

                          <div className="flex items-end">
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteBudgetItem(item.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Justification */}
                        <div className="mt-4">
                          <Label htmlFor={`justification-${item.id}`} className="text-sm font-medium">
                            Justification
                          </Label>
                          <Textarea
                            value={item.justification}
                            onChange={(e) => updateBudgetItem(item.id, 'justification', e.target.value)}
                            placeholder="Explain the need for this budget item..."
                            rows={2}
                            disabled={!canEdit}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No budget items yet</h3>
                  <p className="text-slate-600 mb-4">Start building your budget by adding line items</p>
                  {canEdit && (
                    <Button onClick={addBudgetItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Button>
                  )}
                </div>
              )}

              {/* Total Budget */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-slate-900">Total Budget:</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(totalBudget)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Tracking Tab */}
        <TabsContent value="tracking" className="space-y-6">
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Expense Tracking</h3>
            <p className="text-slate-600">Track and manage your grant expenses</p>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reporting" className="space-y-6">
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Budget Reports</h3>
            <p className="text-slate-600">Generate and export budget reports</p>
          </div>
        </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BudgetManager;