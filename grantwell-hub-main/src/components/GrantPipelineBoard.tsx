import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Calendar, DollarSign, Clock, Users, Target, Send, Award, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { GrantDetailModal } from '@/components/GrantDetailModal';
import { GrantCardWithTasks } from '@/components/GrantCardWithTasks';
import { GrantReadinessScore } from '@/components/GrantReadinessScore';
import { logger } from '@/lib/logger';

interface GrantApplication {
  id: string;
  discovered_grant_id: string;
  grant_id?: string | null;
  user_id: string;
  status: string;
  notes: string | null;
  internal_deadline: string | null;
  application_stage: string;
  progress_notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  discovered_grant: {
    title: string;
    agency: string;
    deadline: string | null;
    funding_amount_min: number | null;
    funding_amount_max: number | null;
    sector: string | null;
  };
}

const pipelineStages = [
  { 
    id: 'preparation', 
    title: 'Preparation', 
    description: 'Planning & documentation',
    color: 'bg-yellow-100 border-yellow-200',
    icon: Clock
  },
  { 
    id: 'in_progress', 
    title: 'In Progress', 
    description: 'Writing & development',
    color: 'bg-orange-100 border-orange-200',
    icon: Clock
  },
  { 
    id: 'submission', 
    title: 'Submission', 
    description: 'Ready for submission',
    color: 'bg-indigo-100 border-indigo-200',
    icon: Send
  },
  { 
    id: 'awarded', 
    title: 'Awarded', 
    description: 'Grant received',
    color: 'bg-green-100 border-green-200',
    icon: Award
  },
  { 
    id: 'rejected', 
    title: 'Rejected', 
    description: 'Application declined',
    color: 'bg-red-100 border-red-200',
    icon: X
  }
];

interface GrantPipelineBoardProps {
  roleFilters?: {
    viewMode: 'my-grants' | 'all-grants';
    roleFilter: string;
  };
}

