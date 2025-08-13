import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GrantReadinessScore } from '@/components/GrantReadinessScore';
import { UserAssignmentDisplay } from '@/components/UserAssignmentDisplay';
import { TeamAssignmentDropdown } from '@/components/TeamAssignmentDropdown';
import {
  Calendar,
  DollarSign,
  Building,
  ExternalLink,
  Trash2,
  Clock,
  Target,
  AlertCircle,
  FileText,
  Upload,
  CheckCircle,
  Link,
  Edit3,
  Save,
  X,
  Shield,
  Settings,
  DollarSign as Budget,
  Users,
  UserPlus,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  description?: string;
}

interface GrantDetailModalProps {
  grant: any;
  isOpen: boolean;
  onClose: () => void;
  onRemoveFromPipeline?: () => void;
}

const taskCategories = {
  narrative: {
    icon: FileText,
    label: 'Narrative/Documentation',
    keywords: ['narrative', 'report', 'documentation', 'quarterly', 'proposal', 'story']
  },
  budget: {
    icon: Budget,
    label: 'Budget/Financial',
    keywords: ['budget', 'financial', 'vendor', 'cost', 'expense', 'funding']
  },
  administrative: {
    icon: Shield,
    label: 'Administrative',
    keywords: ['approval', 'review', 'compliance', 'audit', 'legal', 'admin']
  },
  operational: {
    icon: Settings,
    label: 'Operational',
    keywords: ['outreach', 'community', 'equipment', 'inventory', 'implementation', 'training']
  }
};

