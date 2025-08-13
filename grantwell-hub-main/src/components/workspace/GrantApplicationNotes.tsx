
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';
import { Save } from 'lucide-react';

interface GrantApplicationNotesProps {
  grantId: string;
}

export function GrantApplicationNotes({ grantId }: GrantApplicationNotesProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (grantId) {
      loadNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grant_notes')
        .select('*')
        .eq('grant_id', grantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notes:', error);
        return;
      }

      if (data) {
        setNoteId(data.id);
        setContent(data.content || '');
        setLastSaved(new Date(data.updated_at));
      } else {
        setNoteId(null);
        setContent('');
        setLastSaved(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;

      if (!userId) {
        toast({
          title: 'Not signed in',
          description: 'Please sign in to save notes.',
          variant: 'destructive',
        });
        return;
      }

      if (noteId) {
        const { error } = await supabase
          .from('grant_notes')
          .update({
            content,
          })
          .eq('id', noteId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('grant_notes')
          .insert({
            grant_id: grantId,
            content,
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;
        setNoteId(data.id);
      }

      setLastSaved(new Date());
      await logGrantActivityWithDescription(
        grantId,
        'notes_saved',
        'updated application notes',
        { length: content.length }
      );

      toast({
        title: 'Notes saved',
        description: 'Application notes have been saved.',
      });
    } catch (err) {
      console.error('Error saving notes:', err);
      toast({
        title: 'Save failed',
        description: 'Could not save notes. You might not have permission to edit this note.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Application Notes</CardTitle>
        {lastSaved && (
          <Badge variant="secondary" className="text-xs">
            Last saved: {lastSaved.toLocaleTimeString()}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-40 bg-muted rounded animate-pulse" />
        ) : (
          <div className="space-y-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add context, reminders, or coordination notes for this grant..."
              className="min-h-[160px] resize-y"
            />
            <div className="flex justify-end">
              <Button onClick={saveNotes} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GrantApplicationNotes;