export function GrantPipelineBoard({ roleFilters }: GrantPipelineBoardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrant, setSelectedGrant] = useState<GrantApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userGrantRoles, setUserGrantRoles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApplications();
    if (user) {
      fetchUserGrantAssignments();
    }
  }, [user]);

  // Refresh when role filters change
  useEffect(() => {
    if (user && roleFilters) {
      fetchUserGrantAssignments();
    }
  }, [roleFilters, user]);

  // Close modal on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  const fetchUserGrantAssignments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_user_grant_assignments');

      if (error) {
        console.error('Error fetching user grant assignments:', error);
        return;
      }

      // Create a mapping of grant_id -> user_role for easy lookup
      const roleMapping: Record<string, string> = {};
      (data || []).forEach((assignment: any) => {
        if (assignment.grant_id) {
          roleMapping[assignment.grant_id] = assignment.user_role;
        }
      });
      
      setUserGrantRoles(roleMapping);
      console.log('User grant roles loaded:', roleMapping);
    } catch (error) {
      console.error('Error fetching user grant assignments:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('bookmarked_grants')
        .select(`
          *,
          discovered_grant:discovered_grants(
            title,
            agency,
            deadline,
            funding_amount_min,
            funding_amount_max,
            sector
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);
    } catch (error) {
      logger.error('Error fetching applications', error);
      toast({
        title: "Error",
        description: "Failed to load grant applications.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStage = async (applicationId: string, newStage: string) => {
    const originalApplications = [...applications];
    
    // Optimistically update UI first
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId
          ? { ...app, application_stage: newStage, status: newStage }
          : app
      )
    );

    try {
      // Update bookmarked_grants table first
      const { error: bookmarkError } = await supabase
        .from('bookmarked_grants')
        .update({ 
          application_stage: newStage,
          status: newStage,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (bookmarkError) throw bookmarkError;

      // Find the corresponding application_tracking record
      const application = applications.find(app => app.id === applicationId);
      if (application) {
        // Update application_tracking table using grant_id and user_id
        const { error: trackingError } = await supabase
          .from('application_tracking')
          .update({ 
            status: newStage
          })
          .eq('grant_id', application.discovered_grant_id)
          .eq('user_id', application.user_id);

        if (trackingError) {
          logger.warn('Failed to update application_tracking, but bookmarked_grants updated successfully', trackingError);
        }
      }

      toast({
        title: "Status Updated",
        description: `Grant moved to ${pipelineStages.find(s => s.id === newStage)?.title || newStage} stage.`,
      });
    } catch (error) {
      logger.error('Error updating application stage', error);
      
      // Rollback optimistic UI update
      setApplications(originalApplications);
      
      toast({
        title: "Error",
        description: "Failed to update grant status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStage = destination.droppableId;

    updateApplicationStage(draggableId, newStage);
  };

  const getApplicationsByStage = (stageId: string) => {
    const stageApps = applications.filter(app => app.application_stage === stageId);
    
    // Apply role-based filtering
    if (!roleFilters) return stageApps;
    
    console.log('Filtering apps for stage:', stageId, 'with filters:', roleFilters);
    console.log('User role:', userRole, 'User grant roles:', userGrantRoles);
    
    let filteredApps = stageApps;
    
    // Apply view mode filtering (My Grants vs All Grants)
    if (roleFilters.viewMode === 'my-grants') {
      filteredApps = stageApps.filter(app => {
        // For bookmarked grants without grant_id, check if user owns the bookmark
        if (!app.grant_id) {
          return app.user_id === user?.id;
        }
        // For grants with grant_id, check if user has any role assignment
        return Object.keys(userGrantRoles).includes(app.grant_id);
      });
      console.log('Filtered to my grants:', filteredApps.length, 'out of', stageApps.length);
    }
    // For "all-grants" mode, show all apps (admin/manager privilege)
    
    // Apply role-specific filtering
    const roleFiltered = applyRoleFilter(filteredApps);
    console.log('After role filter:', roleFiltered.length, 'grants');
    
    return roleFiltered;
  };

  const applyRoleFilter = (apps: GrantApplication[]) => {
    if (!roleFilters || roleFilters.roleFilter === 'all') return apps;
    
    console.log('Applying role filter:', roleFilters.roleFilter);
    
    // Filter by specific grant role assignment
    const roleFiltered = apps.filter(app => {
      // For bookmarked grants without grant_id, include them (legacy support)
      if (!app.grant_id) {
        console.log('Including legacy grant without grant_id:', app.discovered_grant.title);
        return true;
      }
      
      // Check user's role assignment for this specific grant
      const userRoleForGrant = userGrantRoles[app.grant_id];
      console.log('Grant:', app.discovered_grant.title, 'User role:', userRoleForGrant, 'Filter:', roleFilters.roleFilter);
      
      if (!userRoleForGrant) {
        console.log('No role assignment found for grant:', app.grant_id);
        return false;
      }
      
      return userRoleForGrant === roleFilters.roleFilter;
    });
    
    console.log('Role filter result:', roleFiltered.length, 'grants match role', roleFilters.roleFilter);
    return roleFiltered;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStageProgress = (stageId: string) => {
    const stageIndex = pipelineStages.findIndex(stage => stage.id === stageId);
    return ((stageIndex + 1) / pipelineStages.length) * 100;
  };

  const getDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleCardClick = (application: GrantApplication, e: React.MouseEvent) => {
    // Prevent navigation when dragging
    if ((e.target as HTMLElement).closest('[data-rbd-drag-handle-draggable-id]')) {
      return;
    }
    // If grant has workspace, navigate; otherwise open modal
    if (application.grant_id) {
      navigate(`/grants/${application.grant_id}`);
    } else {
      setSelectedGrant(application);
      setIsModalOpen(true);
    }
  };

  const handleRemoveFromPipeline = () => {
    fetchApplications(); // Refresh the pipeline
  };

  const handleOpenWorkspace = (grantId: string) => {
    navigate(`/grants/${grantId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Grant Pipeline</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {pipelineStages.map((stage) => (
            <div key={stage.id} className={`p-4 rounded-lg ${stage.color} min-h-[200px]`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-900">{stage.title}</h3>
                <stage.icon className="h-5 w-5 text-slate-600" />
              </div>
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white/50 p-3 rounded-lg animate-pulse">
                    <div className="h-4 bg-slate-200 rounded mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Grant Pipeline</h2>
          <p className="text-sm text-slate-600 mt-1">
            Track your grant applications through each stage of the process
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            {applications.length} grant{applications.length !== 1 ? 's' : ''} in pipeline
          </div>
          {roleFilters && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              <span>View: {roleFilters.viewMode}</span>
              {roleFilters.roleFilter !== 'all' && (
                <span>• Role: {roleFilters.roleFilter}</span>
              )}
              <span>• My Assignments: {Object.keys(userGrantRoles).length}</span>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              fetchApplications();
              fetchUserGrantAssignments();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[600px]">
          {pipelineStages.map((stage) => {
            const stageApplications = getApplicationsByStage(stage.id);
            const progress = getStageProgress(stage.id);

            return (
              <div
                key={stage.id}
                className={`p-4 rounded-lg ${stage.color} flex flex-col min-h-0`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-slate-900">{stage.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {stageApplications.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">{stage.description}</p>
                    <Progress value={progress} className="h-1" />
                  </div>
                  <stage.icon className="h-5 w-5 text-slate-600 ml-2" />
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 min-h-0 space-y-3 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-white/20 rounded-md p-2' : ''
                      }`}
                    >
                      {stageApplications.map((application, applicationIndex) => {
                        const daysUntil = getDaysUntilDeadline(application.discovered_grant.deadline);
                        
                        return (
                          <Draggable
                            key={application.id}
                            draggableId={application.id}
                            index={applicationIndex}
                          >
                            {(provided, snapshot) => (
                               <div
                                 ref={provided.innerRef}
                                 {...provided.draggableProps}
                                 {...provided.dragHandleProps}
                                 className={`mb-3 ${
                                   snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                 }`}
                               >
                                  <GrantCardWithTasks
                                    application={application}
                                    onCardClick={handleCardClick}
                                    formatCurrency={formatCurrency}
                                    getDaysUntilDeadline={getDaysUntilDeadline}
                                    onOpenWorkspace={handleOpenWorkspace}
                                  />
                               </div>
                             )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      
                      {stageApplications.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          <stage.icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-xs">No grants in this stage</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <GrantDetailModal
        grant={selectedGrant}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRemoveFromPipeline={handleRemoveFromPipeline}
      />
    </div>
  );
}