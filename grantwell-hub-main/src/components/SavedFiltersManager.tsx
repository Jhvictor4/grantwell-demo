import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Save, Filter, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FilterState {
  searchTerm: string;
  selectedAgency: string;
  selectedSector: string;
  selectedCategory: string;
  minAmount: string;
  maxAmount: string;
  deadlineStart: string;
  deadlineEnd: string;
}

interface SavedView {
  id: string;
  view_name: string;
  filter_data: any;
  is_default: boolean;
  created_at: string;
}

interface SavedFiltersManagerProps {
  currentFilters: FilterState;
  onLoadFilters: (filters: FilterState) => void;
}

export function SavedFiltersManager({ currentFilters, onLoadFilters }: SavedFiltersManagerProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSavedViews();
  }, []);

  const fetchSavedViews = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('saved_filter_views')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedViews(data || []);
    } catch (error) {
      console.error('Error fetching saved views:', error);
      toast({
        title: "Error",
        description: "Failed to load saved views",
        variant: "destructive"
      });
    }
  };

  const saveCurrentView = async () => {
    if (!viewName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the view",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('saved_filter_views')
        .insert({
          user_id: user.user.id,
          view_name: viewName,
          filter_data: currentFilters as any
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Filter view saved successfully"
      });

      setViewName('');
      setIsDialogOpen(false);
      fetchSavedViews();
    } catch (error) {
      console.error('Error saving view:', error);
      toast({
        title: "Error",
        description: "Failed to save filter view",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadView = (view: SavedView) => {
    onLoadFilters(view.filter_data);
    toast({
      title: "Success",
      description: `Loaded "${view.view_name}" filter view`
    });
  };

  const deleteView = async (viewId: string) => {
    try {
      const { error } = await supabase
        .from('saved_filter_views')
        .delete()
        .eq('id', viewId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Filter view deleted"
      });

      fetchSavedViews();
    } catch (error) {
      console.error('Error deleting view:', error);
      toast({
        title: "Error",
        description: "Failed to delete filter view",
        variant: "destructive"
      });
    }
  };

  const hasActiveFilters = () => {
    return Object.values(currentFilters).some(value => value && value.trim() !== '');
  };

  return (
    <div className="flex gap-2">
      {/* Save View Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={!hasActiveFilters()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save View
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="viewName">View Name</Label>
              <Input
                id="viewName"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Enter a name for this filter view"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={saveCurrentView} 
                disabled={loading || !viewName.trim()}
              >
                Save View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved Views Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Saved Views
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {savedViews.length === 0 ? (
            <DropdownMenuItem disabled>
              No saved views
            </DropdownMenuItem>
          ) : (
            savedViews.map((view) => (
              <div key={view.id} className="flex items-center justify-between px-2 py-1">
                <DropdownMenuItem 
                  onClick={() => loadView(view)}
                  className="flex-1 cursor-pointer"
                >
                  {view.view_name}
                </DropdownMenuItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteView(view.id);
                  }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
          {savedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {savedViews.length} saved view{savedViews.length !== 1 ? 's' : ''}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}