export function GrantDetailModal({
  grant,
  isOpen,
  onClose,
  onRemoveFromPipeline,
}: GrantDetailModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressNotes, setProgressNotes] = useState(grant?.progress_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [readinessRefreshTrigger, setReadinessRefreshTrigger] = useState(0);

  // ESC key handler
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showAssignmentCard, setShowAssignmentCard] = useState(false);

  useEffect(() => {
    if (isOpen && grant?.grant_id) {
      fetchTasks();
      loadAssignments();
    }
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen, grant?.grant_id]);

  const fetchTasks = async () => {
    if (!grant?.grant_id) return;
    
    try {
      setLoadingTasks(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, priority, description')
        .eq('grant_id', grant.grant_id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const loadAssignments = async () => {
    if (!grant?.grant_id) return;
    
    try {
      const { data, error } = await supabase
        .from('grant_team_assignments')
        .select(`
          user_id,
          email,
          role,
          permissions
        `)
        .eq('grant_id', grant.grant_id);

      if (error) throw error;
      
      // Get additional user details from profiles
      const userIds = data?.map(assignment => assignment.user_id).filter(Boolean) || [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, role')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const users = data?.map(assignment => {
          const profile = profilesMap.get(assignment.user_id);
          return {
            id: assignment.user_id,
            email: assignment.email || profile?.email || 'Unknown',
            role: profile?.role || assignment.role
          };
        }) || [];
        
        setAssignedUsers(users);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .order('email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const assignUser = async (userId: string) => {
    if (!grant?.grant_id) return;
    
    try {
      const user = profiles.find(p => p.id === userId);
      if (!user) return;

      const { error } = await supabase
        .from('grant_team_assignments')
        .insert({
          grant_id: grant.grant_id,
          user_id: userId,
          email: user.email,
          role: 'member',
          permissions: ['view', 'edit']
        });

      if (error) throw error;

      toast({
        title: "User Assigned",
        description: `${user.email} has been assigned to this grant.`,
      });

      loadAssignments();
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user.",
        variant: "destructive",
      });
    }
  };

  const removeAssignment = async (userId: string) => {
    if (!grant?.grant_id) return;
    
    try {
      const { error } = await supabase
        .from('grant_team_assignments')
        .delete()
        .eq('grant_id', grant.grant_id)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Assignment Removed",
        description: "User has been removed from this grant.",
      });

      loadAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error", 
        description: "Failed to remove assignment.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFromPipeline = async () => {
    if (!grant) return;
    
    setLoading(true);
    try {
      // Remove from both tables
      await supabase
        .from('application_tracking')
        .delete()
        .eq('grant_id', grant.discovered_grant_id);

      await supabase
        .from('bookmarked_grants')
        .delete()
        .eq('discovered_grant_id', grant.discovered_grant_id);

      toast({
        title: "Removed from Pipeline",
        description: `"${grant.discovered_grant.title}" has been removed from your pipeline.`,
      });

      onRemoveFromPipeline?.();
      onClose();
    } catch (error) {
      console.error('Error removing from pipeline:', error);
      toast({
        title: "Error",
        description: "Failed to remove grant from pipeline.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!grant) return;
    
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('bookmarked_grants')
        .update({ 
          progress_notes: progressNotes.trim() || null 
        })
        .eq('id', grant.id);

      if (error) throw error;

      toast({
        title: "Progress Notes Saved",
        description: "Your progress notes have been successfully updated.",
      });

      setEditingProgress(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({
        title: "Error",
        description: "Failed to save progress notes.",
        variant: "destructive",
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCancelEdit = () => {
    setProgressNotes(grant?.progress_notes || '');
    setEditingProgress(false);
  };

  const handleOpenWorkspace = async () => {
    if (!grant || grant.application_stage !== 'awarded') return;
    
    setLoading(true);
    try {
      if (!grant.grant_id) {
        // Need to promote to workspace first
        const { data, error } = await supabase
          .rpc('promote_to_workspace', {
            p_bookmark_id: grant.id
          });

        if (error) throw error;
        
        toast({
          title: "Workspace Created",
          description: "Grant workspace has been created successfully.",
        });
        
        // Navigate to the new workspace
        navigate(`/grants/${data}`);
      } else {
        // Grant already has workspace, navigate directly
        navigate(`/grants/${grant.grant_id}`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error opening workspace:', error);
      toast({
        title: "Error",
        description: "Failed to open grant workspace.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const categorizeTask = (task: Task) => {
    const title = task.title.toLowerCase();
    for (const [key, category] of Object.entries(taskCategories)) {
      if (category.keywords.some(keyword => title.includes(keyword))) {
        return key as keyof typeof taskCategories;
      }
    }
    return 'operational'; // default
  };

  const getTasksByCategory = () => {
    const categorized: Record<string, Task[]> = {
      narrative: [],
      budget: [],
      administrative: [],
      operational: []
    };

    tasks.forEach(task => {
      const category = categorizeTask(task);
      categorized[category].push(task);
    });

    return categorized;
  };

  const updateTaskStatus = async (taskId: string, completed: boolean) => {
    try {
      const newStatus = completed ? 'completed' : 'pending';
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus as Task['status'] }
            : task
        )
      );

      // Trigger readiness score refresh
      setReadinessRefreshTrigger(prev => prev + 1);

      toast({
        title: "Task Updated",
        description: `Task marked as ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    }
  };

  if (!grant) return null;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'tracked': return 'bg-blue-100 text-blue-800';
      case 'development': return 'bg-orange-100 text-orange-800';
      case 'submission': return 'bg-indigo-100 text-indigo-800';
      case 'awarded': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubmissionMethod = () => {
    const agency = grant.discovered_grant.agency?.toLowerCase() || '';
    if (agency.includes('doj') || agency.includes('justice') || agency.includes('federal')) {
      return 'Grants.gov';
    }
    if (agency.includes('state') || agency.includes('county') || agency.includes('city')) {
      return 'State Portal';
    }
    return 'Direct Application';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {grant.discovered_grant.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grant URL - Prominent */}
          {grant.discovered_grant.external_url && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-center text-primary border-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => window.open(grant.discovered_grant.external_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Grant Details
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Header Actions */}
          <div className="flex items-center justify-end gap-2">
            {/* Open Workspace Button for Awarded Grants */}
            {grant.application_stage === 'awarded' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenWorkspace}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Open Workspace
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveFromPipeline}
              disabled={loading}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Pipeline
            </Button>
          </div>

          {/* Grant Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grant Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Agency</p>
                    <p className="font-medium">{grant.discovered_grant.agency}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Opportunity Number</p>
                    <p className="font-medium">{grant.discovered_grant.opportunity_id || grant.discovered_grant.opp_id || 'Not specified'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Deadline</p>
                    <p className="font-medium">{formatDate(grant.discovered_grant.deadline)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Funding Range</p>
                    <p className="font-medium">
                      {formatCurrency(grant.discovered_grant.funding_amount_min)} - {formatCurrency(grant.discovered_grant.funding_amount_max)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Upload className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Submission Method</p>
                    <p className="font-medium">{getSubmissionMethod()}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-slate-600">Synced Status</p>
                    <p className="font-medium text-green-600">Synced</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Status</p>
                    <Badge className={getStatusColor(grant.status)}>
                      {grant.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Date Added</p>
                    <p className="font-medium">{formatDate(grant.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-slate-600" />
                  <div>
                    <p className="text-sm text-slate-600">Internal Deadline</p>
                    <p className="font-medium">{formatDate(grant.internal_deadline)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Checklist & Readiness Score */}
          {grant?.grant_id && (
            <Card>
              <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Task Checklist</CardTitle>
                <GrantReadinessScore 
                  grantId={grant.grant_id} 
                  refreshTrigger={readinessRefreshTrigger}
                />
              </div>
              </CardHeader>
              <CardContent>
                {loadingTasks ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-slate-500">Loading tasks...</div>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-slate-500">No tasks created yet</div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(getTasksByCategory()).map(([categoryKey, categoryTasks]) => {
                      if (categoryTasks.length === 0) return null;
                      
                      const category = taskCategories[categoryKey as keyof typeof taskCategories];
                      const completedTasks = categoryTasks.filter(t => t.status === 'completed').length;
                      const totalTasks = categoryTasks.length;
                      const completion = Math.round((completedTasks / totalTasks) * 100);
                      
                      return (
                        <div key={categoryKey} className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                            <category.icon className="h-5 w-5 text-slate-600" />
                            <h4 className="font-medium text-slate-900">{category.label}</h4>
                            <Badge variant="outline" className="ml-auto">
                              {completedTasks}/{totalTasks} ({completion}%)
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            {categoryTasks.map((task) => (
                              <div key={task.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50">
                                <Checkbox
                                  checked={task.status === 'completed'}
                                  onCheckedChange={(checked) => updateTaskStatus(task.id, checked as boolean)}
                                  className="mt-0.5"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                    {task.title}
                                  </div>
                                  {task.description && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      {task.description}
                                    </div>
                                  )}
                                  {task.due_date && (
                                    <div className="flex items-center text-xs text-slate-500 mt-1">
                                      <Calendar className="h-3 w-3 mr-1" />
                                      Due: {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                                <Badge 
                                  variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {task.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes & Progress */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Progress Notes</CardTitle>
                {editingProgress ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEdit}
                      disabled={savingNotes}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingProgress(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit Notes
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div>
                {editingProgress ? (
                  <Textarea
                    value={progressNotes}
                    onChange={(e) => setProgressNotes(e.target.value)}
                    placeholder="Track your progress here..."
                    className="min-h-[120px]"
                  />
                ) : (
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-200 min-h-[80px]">
                    {progressNotes ? (
                      <p className="text-sm whitespace-pre-wrap">{progressNotes}</p>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No progress notes added yet</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Assignment Management */}
          {grant?.grant_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TeamAssignmentDropdown
                  grantId={grant.grant_id}
                  assignedUsers={assignedUsers}
                  onAssignmentChange={loadAssignments}
                  mode="multi"
                  size="lg"
                  className="w-full"
                />
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end items-center pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}