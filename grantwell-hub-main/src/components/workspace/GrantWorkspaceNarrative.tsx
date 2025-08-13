
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Save, Eye, Plus, History } from 'lucide-react';
import { hasPermission, SystemRole, GrantRole } from '@/lib/permissions';
import { NarrativeAssistant } from '@/components/NarrativeAssistant';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';

interface GrantWorkspaceNarrativeProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceNarrative({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner = false 
}: GrantWorkspaceNarrativeProps) {
  const { toast } = useToast();
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAssistant, setShowAssistant] = useState(false);

  const canEdit = hasPermission('edit:narrative', userRole, grantRole, isOwner);

  useEffect(() => {
    if (grantId) {
      loadNarrative();
    }
  }, [grantId]);

  const loadNarrative = async () => {
    try {
      setLoading(true);
      // For now, using a simple approach. In a real app, you'd have a dedicated narratives table
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('ai_response, updated_at')
        .eq('grant_id', grantId)
        .eq('prompt_type', 'narrative')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading narrative:', error);
        return;
      }

      if (data) {
        setNarrative(data.ai_response || '');
        setLastSaved(new Date(data.updated_at));
      } else {
        setNarrative('');
      }
    } catch (error) {
      console.error('Error loading narrative:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveNarrative = async () => {
    if (!canEdit) return;

    try {
      setSaving(true);
      
      // Save to ai_conversations table for now
      const { error } = await supabase
        .from('ai_conversations')
        .upsert({
          grant_id: grantId,
          prompt_type: 'narrative',
          ai_response: narrative,
          status: 'completed',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'grant_id,prompt_type'
        });

      if (error) {
        throw error;
      }

      setLastSaved(new Date());
      await logGrantActivityWithDescription(
        grantId,
        'narrative_saved',
        'saved project narrative',
        { section: 'narrative' }
      );
      toast({
        title: "Narrative Saved",
        description: "Your narrative has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving narrative:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save narrative. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasPermission('view:narrative', userRole, grantRole, isOwner)) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You do not have permission to view the narrative section.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Project Narrative</h2>
          <p className="text-muted-foreground">
            Develop and manage your grant project narrative and documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <Badge variant="secondary" className="text-xs">
              Last saved: {lastSaved.toLocaleTimeString()}
            </Badge>
          )}
          {canEdit && (
            <Button onClick={saveNarrative} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Single AI Assistant Action */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setShowAssistant(true)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">Open AI Narrative Assistant</h3>
                <p className="text-sm text-muted-foreground">Get help writing and structuring your narrative</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Narrative Assistant Dialog - responsive sizing */}
      <Dialog open={showAssistant} onOpenChange={setShowAssistant}>
        <DialogContent className="max-w-7xl w-[96vw] md:w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Narrative Assistant</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <NarrativeAssistant grantId={grantId} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Narrative Editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder={canEdit ? "Begin writing your project narrative here..." : "No narrative content available."}
              className="min-h[400px] md:min-h-[400px] resize-none"
              disabled={!canEdit}
            />
            
            {narrative && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{narrative.length} characters</span>
                <span>
                  {Math.ceil(narrative.split(' ').length / 250)} pages (approx.)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
