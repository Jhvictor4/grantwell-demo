import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Plus, Trash2, DollarSign, FileText, Download } from 'lucide-react';

interface BudgetItem {
  id: string;
  category: 'Personnel' | 'Equipment' | 'Travel' | 'Other';
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  justification: string;
}

interface GrantBudgetBuilderProps {
  grantId: string;
}

const GrantBudgetBuilder: React.FC<GrantBudgetBuilderProps> = ({ grantId }) => {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();
  const { toast } = useToast();

  const canEdit = userRole === 'admin' || userRole === 'manager';

  const dojCategories = [
    { value: 'Personnel', label: 'Personnel', description: 'Salaries, benefits, consultant fees' },
    { value: 'Equipment', label: 'Equipment', description: 'Vehicles, technology, protective gear' },
    { value: 'Travel', label: 'Travel', description: 'Transportation, lodging, per diem' },
    { value: 'Other', label: 'Other', description: 'Supplies, training, indirect costs' }
  ];

  useEffect(() => {
    fetchBudgetItems();
  }, [grantId]);

  const fetchBudgetItems = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('*')
        .eq('grant_id', grantId)
        .order('item_name');

      if (error) throw error;
      
      // Transform database data to match our BudgetItem interface
      const transformedItems: BudgetItem[] = (data || []).map(item => ({
        id: item.id,
        category: determineCategoryFromDescription(item.item_name) as 'Personnel' | 'Equipment' | 'Travel' | 'Other',
        description: item.item_name || '',
        quantity: 1, // Default quantity since it's not stored in the database
        unit_cost: item.budgeted_amount || 0,
        total_cost: item.budgeted_amount || 0,
        justification: item.description || ''
      }));
      
      setBudgetItems(transformedItems);
    } catch (error) {
      console.error('Error fetching budget items:', error);
      setBudgetItems([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine category from description
  const determineCategoryFromDescription = (description: string): string => {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('salary') || lowerDesc.includes('personnel') || lowerDesc.includes('staff')) {
      return 'Personnel';
    } else if (lowerDesc.includes('equipment') || lowerDesc.includes('vehicle') || lowerDesc.includes('technology')) {
      return 'Equipment';
    } else if (lowerDesc.includes('travel') || lowerDesc.includes('transportation') || lowerDesc.includes('lodging')) {
      return 'Travel';
    }
    return 'Other';
  };

  const addBudgetItem = () => {
    const newItem: BudgetItem = {
      id: crypto.randomUUID(),
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
    setBudgetItems(items => 
      items.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unit_cost') {
            updated.total_cost = updated.quantity * updated.unit_cost;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const deleteBudgetItem = (id: string) => {
    setBudgetItems(items => items.filter(item => item.id !== id));
  };

  const saveBudget = async () => {
    if (!canEdit) return;

    try {
      // Delete existing items
      await supabase
        .from('budget_line_items')
        .delete()
        .eq('grant_id', grantId);

      // Insert new items
      const itemsToInsert = budgetItems.map(item => ({
        grant_id: grantId,
        item_name: item.description,
        category_id: null, // We'll use a simpler approach for now
        budgeted_amount: item.total_cost,
        allocated_amount: 0,
        spent_amount: 0,
        fiscal_year: new Date().getFullYear(),
        description: item.justification
      }));

      const { error } = await supabase
        .from('budget_line_items')
        .insert(itemsToInsert);

      if (error) throw error;

      toast({
        title: "Budget Saved",
        description: "Budget has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: "Failed to save budget.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = () => {
    toast({
      title: "Export Started",
      description: "Generating PDF export...",
    });
    // PDF export functionality would be implemented here
  };

  const totalBudget = budgetItems.reduce((sum, item) => sum + item.total_cost, 0);

  const categoryTotals = dojCategories.map(category => ({
    ...category,
    total: budgetItems
      .filter(item => item.category === category.value)
      .reduce((sum, item) => sum + item.total_cost, 0)
  }));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-slate-600">
            Loading budget...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Grant Budget Builder</h2>
          <p className="text-slate-600">DOJ-compliant budget categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          {canEdit && (
            <Button onClick={saveBudget} className="bg-blue-600 hover:bg-blue-700">
              <FileText className="h-4 w-4 mr-2" />
              Save Budget
            </Button>
          )}
        </div>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categoryTotals.map(category => (
          <Card key={category.value}>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-slate-600">{category.label}</div>
              <div className="text-2xl font-bold text-slate-900">
                ${category.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Budget Line Items</span>
            {canEdit && (
              <Button onClick={addBudgetItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {budgetItems.map((item) => (
              <Card key={item.id} className="border-slate-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                      <Label>Category</Label>
                      <Select 
                        value={item.category} 
                        onValueChange={(value: any) => updateBudgetItem(item.id, 'category', value)}
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
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateBudgetItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateBudgetItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input
                        type="number"
                        value={item.unit_cost}
                        onChange={(e) => updateBudgetItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <Label>Total</Label>
                      <div className="flex items-center h-10 px-3 bg-slate-50 border rounded-md">
                        <DollarSign className="h-4 w-4 text-slate-500 mr-1" />
                        <span className="font-medium">{item.total_cost.toLocaleString()}</span>
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
                  <div className="mt-4">
                    <Label>Justification</Label>
                    <Textarea
                      value={item.justification}
                      onChange={(e) => updateBudgetItem(item.id, 'justification', e.target.value)}
                      placeholder="Explain why this expense is necessary for the grant objectives..."
                      disabled={!canEdit}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {budgetItems.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Budget Items</h3>
                <p className="text-slate-600 mb-4">Add your first budget line item to get started</p>
                {canEdit && (
                  <Button onClick={addBudgetItem} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Item
                  </Button>
                )}
              </div>
            )}
          </div>

          {budgetItems.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-slate-900">Total Budget:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ${totalBudget.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GrantBudgetBuilder;