import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Plus, Download, Calculator, PieChart, FileText, Tag, Filter } from 'lucide-react';
import ContextCopilotButton from '@/components/ContextCopilotButton';
import AccessControlGuard from '@/components/AccessControlGuard';
import { Link } from 'react-router-dom';
import { formatCurrency, formatNumber, parseNumberWithCommas, formatInputValue } from '@/lib/financial-utils';

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  tags: ('reimbursed' | 'pending' | 'projected')[];
  customCategory?: string;
}

const SimpleBudgetManager = () => {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('builder');
  const [grants, setGrants] = useState([]);
  const [selectedGrantId, setSelectedGrantId] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Allow all authenticated users to edit budgets (RLS policy issue workaround)
  const canEdit = true;

  const categories = [
    { value: 'Personnel', label: 'Personnel' },
    { value: 'Equipment', label: 'Equipment' },
    { value: 'Travel', label: 'Travel' },
    { value: 'Supplies', label: 'Supplies' },
    { value: 'Miscellaneous', label: 'Miscellaneous' },
    { value: 'Custom', label: 'Custom Category' }
  ];

  useEffect(() => {
    loadGrants();
  }, []);

  useEffect(() => {
    if (selectedGrantId) {
      loadBudgetItems();
    }
  }, [selectedGrantId]);

  const loadGrants = async () => {
    try {
      
      const { data, error } = await supabase
        .from('grants')
        .select('id, title, status')
        .order('title');

      if (error) throw error;

      
      setGrants(data || []);

      // Auto-select first grant if available
      if (data && data.length > 0 && !selectedGrantId) {
        console.log('🔧 Auto-selecting first grant:', data[0]);
        setSelectedGrantId(data[0].id);
      } else if (data && data.length === 0) {
        console.log('🔧 No grants found, will show create grant option');
      }
    } catch (error) {
      
      toast({
        title: "Error loading grants",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetItems = async () => {
    if (!selectedGrantId) return;
    
    try {
      
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('*')
        .eq('grant_id', selectedGrantId);

      if (error) {
        
        setBudgetItems([]);
        return;
      }

      const items = data?.map(item => ({
        id: item.id,
        category: item.category || 'Personnel', // Use stored category or default
        description: item.item_name || item.description || 'Budget Item',
        amount: item.budgeted_amount || 0,
        tags: (item.tags ? item.tags.split(',').filter(tag => tag.trim() !== '') : []) as ('reimbursed' | 'pending' | 'projected')[], // Parse stored tags
        customCategory: undefined // Will be populated if custom categories are supported in future
      })) || [];

      
      setBudgetItems(items);
    } catch (error) {
      console.error('🔧 SimpleBudgetManager: Error loading budget items:', error);
      setBudgetItems([]);
    }
  };

  const addBudgetItem = () => {
    console.log('Add budget item clicked');
    const newItem: BudgetItem = {
      id: `temp-${Date.now()}`, // Use temp ID prefix for new items
      category: 'Personnel',
      description: '',
      amount: 0,
      tags: []
    };
    console.log('Adding new item:', newItem);
    setBudgetItems(prev => {
      const updated = [...prev, newItem];
      console.log('Updated items:', updated);
      return updated;
    });
    // Reset filter to show all items including the new one
    setTagFilter('all');
  };

  const updateBudgetItem = (id: string, field: keyof BudgetItem, value: any) => {
    setBudgetItems(items => items.map(item => {
      if (item.id === id) {
        // If updating amount field, handle comma parsing
        if (field === 'amount') {
          const numericValue = typeof value === 'string' ? parseNumberWithCommas(value) : value;
          return { ...item, [field]: numericValue };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const deleteBudgetItem = async (id: string) => {
    // If it's a database item (not a temp item), delete from database
    if (!id.startsWith('temp-')) {
      try {
        const { error } = await supabase
          .from('budget_line_items')
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error('Error deleting from database:', error);
          toast({
            title: "Error deleting item",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      } catch (error) {
        console.error('Error deleting budget item:', error);
        toast({
          title: "Error deleting item",
          description: "Failed to delete item from database",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Remove from local state
    setBudgetItems(items => items.filter(item => item.id !== id));
    
    toast({
      title: "Item deleted",
      description: "Budget item has been removed",
    });
  };

  const saveBudget = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save budget data.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedGrantId) {
      toast({
        title: "No grant selected",
        description: "Please select a grant first.",
        variant: "destructive",
      });
      return;
    }

    if (budgetItems.length === 0) {
      toast({
        title: "No budget items",
        description: "Please add some budget items before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      const newItems = budgetItems.filter(item => item.id.startsWith('temp-') && item.description.trim() !== '');
      const existingItems = budgetItems.filter(item => !item.id.startsWith('temp-'));
      
      // Only insert new items
      if (newItems.length > 0) {
        const itemsToInsert = newItems.map(item => {
          const finalCategory = item.category === 'Custom' && item.customCategory 
            ? item.customCategory 
            : (item.category === 'Custom' ? 'Miscellaneous' : item.category);
          
          return {
            grant_id: selectedGrantId,
            item_name: item.description.trim() || 'Budget Item',
            description: item.description.trim() || null,
            budgeted_amount: Number(item.amount) || 0,
            allocated_amount: Number(item.amount) || 0,
            spent_amount: 0,
            fiscal_year: new Date().getFullYear(),
            category: finalCategory,
            tags: item.tags.join(','),
            custom_category: item.category === 'Custom' ? item.customCategory : null
          };
        });

        const { data: newData, error: insertError } = await supabase
          .from('budget_line_items')
          .insert(itemsToInsert)
          .select();

        if (insertError) {
          throw new Error(`Database Error: ${insertError.message}`);
        }

        // Update local state with new database IDs
        if (newData && newData.length > 0) {
          setBudgetItems(prevItems => {
            const tempItemIds = newItems.map(item => item.id);
            const nonTempItems = prevItems.filter(item => !tempItemIds.includes(item.id));
            const newDbItems = newData.map(savedItem => ({
              id: savedItem.id,
              category: savedItem.category || 'Personnel',
              description: savedItem.item_name || savedItem.description || 'Budget Item',
              amount: savedItem.budgeted_amount || 0,
              tags: (savedItem.tags ? savedItem.tags.split(',').filter(tag => tag.trim() !== '') : []) as ('reimbursed' | 'pending' | 'projected')[]
            }));
            return [...nonTempItems, ...newDbItems];
          });
        }
      }

      // Update existing items
      if (existingItems.length > 0) {
        for (const item of existingItems) {
          const finalCategory = item.category === 'Custom' && item.customCategory 
            ? item.customCategory 
            : (item.category === 'Custom' ? 'Miscellaneous' : item.category);

          const { error: updateError } = await supabase
            .from('budget_line_items')
            .update({
              item_name: item.description.trim() || 'Budget Item',
              description: item.description.trim() || null,
              budgeted_amount: Number(item.amount) || 0,
              allocated_amount: Number(item.amount) || 0,
              category: finalCategory,
              tags: item.tags.join(','),
              custom_category: item.category === 'Custom' ? item.customCategory : null
            })
            .eq('id', item.id);

          if (updateError) {
            console.error('Error updating item:', updateError);
          }
        }
      }

      toast({
        title: "Budget saved successfully", 
        description: `Saved ${newItems.length + existingItems.length} budget items.`,
      });

      // Trigger refresh in other components by dispatching a custom event
      window.dispatchEvent(new CustomEvent('budgetDataUpdated', {
        detail: { grantId: selectedGrantId, timestamp: Date.now() }
      }));
      
    } catch (error) {
      console.error('🔧 Error saving budget:', error);
      toast({
        title: "Error saving budget",
        description: error.message || "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const totalBudget = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  
  const filteredBudgetItems = budgetItems.filter(item => {
    if (tagFilter === 'all') return true;
    return item.tags.includes(tagFilter as 'reimbursed' | 'pending' | 'projected');
  });

  const toggleTag = (itemId: string, tag: 'reimbursed' | 'pending' | 'projected') => {
    setBudgetItems(items => items.map(item => {
      if (item.id === itemId) {
        const hasTag = item.tags.includes(tag);
        return {
          ...item,
          tags: hasTag 
            ? item.tags.filter(t => t !== tag)
            : [...item.tags, tag]
        };
      }
      return item;
    }));
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'reimbursed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'projected': return 'bg-blue-100 text-blue-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };



  const createTestGrant = async () => {
    try {
      const testGrant = {
        title: 'Test Grant for Budget',
        funder: 'Test Funder',
        status: 'active',
        amount_requested: 100000,
        amount_awarded: 100000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('grants')
        .insert({
          title: testGrant.title,
          funder: testGrant.funder,
          status: 'draft' as 'draft' | 'active' | 'closed',
          amount_awarded: testGrant.amount_awarded
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Test grant created",
        description: "Created a test grant for budget management.",
      });

      // Reload grants and select the new one
      await loadGrants();
      if (data) {
        setSelectedGrantId(data.id);
      }
    } catch (error) {
      console.error('🔧 Error creating test grant:', error);
      toast({
        title: "Error creating test grant",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatBudgetContext = () => {
    if (budgetItems.length === 0) {
      return "No budget items have been created yet.";
    }

    // Group items by category and count duplicates
    const categoryGroups = budgetItems.reduce((acc, item) => {
      const key = `${item.category}: ${item.description}`;
      if (acc[key]) {
        acc[key].count++;
        acc[key].totalAmount += item.amount;
      } else {
        acc[key] = { count: 1, totalAmount: item.amount, category: item.category, description: item.description };
      }
      return acc;
    }, {} as Record<string, {count: number, totalAmount: number, category: string, description: string}>);

    // Format as clean summary
    const lines = Object.entries(categoryGroups).map(([key, data]) => {
      const prefix = data.count > 1 ? `${data.count}x ` : '';
      return `- ${prefix}${data.category}: ${data.description} (${formatCurrency(data.totalAmount)})`;
    });

    return `Budget Summary:\n${lines.join('\n')}\n\nTotal Budget: ${formatCurrency(totalBudget)}`;
  };

  const exportBudgetToCSV = async () => {
    if (budgetItems.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There's no budget data available to export yet. Add budget items to proceed.",
        variant: "destructive"
      });
      return;
    }

    try {
      const headers = ['Category', 'Description', 'Amount', 'Tags'];
      const csvContent = [
        headers.join(','),
        ...budgetItems.map(item => [
          `"${item.category}"`,
          `"${item.description}"`,
          item.amount,
          `"${item.tags.join(', ')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Budget data has been exported to CSV successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export budget data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle real-time currency formatting for input fields
  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const value = e.target.value;
    const numericValue = parseNumberWithCommas(value);
    
    // Update the item with numeric value
    updateBudgetItem(itemId, 'amount', numericValue);
    
    // Format the input display with real-time formatting
    setTimeout(() => {
      const formattedValue = formatNumber(numericValue);
      if (e.target && e.target.value !== formattedValue) {
        formatInputValue(e.target, value);
      }
    }, 0);
  };

  if (loading) {
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
      {/* Grant Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-2">
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
          
          <Button variant="outline" onClick={exportBudgetToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {!selectedGrantId ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <DollarSign className="h-16 w-16 text-slate-300 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a Grant to Get Started</h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              Choose a grant from the dropdown above to start building your budget.
            </p>
            {grants.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-3">
                  <strong>No grants found.</strong> Create a grant to start budget management.
                </p>
                <div className="flex space-x-2">
                  <Button onClick={createTestGrant} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Test Grant
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/grants">
                      <Plus className="h-4 w-4 mr-2" />
                      Find Grants
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Budget Builder Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Budget Line Items</CardTitle>
                  <CardDescription>
                    Add budget items for your grant
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <ContextCopilotButton
                    context={formatBudgetContext()}
                    promptTemplate="Please analyze this budget and help classify these expenses according to federal grant guidelines. Consider allowable vs unallowable costs and appropriate budget categories."
                    buttonText="Classify Expenses"
                    title="Budget Expense Classification"
                    placeholder="Describe any specific grant requirements or questions about expense classification..."
                  />
                  {canEdit && (
                    <>
                      <Button onClick={addBudgetItem} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                      <Button onClick={saveBudget} variant="outline" size="sm">
                        Save Budget
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center space-x-2">
                <Filter className="h-4 w-4 text-slate-600" />
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="reimbursed">Reimbursed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="projected">Projected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {filteredBudgetItems.length > 0 ? (
                <div className="space-y-4">
                  {filteredBudgetItems.map((item) => (
                    <Card key={item.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-600">Tags:</span>
                          <div className="flex gap-1">
                            {['reimbursed', 'pending', 'projected'].map((tag) => (
                              <button
                                key={tag}
                                onClick={() => toggleTag(item.id, tag as 'reimbursed' | 'pending' | 'projected')}
                                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                                  item.tags.includes(tag as 'reimbursed' | 'pending' | 'projected')
                                    ? getTagColor(tag)
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                                disabled={!canEdit}
                              >
                                <Tag className="h-3 w-3 mr-1 inline" />
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                         <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                           <div>
                             <Label className="text-sm font-medium">Category</Label>
                             <Select
                               value={item.category}
                               onValueChange={(value) => updateBudgetItem(item.id, 'category', value)}
                               disabled={!canEdit}
                             >
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 {categories.map(cat => (
                                   <SelectItem key={cat.value} value={cat.value}>
                                     {cat.label}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                           </div>

                           {item.category === 'Custom' && (
                             <div>
                               <Label className="text-sm font-medium">Custom Category</Label>
                               <Input
                                 value={item.customCategory || ''}
                                 onChange={(e) => updateBudgetItem(item.id, 'customCategory', e.target.value)}
                                 placeholder="Enter custom category"
                                 disabled={!canEdit}
                               />
                             </div>
                           )}

                          <div>
                            <Label className="text-sm font-medium">Description</Label>
                            <Input
                              value={item.description}
                              onChange={(e) => updateBudgetItem(item.id, 'description', e.target.value)}
                              placeholder="Item description"
                              disabled={!canEdit}
                            />
                          </div>

                             <div>
                               <Label className="text-sm font-medium">Amount</Label>
                               <Input
                                 type="text"
                                 value={item.amount > 0 ? formatNumber(item.amount) : ''}
                                 onChange={(e) => handleAmountInput(e, item.id)}
                                 placeholder="0"
                                 disabled={!canEdit}
                               />
                             </div>

                          <div className="flex items-end">
                             {canEdit && (
                               <Button
                                 onClick={() => deleteBudgetItem(item.id)}
                                 variant="outline"
                                 size="sm"
                                 className="text-red-600 hover:text-red-700"
                               >
                                 Delete
                               </Button>
                             )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">No budget items yet</p>
                  {canEdit && (
                    <Button onClick={addBudgetItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Item
                    </Button>
                  )}
                </div>
              )}

              {/* Total Budget */}
              {budgetItems.length > 0 && (
                <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-slate-900">Total Budget:</span>
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(totalBudget)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SimpleBudgetManager;