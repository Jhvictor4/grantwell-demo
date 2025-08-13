import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Save, FileText } from 'lucide-react';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';
import { hasPermission, SystemRole, GrantRole } from '@/lib/permissions';

interface GrantWorkspaceNotesProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceNotes({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner = false 
}: GrantWorkspaceNotesProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = hasPermission('edit:notes', userRole, grantRole, isOwner);

  useEffect(() => {
    if (grantId) {
      loadNotes();
    }
  }, [grantId]);

  // Auto-save on change with debounce
  useEffect(() => {
    if (!loading && canEdit && notes !== '') {
      const saveTimeout = setTimeout(() => {
        saveNotes();
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [notes, loading, canEdit]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      
      // Load notes from bookmarked_grants table
      const { data: bookmarkData, error: bookmarkError } = await supabase
        .from('bookmarked_grants')
        .select('notes')
        .eq('grant_id', grantId)
        .maybeSingle();

      if (bookmarkError && bookmarkError.code !== 'PGRST116') {
        console.error('Error loading bookmark notes:', bookmarkError);
        return;
      }

      setNotes(bookmarkData?.notes || '');
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!canEdit || saving) return;

    try {
      setSaving(true);

      // Update notes in bookmarked_grants table
      const { error: bookmarkUpdateError } = await supabase
        .from('bookmarked_grants')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('grant_id', grantId);

      if (bookmarkUpdateError) {
        throw bookmarkUpdateError;
      }

      // Log activity
      await logGrantActivityWithDescription(
        grantId,
        'note_updated',
        'updated application notes',
        { notes_length: notes.length }
      );

      toast({
        title: 'Saved',
        description: 'Notes saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save notes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-muted rounded mb-4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Remove view restriction for notes - everyone should be able to view notes

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Application Notes</h2>
          <p className="text-muted-foreground">
            Track progress, ideas, and important information about this grant application.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-sm text-muted-foreground">Saving...</span>}
          <Button
            onClick={saveNotes}
            disabled={!canEdit || saving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Notes
          </Button>
        </div>
      </div>

      {/* Notes Editor */}
      <Card className="h-[320px]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Application Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={canEdit 
              ? "Add notes about this grant application, your progress, ideas, or any important information..." 
              : "No notes available"
            }
            readOnly={!canEdit}
            className="min-h-[220px] resize-none"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            {canEdit && "Auto-saves after 1 second of inactivity"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}