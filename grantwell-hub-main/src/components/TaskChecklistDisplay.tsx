import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, CheckCircle } from 'lucide-react';
import { useConfetti } from '@/hooks/useConfetti';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface ChecklistItem {
  id: string;
  item_text: string;
  is_completed: boolean;
  order_index: number;
}

interface TaskChecklistDisplayProps {
  taskId: string;
  isCompact?: boolean;
  maxDisplayItems?: number;
}

export function TaskChecklistDisplay({ taskId, isCompact = false, maxDisplayItems = 3 }: TaskChecklistDisplayProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [previousCompletedCount, setPreviousCompletedCount] = useState(0);
  const { toast } = useToast();
  const { celebrateTaskCompletion } = useConfetti();
  const { sounds } = useSoundEffects();

  useEffect(() => {
    loadChecklistItems();
  }, [taskId]);

  const loadChecklistItems = async () => {
    try {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .select('*')
        .eq('task_id', taskId)
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
        .from('task_checklist_items')
        .update({ is_completed: completed })
        .eq('id', itemId);

      if (error) throw error;

      const updatedItems = items.map(item => 
        item.id === itemId ? { ...item, is_completed: completed } : item
      );
      
      setItems(updatedItems);

      // Check if all items are now completed and trigger celebration
      const newCompletedCount = updatedItems.filter(item => item.is_completed).length;
      const wasJustCompleted = newCompletedCount === updatedItems.length && 
                               newCompletedCount > previousCompletedCount &&
                               updatedItems.length > 0;

      if (wasJustCompleted) {
        // Find the task card element for confetti origin
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
        celebrateTaskCompletion(taskCard);
        sounds.taskComplete();
      }

      setPreviousCompletedCount(newCompletedCount);
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
        .from('task_checklist_items')
        .insert({
          task_id: taskId,
          item_text: newItemText.trim(),
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
        .from('task_checklist_items')
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

  const completedCount = items.filter(item => item.is_completed).length;
  const totalCount = items.length;
  const incompleteItems = items.filter(item => !item.is_completed);
  const allComplete = totalCount > 0 && completedCount === totalCount;
  
  // In compact mode, show only incomplete items (up to maxDisplayItems)
  const displayItems = isCompact 
    ? incompleteItems.slice(0, maxDisplayItems)
    : items;
  
  const hasMoreItems = isCompact && incompleteItems.length > maxDisplayItems;

  if (items.length === 0 && isCompact) return null;

  return (
    <div className="space-y-2">
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          {allComplete ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">
                All tasks complete
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {completedCount}/{totalCount} completed
            </span>
          )}
          {totalCount > 0 && (
            <div className={`w-16 bg-secondary h-1.5 rounded-full overflow-hidden ${allComplete ? 'ring-2 ring-green-200' : ''}`}>
              <div 
                className={`h-full transition-all duration-300 ${allComplete ? 'bg-green-500' : 'bg-primary'}`}
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
              checked={item.is_completed}
              onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
              className="flex-shrink-0"
            />
            <span 
              className={`text-sm flex-1 ${
                item.is_completed ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {item.item_text}
            </span>
            {!isCompact && (
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
            +{incompleteItems.length - maxDisplayItems} more items
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
                placeholder="Add checklist item..."
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
              Add item
            </Button>
          )}
        </div>
      )}
    </div>
  );
}