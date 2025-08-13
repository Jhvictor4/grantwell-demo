import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Receipt } from 'lucide-react';
import { parseNumberWithCommas, formatInputValue } from '@/lib/financial-utils';

interface ExpenseEntryFormProps {
  selectedGrant?: string;
  onExpenseAdded?: () => void;
}

export const ExpenseEntryForm: React.FC<ExpenseEntryFormProps> = ({ 
  selectedGrant, 
  onExpenseAdded 
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [grants, setGrants] = useState<any[]>([]);
  const [budgetLineItems, setBudgetLineItems] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    grant_id: selectedGrant || '',
    budget_line_item_id: '',
    date: '',
    amount: '',
    description: '',
    vendor: '',
    invoice_number: ''
  });

  useEffect(() => {
    loadGrants();
  }, []);

  useEffect(() => {
    if (expenseForm.grant_id) {
      loadBudgetLineItems(expenseForm.grant_id);
    }
  }, [expenseForm.grant_id]);

  const loadGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('grants')
        .select('id, title')
        .order('title');

      if (error) throw error;
      setGrants(data || []);
    } catch (error) {
      console.error('Error loading grants:', error);
    }
  };

  const loadBudgetLineItems = async (grantId: string) => {
    try {
      const { data, error } = await supabase
        .from('budget_line_items')
        .select('id, item_name, category')
        .eq('grant_id', grantId)
        .order('item_name');

      if (error) throw error;
      setBudgetLineItems(data || []);
    } catch (error) {
      console.error('Error loading budget line items:', error);
    }
  };

  const createExpense = async () => {
    if (!expenseForm.grant_id || !expenseForm.date || !expenseForm.amount || !expenseForm.description) {
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
          grant_id: expenseForm.grant_id,
          budget_line_item_id: expenseForm.budget_line_item_id || null,
          date: expenseForm.date,
          amount: parseNumberWithCommas(expenseForm.amount),
          description: expenseForm.description,
          vendor: expenseForm.vendor || null,
          invoice_number: expenseForm.invoice_number || null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;

      toast({
        title: "Expense Added",
        description: "Expense has been recorded successfully",
      });

      setExpenseForm({
        grant_id: selectedGrant || '',
        budget_line_item_id: '',
        date: '',
        amount: '',
        description: '',
        vendor: '',
        invoice_number: ''
      });

      setIsOpen(false);
      onExpenseAdded?.();
    } catch (error) {
      toast({
        title: "Error creating expense",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Add New Expense
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedGrant && (
            <div className="space-y-2">
              <Label htmlFor="grant_id">Grant *</Label>
              <Select value={expenseForm.grant_id} onValueChange={(value) => 
                setExpenseForm(prev => ({ ...prev, grant_id: value }))
              }>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="budget_line_item_id">Budget Line Item (Optional)</Label>
            <Select value={expenseForm.budget_line_item_id} onValueChange={(value) => 
              setExpenseForm(prev => ({ ...prev, budget_line_item_id: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Select budget item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific line item</SelectItem>
                {budgetLineItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_name} ({item.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="text"
              placeholder="$0.00"
              value={expenseForm.amount}
              onChange={(e) => {
                const value = e.target.value;
                setExpenseForm(prev => ({ ...prev, amount: value }));
                
                // Real-time formatting with comma handling
                setTimeout(() => {
                  if (e.target) {
                    formatInputValue(e.target, value);
                  }
                }, 0);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Expense description..."
              value={expenseForm.description}
              onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              placeholder="Vendor name"
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              id="invoice_number"
              placeholder="Invoice #"
              value={expenseForm.invoice_number}
              onChange={(e) => setExpenseForm(prev => ({ ...prev, invoice_number: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={createExpense} className="flex-1">
              Add Expense
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};