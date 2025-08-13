// [Grantwell Fix 2025-08-09]: Replace window.prompt with proper modal form

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fmtCurrency, toNumber } from '@/lib/formatters';

interface EditAmountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budgeted: number, actual: number, notes?: string) => Promise<void>;
  currentBudgeted: number;
  currentActual: number;
  grantName: string;
  category: string;
  maxBudgetAmount?: number; // Grant award amount for validation
}

export function EditAmountModal({
  isOpen,
  onClose,
  onSave,
  currentBudgeted,
  currentActual,
  grantName,
  category,
  maxBudgetAmount
}: EditAmountModalProps) {
  const [budgeted, setBudgeted] = useState('');
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ budgeted?: string; actual?: string }>({});

  useEffect(() => {
    if (isOpen) {
      // Format as currency without currency symbol, ensuring proper display
      setBudgeted(currentBudgeted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setActual(currentActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setNotes('');
      setErrors({});
    }
  }, [isOpen, currentBudgeted, currentActual]);

  const validateInput = (value: string, fieldName: string, maxValue?: number): string | undefined => {
    const numericValue = toNumber(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return `${fieldName} must be a non-negative number`;
    }
    if (numericValue > 999999999.99) {
      return `${fieldName} is too large`;
    }
    if (maxValue && numericValue > maxValue) {
      return `${fieldName} cannot exceed award amount of ${maxValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
    }
    return undefined;
  };

  const handleBudgetedChange = (value: string) => {
    setBudgeted(value);
    const error = validateInput(value, 'Budgeted amount', maxBudgetAmount);
    setErrors(prev => ({ ...prev, budgeted: error }));
  };

  const handleActualChange = (value: string) => {
    setActual(value);
    const error = validateInput(value, 'Actual amount', maxBudgetAmount);
    setErrors(prev => ({ ...prev, actual: error }));
  };

  const handleSave = async () => {
    const budgetedError = validateInput(budgeted, 'Budgeted amount', maxBudgetAmount);
    const actualError = validateInput(actual, 'Actual amount', maxBudgetAmount);
    
    setErrors({ budgeted: budgetedError, actual: actualError });
    
    if (budgetedError || actualError) return;

    setLoading(true);
    try {
      await onSave(toNumber(budgeted), toNumber(actual), notes.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !errors.budgeted && !errors.actual) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Edit Amounts</DialogTitle>
          <DialogDescription>
            Update budgeted and actual amounts for {grantName} - {category}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="budgeted">Budgeted ($)</Label>
            <Input
              id="budgeted"
              value={budgeted}
              onChange={(e) => handleBudgetedChange(e.target.value)}
              placeholder="12,345.67"
              className={errors.budgeted ? "border-red-500" : ""}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter amount in USD format (e.g., 12,345.67)
              {maxBudgetAmount && ` • Max: ${maxBudgetAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`}
            </p>
            {errors.budgeted && (
              <p className="text-sm text-red-500 mt-1">{errors.budgeted}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="actual">Actual ($)</Label>
            <Input
              id="actual"
              value={actual}
              onChange={(e) => handleActualChange(e.target.value)}
              placeholder="8,765.43"
              className={errors.actual ? "border-red-500" : ""}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter actual spent amount in USD format
            </p>
            {errors.actual && (
              <p className="text-sm text-red-500 mt-1">{errors.actual}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these changes..."
              rows={2}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !!errors.budgeted || !!errors.actual}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}