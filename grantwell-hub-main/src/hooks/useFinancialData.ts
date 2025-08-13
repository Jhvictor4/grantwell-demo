import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FinancialDataHook {
  grants: any[];
  budgetItems: any[];
  expenses: any[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateBudgetItem: (id: string, updates: any) => Promise<void>;
  updateExpense: (id: string, updates: any) => Promise<void>;
}

/**
 * Unified financial data hook for consistent data management across components
 * Provides single source of truth for all financial data
 */
export const useFinancialData = (): FinancialDataHook => {
  const { toast } = useToast();
  const [grants, setGrants] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrants = useCallback(async () => {
    const { data, error } = await supabase
      .from('grants')
      .select(`
        id,
        title,
        funder,
        amount_awarded,
        status,
        start_date,
        end_date,
        created_at,
        updated_at
      `)
      .order('title');

    if (error) throw error;
    return data || [];
  }, []);

  const fetchBudgetItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('budget_line_items')
      .select(`
        *,
        grants!inner(id, title, start_date)
      `)
      .order('fiscal_year', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        grants!inner(id, title)
      `)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [grantsData, budgetData, expensesData] = await Promise.all([
        fetchGrants(),
        fetchBudgetItems(), 
        fetchExpenses()
      ]);

      setGrants(grantsData);
      setBudgetItems(budgetData);
      setExpenses(expensesData);
    } catch (err: any) {
      console.error('Error loading financial data:', err);
      setError(err.message || 'Failed to load financial data');
      
      toast({
        title: "Error Loading Data",
        description: err.message || 'Failed to load financial data',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [fetchGrants, fetchBudgetItems, fetchExpenses, toast]);

  const updateBudgetItem = useCallback(async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('budget_line_items')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setBudgetItems(prev => prev.map(item => 
        item.id === id ? { ...item, ...updates } : item
      ));

      // Trigger global update event
      window.dispatchEvent(new CustomEvent('budgetDataUpdated', {
        detail: { itemId: id, updates, timestamp: Date.now() }
      }));

      toast({
        title: "Budget Updated",
        description: "Budget item has been updated successfully",
      });
    } catch (err: any) {
      console.error('Error updating budget item:', err);
      toast({
        title: "Update Failed",
        description: err.message || 'Failed to update budget item',
        variant: "destructive"
      });
      throw err;
    }
  }, [toast]);

  const updateExpense = useCallback(async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setExpenses(prev => prev.map(expense => 
        expense.id === id ? { ...expense, ...updates } : expense
      ));

      // Trigger global update event
      window.dispatchEvent(new CustomEvent('expenseDataUpdated', {
        detail: { expenseId: id, updates, timestamp: Date.now() }
      }));

      toast({
        title: "Expense Updated",
        description: "Expense has been updated successfully",
      });
    } catch (err: any) {
      console.error('Error updating expense:', err);
      toast({
        title: "Update Failed", 
        description: err.message || 'Failed to update expense',
        variant: "destructive"
      });
      throw err;
    }
  }, [toast]);

  // Listen for external data updates
  useEffect(() => {
    const handleBudgetUpdate = () => refreshData();
    const handleExpenseUpdate = () => refreshData();

    window.addEventListener('budgetDataUpdated', handleBudgetUpdate);
    window.addEventListener('expenseDataUpdated', handleExpenseUpdate);

    return () => {
      window.removeEventListener('budgetDataUpdated', handleBudgetUpdate);
      window.removeEventListener('expenseDataUpdated', handleExpenseUpdate);
    };
  }, [refreshData]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    grants,
    budgetItems,
    expenses,
    loading,
    error,
    refreshData,
    updateBudgetItem,
    updateExpense
  };
};