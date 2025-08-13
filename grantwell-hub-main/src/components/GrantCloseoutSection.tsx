import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  DollarSign, 
  CheckCircle,
  Upload,
  Download
} from 'lucide-react';
import { DocumentPreview } from '@/components/ui/DocumentPreview';

interface CloseoutLog {
  id: string;
  log_type: 'final_report' | 'fiscal_closeout' | 'final_submission';
  description: string;
  file_url?: string;
  completed: boolean;
  completed_by?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  grant_id?: string;
}

interface GrantCloseoutSectionProps {
  grantId: string;
  grantTitle: string;
}

export const GrantCloseoutSection: React.FC<GrantCloseoutSectionProps> = ({
  grantId,
  grantTitle
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [closeoutLogs, setCloseoutLogs] = useState<CloseoutLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCloseoutLogs();
    }
  }, [isOpen, grantId]);

  const loadCloseoutLogs = async () => {
    try {
      // Load closeout tasks instead of closeout logs
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, created_at, updated_at')
        .eq('grant_id', grantId)
        .eq('category', 'closeout')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading closeout tasks:', error);
        return;
      }

      // Convert tasks to closeout log format
      const convertedLogs = data?.map(task => ({
        id: task.id,
        log_type: 'final_report' as const, // Default type, could be enhanced based on task title
        description: task.description || task.title,
        file_url: undefined,
        completed: task.status === 'completed',
        completed_by: undefined,
        completed_at: task.status === 'completed' ? task.updated_at : undefined,
        created_at: task.created_at,
        updated_at: task.updated_at,
        grant_id: grantId
      })) || [];

      setCloseoutLogs(convertedLogs);

      // Create default tasks if none exist
      if (!data || data.length === 0) {
        await createDefaultTasks();
      }
    } catch (error) {
      console.error('Error loading closeout tasks:', error);
    }
  };

  const createDefaultTasks = async () => {
    if (!user) return;

    // This function is now handled by the database trigger
    // when a grant is marked as 'awarded', but we can call it manually if needed
    try {
      const { error } = await supabase.rpc('create_closeout_tasks_for_grant', {
        p_grant_id: grantId
      });

      if (error) {
        console.error('Error creating default closeout tasks:', error);
        return;
      }

      // Reload the tasks
      loadCloseoutLogs();
    } catch (error) {
      console.error('Error creating default closeout tasks:', error);
    }
  };

  const handleFileUpload = async (logId: string, logType: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(logId);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${grantId}_${logType}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      // Update the log with file URL
      const { error: updateError } = await supabase
        .from('closeout_logs')
        .update({ file_url: publicUrl })
        .eq('id', logId);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setCloseoutLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, file_url: publicUrl } : log
      ));

      toast({
        title: "File Uploaded",
        description: "Document has been uploaded successfully.",
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(null);
    }
  };

  const handleCheckboxChange = async (logId: string, completed: boolean) => {
    if (!user) return;

    try {
      // Update the task status instead of closeout_logs
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: completed ? 'completed' : 'pending'
        })
        .eq('id', logId);

      if (error) {
        throw error;
      }

      // Update local state
      setCloseoutLogs(prev => prev.map(log => 
        log.id === logId ? { 
          ...log, 
          completed,
          completed_at: completed ? new Date().toISOString() : undefined
        } : log
      ));

      toast({
        title: completed ? "Task Completed" : "Task Unchecked",
        description: `Closeout task has been ${completed ? 'marked as complete' : 'unchecked'}.`,
      });

    } catch (error) {
      console.error('Error updating completion status:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update completion status.",
        variant: "destructive"
      });
    }
  };

  const updateDescription = async (logId: string, description: string) => {
    try {
      // Update the task description instead of closeout_logs
      const { error } = await supabase
        .from('tasks')
        .update({ description })
        .eq('id', logId);

      if (error) {
        throw error;
      }

      // Update local state
      setCloseoutLogs(prev => prev.map(log => 
        log.id === logId ? { ...log, description } : log
      ));

    } catch (error) {
      console.error('Error updating description:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update description.",
        variant: "destructive"
      });
    }
  };

  const getLogIcon = (logType: string) => {
    switch (logType) {
      case 'final_report':
        return <FileText className="h-4 w-4" />;
      case 'fiscal_closeout':
        return <DollarSign className="h-4 w-4" />;
      case 'final_submission':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getLogTitle = (logType: string) => {
    switch (logType) {
      case 'final_report':
        return 'Final Report Upload';
      case 'fiscal_closeout':
        return 'Fiscal Closeout Log';
      case 'final_submission':
        return 'Final Submission Complete';
      default:
        return 'Closeout Task';
    }
  };

  const completedTasks = closeoutLogs.filter(log => log.completed).length;
  const totalTasks = closeoutLogs.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between mt-3 p-3 h-auto"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Grant Closeout Checklist</span>
            <span className="text-sm text-muted-foreground">
              ({completedTasks}/{totalTasks} completed)
            </span>
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3">
        <Card>
          <CardContent className="p-4 space-y-4">
            {closeoutLogs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getLogIcon(log.log_type)}
                    <span className="font-medium">{getLogTitle(log.log_type)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={log.completed}
                      onCheckedChange={(checked) => 
                        handleCheckboxChange(log.id, checked as boolean)
                      }
                    />
                    <Label className="text-sm">Complete</Label>
                  </div>
                </div>

                <Textarea
                  value={log.description}
                  onChange={(e) => {
                    // Update local state immediately for better UX
                    setCloseoutLogs(prev => prev.map(l => 
                      l.id === log.id ? { ...l, description: e.target.value } : l
                    ));
                  }}
                  onBlur={(e) => updateDescription(log.id, e.target.value)}
                  placeholder="Add notes or description..."
                  className="min-h-[60px]"
                />

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor={`file-${log.id}`} className="text-sm font-medium">
                      Upload Document
                    </Label>
                    <Input
                      id={`file-${log.id}`}
                      type="file"
                      onChange={(e) => handleFileUpload(log.id, log.log_type, e)}
                      disabled={uploading === log.id}
                      className="mt-1"
                      accept=".pdf,.doc,.docx,.xlsx,.xls"
                    />
                  </div>
                  {log.file_url && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => window.open(log.file_url, '_blank')}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Document
                      </Button>
                    </div>
                  )}
                </div>

                {uploading === log.id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="h-4 w-4 animate-pulse" />
                    Uploading...
                  </div>
                )}

                {log.completed && log.completed_at && (
                  <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                    ✓ Completed on {new Date(log.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}

            {totalTasks > 0 && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress: {completedTasks} of {totalTasks} tasks completed</span>
                  <span className="font-medium">
                    {Math.round((completedTasks / totalTasks) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};