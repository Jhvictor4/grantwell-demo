import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentPreview } from '@/components/ui/DocumentPreview';

interface CloseoutItem {
  id: string;
  item: string;
  completed: boolean;
  file_url?: string;
  notes?: string;
}

interface GrantCloseoutChecklistProps {
  grantId: string;
  canEdit: boolean;
}

const REQUIRED_CLOSEOUT_ITEMS = [
  'Final Financial Report',
  'Final Programmatic Report', 
  'Inventory Report',
  'Confirmation of funds returned'
];

export function GrantCloseoutChecklist({ grantId, canEdit }: GrantCloseoutChecklistProps) {
  const [closeoutItems, setCloseoutItems] = useState<CloseoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCloseoutItems();
  }, [grantId]);

  const syncProgress = async (items: CloseoutItem[]) => {
    try {
      const total = items.length;
      const completed = items.filter(i => i.completed).length;
      const isComplete = total > 0 && completed === total;
      await supabase.rpc('update_grant_progress_section', {
        p_grant_id: grantId,
        p_section: 'closeout',
        p_complete: isComplete,
      });
    } catch (e) {
      console.error('Failed to sync closeout progress', e);
    }
  };

  const fetchCloseoutItems = async () => {
    try {
      const { data, error } = await supabase
        .from('grant_closeouts')
        .select('*')
        .eq('grant_id', grantId)
        .order('created_at');

      if (error) throw error;

      // Ensure all required items exist
      const existingItems = data || [];
      const missingItems = REQUIRED_CLOSEOUT_ITEMS.filter(
        item => !existingItems.some(existing => existing.item === item)
      );

      // Create missing items
      if (missingItems.length > 0) {
        const newItems = missingItems.map(item => ({
          grant_id: grantId,
          item,
          completed: false
        }));

        const { data: created, error: createError } = await supabase
          .from('grant_closeouts')
          .insert(newItems)
          .select();

        if (createError) throw createError;

        const all = [...existingItems, ...(created || [])];
        setCloseoutItems(all);
        await syncProgress(all);
      } else {
        setCloseoutItems(existingItems);
        await syncProgress(existingItems);
      }
    } catch (error) {
      console.error('Error fetching closeout items:', error);
      toast({
        title: "Error",
        description: "Failed to load closeout checklist",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const updateItem = async (itemId: string, updates: Partial<CloseoutItem>) => {
    try {
      const { error } = await supabase
        .from('grant_closeouts')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;

      const updated = closeoutItems.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      );
      setCloseoutItems(updated);
      await syncProgress(updated);

      toast({
        title: "Updated",
        description: "Closeout item updated successfully"
      });
    } catch (error) {
      console.error('Error updating closeout item:', error);
      toast({
        title: "Error",
        description: "Failed to update closeout item",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (itemId: string, file: File) => {
    if (!file) return;

    setUploading(itemId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `closeout-${grantId}-${itemId}-${Date.now()}.${fileExt}`;
      const filePath = `grant-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      await updateItem(itemId, { file_url: data.publicUrl });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Closeout Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = closeoutItems.filter(item => item.completed).length;
  const totalCount = closeoutItems.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Closeout Checklist</span>
          <span className="text-sm font-normal">
            {completedCount}/{totalCount} Complete
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {closeoutItems.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => 
                    canEdit && updateItem(item.id, { completed: checked as boolean })
                  }
                  disabled={!canEdit}
                />
                <span className={`font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {item.item}
                </span>
              </div>
              {item.completed && <CheckCircle className="h-4 w-4 text-green-600" />}
            </div>

            {item.file_url && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <DocumentPreview 
                  fileUrl={item.file_url}
                  fileName={`${item.item.toLowerCase().replace(/\s+/g, '-')}-closeout.pdf`}
                >
                  <Button variant="link" className="h-auto p-0 text-sm">
                    <FileText className="h-4 w-4 mr-1" />
                    View uploaded file
                  </Button>
                </DocumentPreview>
              </div>
            )}

            {canEdit && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    id={`file-${item.id}`}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(item.id, file);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById(`file-${item.id}`)?.click()}
                    disabled={uploading === item.id}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {uploading === item.id ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>

                <Textarea
                  placeholder="Add notes..."
                  value={item.notes || ''}
                  onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                  className="min-h-[60px] text-sm"
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}