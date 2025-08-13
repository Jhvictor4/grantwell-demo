import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, 
  FileCheck, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Calendar,
  Shield,
  Lock,
  Send,
  Download,
  FolderOpen
} from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';
import { hasPermission, SystemRole, GrantRole } from '@/lib/permissions';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';

interface CloseoutTask {
  id: string;
  task_name: string;
  task_type: string;
  assigned_user: string | null;
  status: 'pending' | 'in_progress' | 'submitted' | 'accepted' | 'rejected';
  due_date: string | null;
  completed_at: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CloseoutStatus {
  id: string;
  overall_status: 'not_started' | 'in_progress' | 'submitted' | 'accepted' | 'closed';
  completion_percentage: number;
  internal_deadline: string | null;
  assigned_compliance_officer: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  is_locked: boolean;
}

interface GrantWorkspaceCloseoutProps {
  grantId: string;
  userRole: SystemRole;
  grantRole?: GrantRole;
  isOwner?: boolean;
}

export function GrantWorkspaceCloseout({ 
  grantId, 
  userRole, 
  grantRole, 
  isOwner = false 
}: GrantWorkspaceCloseoutProps) {
  const { toast } = useToast();
  const [closeoutTasks, setCloseoutTasks] = useState<CloseoutTask[]>([]);
  const [closeoutStatus, setCloseoutStatus] = useState<CloseoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canEdit = hasPermission('edit:compliance', userRole, grantRole, isOwner) && !closeoutStatus?.is_locked;
  const canSubmit = (userRole === 'admin' || userRole === 'manager' || grantRole === 'coordinator') && !closeoutStatus?.is_locked;

  useEffect(() => {
    if (grantId) {
      initializeCloseout();
    }
  }, [grantId]);

  const initializeCloseout = async () => {
    try {
      setLoading(true);
      
      // Initialize closeout tasks and status
      const { error: initError } = await supabase.rpc('initialize_closeout_tasks', {
        p_grant_id: grantId
      });

      if (initError) {
        console.error('Error initializing closeout:', initError);
      }

      await Promise.all([
        loadCloseoutTasks(),
        loadCloseoutStatus()
      ]);
    } catch (error) {
      console.error('Error initializing closeout:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCloseoutTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('grant_closeout_tasks')
        .select('*')
        .eq('grant_id', grantId)
        .order('created_at');

      if (error) throw error;
      setCloseoutTasks((data || []) as CloseoutTask[]);
    } catch (error) {
      console.error('Error loading closeout tasks:', error);
    }
  };

  const loadCloseoutStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('grant_closeout_status')
        .select('*')
        .eq('grant_id', grantId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setCloseoutStatus(data as CloseoutStatus);
    } catch (error) {
      console.error('Error loading closeout status:', error);
    }
  };

  const syncCloseoutProgress = async (tasks: CloseoutTask[]) => {
    try {
      await supabase.rpc('calculate_closeout_completion', { p_grant_id: grantId });
      const allComplete = tasks.length > 0 && tasks.every(t => t.status === 'submitted' || t.status === 'accepted');
      await supabase.rpc('update_grant_progress_section', {
        p_grant_id: grantId,
        p_section: 'closeout',
        p_complete: allComplete,
      });
    } catch (e) {
      console.error('Failed to sync closeout progress', e);
    }
  };

  const updateTaskStatus = async (taskId: string, status: CloseoutTask['status']) => {
    if (!canEdit) return;

    try {
      const updates: any = { 
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'submitted' || status === 'accepted') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('grant_closeout_tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      const task = closeoutTasks.find(t => t.id === taskId);
      await logGrantActivityWithDescription(
        grantId,
        'closeout_updated',
        `marked closeout task "${task?.task_name}" as ${status}`,
        { task_name: task?.task_name, status }
      );

      const nextTasks = closeoutTasks.map(task => 
        task.id === taskId 
          ? { ...task, ...updates }
          : task
      );
      setCloseoutTasks(nextTasks);
      await syncCloseoutProgress(nextTasks);
      await loadCloseoutStatus();

      toast({
        title: 'Updated',
        description: `Task marked as ${status}`,
      });

    } catch (error: any) {
      console.error('Error updating task status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    }
  };

  const updateTaskNotes = async (taskId: string, notes: string) => {
    if (!canEdit) return;

    try {
      const { error } = await supabase
        .from('grant_closeout_tasks')
        .update({ 
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      setCloseoutTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, notes }
            : task
        )
      );

    } catch (error: any) {
      console.error('Error updating task notes:', error);
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    if (!canEdit) return;

    try {
      setUploading(taskId);
      
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `closeout/${grantId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('grant_closeout_tasks')
        .update({ 
          file_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      const task = closeoutTasks.find(t => t.id === taskId);
      await logGrantActivityWithDescription(
        grantId,
        'file_uploaded',
        `uploaded closeout document for "${task?.task_name}"`,
        { task_name: task?.task_name, file_name: file.name }
      );

      setCloseoutTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, file_url: urlData.publicUrl }
            : task
        )
      );

      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const submitCloseout = async () => {
    if (!canSubmit) return;

    const incompleteTasks = closeoutTasks.filter(task => 
      task.status !== 'submitted' && task.status !== 'accepted'
    );

    if (incompleteTasks.length > 0) {
      toast({
        title: 'Cannot Submit',
        description: `${incompleteTasks.length} task(s) are not complete. Please complete all tasks before submitting.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('grant_closeout_status')
        .update({
          overall_status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: (await supabase.auth.getUser()).data.user?.id,
          is_locked: true,
          updated_at: new Date().toISOString()
        })
        .eq('grant_id', grantId);

      if (error) throw error;

      await logGrantActivityWithDescription(
        grantId,
        'closeout_submitted',
        'submitted grant closeout for final review',
        { submitted_at: new Date().toISOString() }
      );

      setCloseoutStatus(prev => prev ? {
        ...prev,
        overall_status: 'submitted',
        submitted_at: new Date().toISOString(),
        is_locked: true
      } : null);

      await supabase.rpc('update_grant_progress_section', {
        p_grant_id: grantId,
        p_section: 'closeout',
        p_complete: true,
      });

      toast({
        title: 'Closeout Submitted',
        description: 'Grant closeout has been submitted and locked for review.',
      });

    } catch (error: any) {
      console.error('Error submitting closeout:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit closeout',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: CloseoutTask['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'submitted':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Submitted</Badge>;
      case 'accepted':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'financial_report':
        return <BarChart3 className="h-4 w-4 text-green-600" />;
      case 'programmatic_report':
        return <FileCheck className="h-4 w-4 text-blue-600" />;
      case 'inventory_report':
        return <FolderOpen className="h-4 w-4 text-purple-600" />;
      case 'subrecipient_docs':
        return <User className="h-4 w-4 text-orange-600" />;
      case 'records_retention':
        return <Shield className="h-4 w-4 text-red-600" />;
      case 'contact_info':
        return <User className="h-4 w-4 text-indigo-600" />;
      case 'final_verification':
        return <CheckCircle className="h-4 w-4 text-teal-600" />;
      default:
        return <FileCheck className="h-4 w-4 text-gray-600" />;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Grant Closeout</h2>
          <p className="text-muted-foreground">
            Complete DOJ-required closeout tasks for this awarded grant.
          </p>
        </div>
        {closeoutStatus?.is_locked && (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Closeout Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Closeout Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{closeoutStatus?.completion_percentage || 0}% Complete</span>
                </div>
                <Progress value={closeoutStatus?.completion_percentage || 0} className="h-2" />
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {closeoutTasks.filter(t => t.status === 'submitted' || t.status === 'accepted').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Tasks Complete</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {closeoutTasks.filter(t => t.status === 'pending').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Tasks Remaining</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DOJ Closeout Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                DOJ Closeout Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {closeoutTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTaskIcon(task.task_type)}
                        <h4 className="font-medium">{task.task_name}</h4>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>

                    {task.due_date && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    )}

                    {canEdit && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={task.status === 'in_progress' ? 'default' : 'outline'}
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            disabled={task.status === 'submitted' || task.status === 'accepted'}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            In Progress
                          </Button>
                          <Button
                            size="sm"
                            variant={task.status === 'submitted' ? 'default' : 'outline'}
                            onClick={() => updateTaskStatus(task.id, 'submitted')}
                            disabled={task.status === 'accepted'}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Submit
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            id={`file-${task.id}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(task.id, file);
                            }}
                            disabled={uploading === task.id}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById(`file-${task.id}`)?.click()}
                            disabled={uploading === task.id}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            {uploading === task.id ? 'Uploading...' : 'Upload Document'}
                          </Button>
                          
                          {task.file_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(task.file_url!, '_blank')}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              View File
                            </Button>
                          )}
                        </div>

                        <Textarea
                          placeholder="Add notes for this task..."
                          value={task.notes || ''}
                          onChange={(e) => updateTaskNotes(task.id, e.target.value)}
                          className="min-h-[60px] text-sm"
                        />
                      </div>
                    )}

                    {!canEdit && task.notes && (
                      <div className="p-3 bg-muted rounded-md">
                        <Label className="text-sm font-medium">Notes:</Label>
                        <p className="text-sm text-muted-foreground mt-1">{task.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Closeout Summary Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Closeout Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Status</Label>
                <div className="mt-1">
                  {closeoutStatus?.overall_status === 'submitted' ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">Submitted</Badge>
                  ) : closeoutStatus?.overall_status === 'accepted' ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">Accepted</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">In Progress</Badge>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm">Completion</Label>
                <div className="mt-1 text-2xl font-bold">
                  {closeoutStatus?.completion_percentage || 0}%
                </div>
              </div>

              {closeoutStatus?.internal_deadline && (
                <div>
                  <Label className="text-sm">Internal Deadline</Label>
                  <div className="mt-1 text-sm">
                    {new Date(closeoutStatus.internal_deadline).toLocaleDateString()}
                  </div>
                </div>
              )}

              {closeoutStatus?.submitted_at && (
                <div>
                  <Label className="text-sm">Submitted</Label>
                  <div className="mt-1 text-sm">
                    {new Date(closeoutStatus.submitted_at).toLocaleDateString()}
                  </div>
                </div>
              )}

              {canSubmit && closeoutStatus?.overall_status !== 'submitted' && (
                <Button 
                  onClick={submitCloseout}
                  disabled={submitting || closeoutTasks.some(t => t.status === 'pending')}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Closeout'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <ActivityFeed grantId={grantId} />
        </div>
      </div>
    </div>
  );
}