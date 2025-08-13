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
import { supabase } from '@/integrations/supabase/client';
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
  Clock
} from 'lucide-react';

interface BudgetTrackerProps {
  grantId?: string;
}

const BudgetTracker: React.FC<BudgetTrackerProps> = ({ grantId }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [grants, setGrants] = useState([]);
  const [selectedGrantId, setSelectedGrantId] = useState(grantId || '');
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [budgetLineItems, setBudgetLineItems] = useState([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(null);

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
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedGrantId) {
      loadBudgetData();
    }
  }, [selectedGrantId, selectedFiscalYear, selectedQuarter]);

  const loadInitialData = async () => {
    try {
      const [grantsResult, categoriesResult] = await Promise.all([
        supabase.from('grants').select('id, title, status').order('title'),
        supabase.from('budget_categories').select('*').order('name')
      ]);

      if (grantsResult.error) throw grantsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setGrants(grantsResult.data || []);
      setBudgetCategories(categoriesResult.data || []);

      if (!selectedGrantId && grantsResult.data?.[0]) {
        setSelectedGrantId(grantsResult.data[0].id);
      }
    } catch (error) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadBudgetData = async () => {
    if (!selectedGrantId) return;

    setLoading(true);
    try {
      // Load budget line items first to calculate summary
      let lineItemsQuery = supabase
        .from('budget_line_items')
        .select(`
          *,
          budget_categories(name, description)
        `)
        .eq('grant_id', selectedGrantId)
        .eq('fiscal_year', selectedFiscalYear);

      if (selectedQuarter) {
        lineItemsQuery = lineItemsQuery.eq('quarter', selectedQuarter);
      }

      const { data: lineItemsData, error: lineItemsError } = await lineItemsQuery.order('created_at', { ascending: false });
      if (lineItemsError) throw lineItemsError;
      setBudgetLineItems(lineItemsData || []);

      // Load expenses
      let expensesQuery = supabase
        .from('expenses')
        .select(`
          *,
          budget_line_items(item_name, budget_categories(name))
        `)
        .eq('grant_id', selectedGrantId);

      // Filter by fiscal year (approximate based on expense date)
      const startDate = `${selectedFiscalYear}-01-01`;
      const endDate = `${selectedFiscalYear}-12-31`;
      expensesQuery = expensesQuery.gte('date', startDate).lte('date', endDate);

      const { data: expensesData, error: expensesError } = await expensesQuery.order('date', { ascending: false });
      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

      // Calculate budget summary from the data
      const totalBudgeted = lineItemsData?.reduce((sum, item) => sum + (item.budgeted_amount || 0), 0) || 0;
      const totalSpent = expensesData?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
      const totalRemaining = totalBudgeted - totalSpent;
      const utilizationRate = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

      // Create category breakdown
      const categoryBreakdown = budgetCategories.map(category => {
        const categoryItems = lineItemsData?.filter(item => item.category_id === category.id) || [];
        const categoryBudgeted = categoryItems.reduce((sum, item) => sum + (item.budgeted_amount || 0), 0);
        const categoryExpenses = expensesData?.filter(expense => 
          categoryItems.some(item => item.id === expense.budget_line_item_id)
        ) || [];
        const categorySpent = categoryExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        
        return {
          category: category.name,
          budgeted: categoryBudgeted,
          spent: categorySpent
        };
      }).filter(item => item.budgeted > 0 || item.spent > 0);

      setBudgetSummary({
        total_budgeted: totalBudgeted,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        utilization_rate: Math.round(utilizationRate * 100) / 100,
        category_breakdown: JSON.stringify(categoryBreakdown)
      });

    } catch (error) {
      toast({
        title: "Error loading budget data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createLineItem = async () => {
    if (!selectedGrantId || !lineItemForm.category_id || !lineItemForm.item_name || !lineItemForm.budgeted_amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('budget_line_items')
        .insert([{
          grant_id: selectedGrantId,
          ...lineItemForm,
          budgeted_amount: parseFloat(lineItemForm.budgeted_amount),
          quarter: lineItemForm.quarter ? parseInt(lineItemForm.quarter) : null
        }]);

      if (error) throw error;

      toast({
        title: "Budget Line Item Created",
        description: "Budget line item has been added successfully",
      });

      setLineItemForm({
        category_id: '',
        item_name: '',
        description: '',
        budgeted_amount: '',
        fiscal_year: new Date().getFullYear(),
        quarter: ''
      });

      loadBudgetData();
    } catch (error) {
      toast({
        title: "Error creating line item",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const createExpense = async () => {
    if (!selectedGrantId || !expenseForm.expense_date || !expenseForm.amount || !expenseForm.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          grant_id: selectedGrantId,
          date: expenseForm.expense_date,
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description,
          budget_line_item_id: expenseForm.budget_line_item_id || null,
          vendor: expenseForm.vendor,
          invoice_number: expenseForm.invoice_number
        }]);

      if (error) throw error;

      toast({
        title: "Expense Created",
        description: "Expense has been recorded successfully",
      });

      setExpenseForm({
        budget_line_item_id: '',
        expense_date: '',
        amount: '',
        description: '',
        vendor: '',
        invoice_number: ''
      });

      loadBudgetData();
    } catch (error) {
      toast({
        title: "Error creating expense",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportBudgetData = async (format: 'csv' | 'pdf') => {
    try {
      if (format === 'csv') {
        // Generate CSV data
        const csvData = [
          ['Item Name', 'Category', 'Budgeted Amount', 'Spent Amount', 'Remaining', 'Fiscal Year'],
          ...budgetLineItems.map(item => [
            item.item_name,
            item.budget_categories?.name || 'N/A',
            item.budgeted_amount,
            item.spent_amount || 0,
            (item.budgeted_amount || 0) - (item.spent_amount || 0),
            item.fiscal_year
          ])
        ];
        
        const csvContent = csvData.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `budget-report-${selectedGrantId}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "Export Complete",
          description: "CSV file has been downloaded successfully.",
        });
      } else {
        toast({
          title: "PDF Export",
          description: "PDF export feature coming soon. Use CSV export for now.",
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate export file.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const getUtilizationColor = (rate: number) => {
    if (rate < 50) return 'text-green-600';
    if (rate < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const quarters = [
    { value: 1, label: 'Q1 (Jan-Mar)' },
    { value: 2, label: 'Q2 (Apr-Jun)' },
    { value: 3, label: 'Q3 (Jul-Sep)' },
    { value: 4, label: 'Q4 (Oct-Dec)' }
  ];

  const fiscalYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Budget Tracker</h2>
          <p className="text-muted-foreground">
            Monitor financial performance and track expenditures
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportBudgetData('csv')} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportBudgetData('pdf')} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Grant and Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Budget Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Grant</Label>
              <Select value={selectedGrantId} onValueChange={setSelectedGrantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select grant" />
                </SelectTrigger>
                <SelectContent>
                  {grants.map((grant) => (
                    <SelectItem key={grant.id} value={grant.id}>
                      {grant.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Select value={selectedFiscalYear.toString()} onValueChange={(value) => setSelectedFiscalYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      FY {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Quarter (Optional)</Label>
              <Select value={selectedQuarter?.toString() || 'all'} onValueChange={(value) => setSelectedQuarter(value === 'all' ? null : parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quarters</SelectItem>
                  {quarters.map((quarter) => (
                    <SelectItem key={quarter.value} value={quarter.value.toString()}>
                      {quarter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={loadBudgetData} className="w-full">
                <TrendingUp className="w-4 h-4 mr-2" />
                Update View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Summary Cards */}
      {budgetSummary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(budgetSummary.total_budgeted)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(budgetSummary.total_spent)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(budgetSummary.total_remaining)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilization</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUtilizationColor(budgetSummary.utilization_rate)}`}>
                {budgetSummary.utilization_rate}%
              </div>
              <Progress value={budgetSummary.utilization_rate} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="line-items">Budget Items</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {budgetSummary?.category_breakdown && (
            <Card>
              <CardHeader>
                <CardTitle>Budget by Category</CardTitle>
                <CardDescription>
                  Breakdown of budget allocation across categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {JSON.parse(budgetSummary.category_breakdown).map((category, index) => {
                    const utilization = category.budgeted > 0 ? (category.spent / category.budgeted) * 100 : 0;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{category.category}</span>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(category.spent)} / {formatCurrency(category.budgeted)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={utilization} className="flex-1" />
                          <span className={`text-sm font-medium ${getUtilizationColor(utilization)}`}>
                            {utilization.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="line-items" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Budget Line Item
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={lineItemForm.category_id} onValueChange={(value) => setLineItemForm(prev => ({ ...prev, category_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input
                    placeholder="e.g., Officer Overtime"
                    value={lineItemForm.item_name}
                    onChange={(e) => setLineItemForm(prev => ({ ...prev, item_name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Detailed description of this budget item..."
                    value={lineItemForm.description}
                    onChange={(e) => setLineItemForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Budgeted Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={lineItemForm.budgeted_amount}
                    onChange={(e) => setLineItemForm(prev => ({ ...prev, budgeted_amount: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fiscal Year</Label>
                    <Select value={lineItemForm.fiscal_year.toString()} onValueChange={(value) => setLineItemForm(prev => ({ ...prev, fiscal_year: parseInt(value) }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fiscalYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            FY {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quarter (Optional)</Label>
                    <Select value={lineItemForm.quarter} onValueChange={(value) => setLineItemForm(prev => ({ ...prev, quarter: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All quarters" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-quarters">All quarters</SelectItem>
                        {quarters.map((quarter) => (
                          <SelectItem key={quarter.value} value={quarter.value.toString()}>
                            {quarter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                
                <Button onClick={createLineItem} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line Item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget Line Items</CardTitle>
                <CardDescription>
                  Current budget allocations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {budgetLineItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium">{item.item_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {item.budget_categories?.name} • FY{item.fiscal_year}
                          {item.quarter && ` Q${item.quarter}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(item.budgeted_amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          Spent: {formatCurrency(item.spent_amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {budgetLineItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No budget line items yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Record Expense
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Budget Line Item (Optional)</Label>
                  <Select value={expenseForm.budget_line_item_id} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, budget_line_item_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select line item or leave blank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-line-item">No specific line item</SelectItem>
                      {budgetLineItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.item_name} - {formatCurrency(item.budgeted_amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={expenseForm.expense_date}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, expense_date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="What was purchased?"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Input
                      placeholder="Vendor name"
                      value={expenseForm.vendor}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input
                      placeholder="Invoice #"
                      value={expenseForm.invoice_number}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                    />
                  </div>
                </div>
                
                <Button onClick={createExpense} className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Record Expense
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>
                  Latest expense entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {expenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {expense.approval_status === 'approved' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : expense.approval_status === 'rejected' ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <div>
                          <div className="font-medium">{expense.description}</div>
                          <div className="text-sm text-muted-foreground">
                            {expense.vendor && `${expense.vendor} • `}
                            {new Date(expense.expense_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(expense.amount)}</div>
                        <Badge variant={
                          expense.approval_status === 'approved' ? 'default' :
                          expense.approval_status === 'rejected' ? 'destructive' : 'secondary'
                        }>
                          {expense.approval_status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {expenses.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No expenses recorded yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetTracker;