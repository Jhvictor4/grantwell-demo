import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X } from 'lucide-react';

interface ChecklistItem {
  id: string;
  item_name: string;
  is_complete: boolean;
  order_index: number;
  is_custom: boolean;
}

interface GrantChecklistDisplayProps {
  grantId: string;
  isCompact?: boolean;
  maxDisplayItems?: number;
}

export function GrantChecklistDisplay({ grantId, isCompact = false, maxDisplayItems = 3 }: GrantChecklistDisplayProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadChecklistItems();
  }, [grantId]);

  const loadChecklistItems = async () => {
    try {
      const { data, error } = await supabase
        .from('compliance_checklist')
        .select('*')
        .eq('grant_id', grantId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading checklist items:', error);
    }
  };

  const toggleItem = async (itemId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('compliance_checklist')
        .update({ is_complete: completed })
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, is_complete: completed } : item
      ));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update checklist item.",
        variant: "destructive"
      });
    }
  };

  const addItem = async () => {
    if (!newItemText.trim()) return;

    setIsLoading(true);
    try {
      const maxOrder = Math.max(...items.map(item => item.order_index), -1);
      const { data, error } = await supabase
        .from('compliance_checklist')
        .insert({
          grant_id: grantId,
          item_name: newItemText.trim(),
          is_custom: true,
          order_index: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      setItems(prev => [...prev, data]);
      setNewItemText('');
      setShowAddInput(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add checklist item.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('compliance_checklist')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove checklist item.",
        variant: "destructive"
      });
    }
  };

  const completedCount = items.filter(item => item.is_complete).length;
  const totalCount = items.length;
  const displayItems = isCompact ? items.slice(0, maxDisplayItems) : items;
  const hasMoreItems = isCompact && items.length > maxDisplayItems;

  if (items.length === 0 && isCompact) return null;

  return (
    <div className="space-y-2">
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
          {totalCount > 0 && (
            <div className="w-24 bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        {displayItems.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <Checkbox
              checked={item.is_complete}
              onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
              className="flex-shrink-0"
            />
            <span 
              className={`text-sm flex-1 ${
                item.is_complete ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {item.item_name}
            </span>
            {!isCompact && item.is_custom && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

        {hasMoreItems && (
          <div className="text-xs text-muted-foreground">
            +{items.length - maxDisplayItems} more items
          </div>
        )}
      </div>

      {!isCompact && (
        <div className="pt-2">
          {showAddInput ? (
            <div className="flex gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Add custom checklist item..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addItem();
                  if (e.key === 'Escape') {
                    setShowAddInput(false);
                    setNewItemText('');
                  }
                }}
                className="text-sm"
                autoFocus
              />
              <Button size="sm" onClick={addItem} disabled={isLoading}>
                Add
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setShowAddInput(false);
                  setNewItemText('');
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddInput(true)}
              className="text-muted-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add custom item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}