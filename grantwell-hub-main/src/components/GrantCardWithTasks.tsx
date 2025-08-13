import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GrantReadinessScore } from '@/components/GrantReadinessScore';
import { UserAssignmentDisplay } from '@/components/UserAssignmentDisplay';
import { TeamAssignmentDropdown } from '@/components/TeamAssignmentDropdown';
import { GrantChecklistDisplay } from '@/components/GrantChecklistDisplay';
import { 
  Calendar, 
  DollarSign, 
  CheckCircle,
  Clock,
  Users,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GrantCardWithTasksProps {
  application: {
    id: string;
    grant_id?: string | null;
    discovered_grant_id: string;
    discovered_grant: {
      title: string;
      agency: string;
      deadline: string | null;
      funding_amount_min: number | null;
      funding_amount_max: number | null;
    };
    application_stage: string;
  };
  onCardClick: (application: any, e: React.MouseEvent) => void;
  formatCurrency: (amount: number | null | undefined) => string;
  getDaysUntilDeadline: (deadline: string) => number | null;
  onOpenWorkspace?: (grantId: string) => void;
}

export function GrantCardWithTasks({ 
  application, 
  onCardClick, 
  formatCurrency, 
  getDaysUntilDeadline,
  onOpenWorkspace
}: GrantCardWithTasksProps) {
  const [closeoutProgress, setCloseoutProgress] = useState<{completed: number; total: number} | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  
  const daysUntil = application.discovered_grant.deadline 
    ? getDaysUntilDeadline(application.discovered_grant.deadline)
    : null;

  // Load closeout progress for awarded grants and task assignments
  useEffect(() => {
    if (application.grant_id) {
      if (application.application_stage === 'awarded') {
        loadCloseoutProgress();
      }
      loadTaskAssignments();
    }
  }, [application.grant_id, application.application_stage]);

  const loadCloseoutProgress = async () => {
    if (!application.grant_id) return;
    
    try {
      // Get closeout tasks instead of closeout logs
      const { data, error } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('grant_id', application.grant_id)
        .eq('category', 'closeout');
        
      if (error) {
        console.error('Error loading closeout progress:', error);
        return;
      }
      
      const completed = data?.filter(task => task.status === 'completed').length || 0;
      const total = data?.length || 0;
      
      setCloseoutProgress({ completed, total });
    } catch (error) {
      console.error('Error loading closeout progress:', error);
    }
  };

  const loadTaskAssignments = async () => {
    if (!application.grant_id) return;
    
    try {
      const { data, error } = await supabase
        .from('grant_team_assignments')
        .select(`
          user_id,
          email,
          role
        `)
        .eq('grant_id', application.grant_id);

      if (error) {
        console.error('Error loading team assignments:', error);
        return;
      }
      
      // Get additional user details from profiles
      const userIds = data?.map(assignment => assignment.user_id).filter(Boolean) || [];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, role, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const users = data?.map(assignment => {
          const profile = profilesMap.get(assignment.user_id);
          return {
            id: assignment.user_id,
            email: assignment.email || profile?.email || 'Unknown',
            role: profile?.role || assignment.role,
            full_name: profile?.full_name
          };
        }) || [];
        
        setAssignedUsers(users);
      }
    } catch (error) {
      console.error('Error loading task assignments:', error);
    }
  };

  return (
    <Card 
      className="cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-slate-50"
      onClick={(e) => onCardClick(application, e)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium leading-tight">
              {application.discovered_grant.title}
            </CardTitle>
            <p className="text-xs text-slate-600 mt-1">
              {application.discovered_grant.agency}
            </p>
          </div>
          
          {/* Quick Workspace Access for Awarded Grants */}
          {application.application_stage === 'awarded' && application.grant_id && onOpenWorkspace && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenWorkspace(application.grant_id!);
              }}
              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Open Workspace"
            >
              <Settings className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3">
        <div className="space-y-2">
          {application.discovered_grant.deadline && (
            <div className="flex items-center text-xs text-slate-600">
              <Calendar className="h-3 w-3 mr-1" />
              <span>
                {daysUntil !== null
                  ? daysUntil > 0
                    ? `${daysUntil} days left`
                    : daysUntil === 0
                    ? 'Due today'
                    : `${Math.abs(daysUntil)} days overdue`
                  : 'No deadline'
                }
              </span>
            </div>
          )}
          
          {(application.discovered_grant.funding_amount_min || application.discovered_grant.funding_amount_max) && (
            <div className="flex items-center text-xs text-slate-600">
              <DollarSign className="h-3 w-3 mr-1" />
              <span>
                {formatCurrency(application.discovered_grant.funding_amount_min)} - {formatCurrency(application.discovered_grant.funding_amount_max)}
              </span>
            </div>
          )}

          {/* Team assignments - enhanced management */}
          {application.grant_id && (
            <div className="flex items-center justify-between text-xs">
              <TeamAssignmentDropdown
                grantId={application.grant_id}
                assignedUsers={assignedUsers}
                onAssignmentChange={loadTaskAssignments}
                mode="multi"
                size="sm"
              />
            </div>
          )}
          
          {/* Grant Readiness Score for non-awarded grants */}
          {application.grant_id && application.application_stage !== 'awarded' && (
            <div className="mt-3 pt-2 border-t border-slate-200">
              <GrantReadinessScore 
                grantId={application.grant_id} 
                size="sm"
              />
            </div>
          )}
          
          {/* Closeout Progress for awarded grants */}
          {application.grant_id && application.application_stage === 'awarded' && closeoutProgress && (
            <div className="mt-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Closeout Progress</span>
                <div className="flex items-center gap-1">
                  {closeoutProgress.completed === closeoutProgress.total ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Clock className="h-3 w-3 text-orange-500" />
                  )}
                  <span className="font-medium">
                    {closeoutProgress.completed}/{closeoutProgress.total}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{ 
                    width: closeoutProgress.total > 0 
                      ? `${(closeoutProgress.completed / closeoutProgress.total) * 100}%` 
                      : '0%' 
                  }}
                ></div>
              </div>
            </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}