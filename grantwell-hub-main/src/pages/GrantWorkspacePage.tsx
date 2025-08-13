
import React, { useState, useEffect } from 'react';
import { useParams, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useGrantAccess } from '@/hooks/useGrantAccess';
import { supabase } from '@/integrations/supabase/client';
import {
  Calendar,
  DollarSign,
  Building,
  ArrowLeft,
  Clock,
  Target,
  Users,
  FileText,
  CheckSquare,
  Shield,
  FolderOpen,
  BarChart3,
  MessageSquare,
  Settings,
  Award
} from 'lucide-react';
import { GrantWorkspaceOverview } from '@/components/workspace/GrantWorkspaceOverview';
import { GrantWorkspaceNavigation } from '@/components/workspace/GrantWorkspaceNavigation';
import { GrantWorkspaceTeam } from '@/components/workspace/GrantWorkspaceTeam';
import { GrantWorkspaceNarrative } from '@/components/workspace/GrantWorkspaceNarrative';
import { GrantWorkspaceCompliance } from '@/components/workspace/GrantWorkspaceCompliance';
import { GrantWorkspaceBudget } from '@/components/workspace/GrantWorkspaceBudget';
import { ActivityFeed } from '@/components/workspace/ActivityFeed';
import { GrantProgressBar } from '@/components/grants/GrantProgressBar';
import { SystemRole, GrantRole } from '@/lib/permissions';
import { GrantWorkspaceAttachments } from '@/components/workspace/GrantWorkspaceAttachments';
import { GrantWorkspaceTasks } from '@/components/workspace/GrantWorkspaceTasks';
import { GrantWorkspaceNotes } from '@/components/workspace/GrantWorkspaceNotes';
import { GrantWorkspaceCloseout } from '@/components/workspace/GrantWorkspaceCloseout';
import { GrantAwardSetup } from '@/components/workspace/GrantAwardSetup';
import SubrecipientPanel from '@/components/SubrecipientPanel';



interface Grant {
  id: string;
  title: string;
  funder: string;
  amount_awarded?: number;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

const canSeeTab = (tab: string, systemRole: string, grantRole?: string) => {
  if (tab === 'financials') return ['admin', 'manager'].includes(systemRole);
  if (tab === 'compliance') return ['admin', 'manager'].includes(systemRole) || ['coordinator', 'reviewer'].includes(grantRole || '');
  if (tab === 'narrative') return systemRole !== 'viewer' || ['coordinator', 'contributor'].includes(grantRole || '');
  if (tab === 'team') return ['admin'].includes(systemRole);
  return true; // most others open
};

export default function GrantWorkspacePage() {
  const { grantId, tab } = useParams<{ grantId: string; tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { checkGrantAccess, getGrantPermissions, assignments, loading: accessLoading } = useGrantAccess();
  
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Extract current tab from URL
  useEffect(() => {
    if (tab && tab !== grantId) {
      if (tab === 'users') {
        setActiveTab('team')
        navigate(`/grants/${grantId}/team`, { replace: true })
        return
      }
      if (tab === 'attachments') {
        setActiveTab('documents')
        navigate(`/grants/${grantId}/documents`, { replace: true })
        return
      }
      setActiveTab(tab)
    } else {
      setActiveTab('overview')
    }
  }, [tab, grantId, navigate]);

  // ESC key navigation to return to grants pipeline
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate('/grants', { state: { tab: 'pipeline' } });
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [navigate]);

  useEffect(() => {
    if (grantId) {
      loadGrant();
    }
  }, [grantId]);

  const loadGrant = async () => {
    if (!grantId) return;
    
    setLoading(true);
    try {
      // Try direct grant id
      const { data, error } = await supabase
        .from('grants')
        .select('*')
        .eq('id', grantId)
        .maybeSingle();

      if (error) {
        console.error('Error loading grant by id:', error);
      }

      if (data) {
        // Set grant; access redirect will be handled after access check resolves
        setGrant(data);
        return;
      }

      // If not found, allow navigating by discovered_grant_id
      const { data: byDiscovered } = await supabase
        .from('grants')
        .select('*')
        .eq('discovered_grant_id', grantId)
        .maybeSingle();

      if (byDiscovered) {
        // Redirect to the canonical route
        navigate(`/grants/${byDiscovered.id}${activeTab && activeTab !== 'overview' ? `/${activeTab}` : ''}`, { replace: true });
        setGrant(byDiscovered);
        return;
      }

      // If still not found, look for a bookmark mapping
      const { data: bookmark } = await supabase
        .from('bookmarked_grants')
        .select('grant_id')
        .eq('discovered_grant_id', grantId)
        .is('grant_id', null)
        .maybeSingle();

      // If mapped but grant not created yet, guide user
      toast({
        title: "Grant not in workspace yet",
        description: "Move this opportunity to the pipeline to create its workspace.",
      });
      navigate('/grants', { state: { tab: 'pipeline' } });
      return;

    } catch (error) {
      console.error('Error loading grant:', error);
      toast({
        title: "Error",
        description: "Failed to load grant details.",
        variant: "destructive"
      });
      navigate('/grants');
    } finally {
      setLoading(false);
    }
  };

  // Defer access redirect until access check resolves to prevent premature navigation
  useEffect(() => {
    if (!grant || accessLoading) return;
    if (!checkGrantAccess(grant.id)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to view this grant.",
        variant: "destructive"
      });
      navigate('/grants');
    }
  }, [grant?.id, accessLoading, assignments]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'overview') {
      navigate(`/grants/${grantId}`);
    } else {
      navigate(`/grants/${grantId}/${tab}`);
    }
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
      case 'active': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'draft': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'In Progress';
      case 'closed': return 'Closed';
      case 'draft': return 'Draft';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading grant workspace...</div>
      </div>
    );
  }

  if (!grant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Grant Not Found</h2>
          <p className="text-muted-foreground mb-4">The grant you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => navigate('/grants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Grants
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Grant Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/grants', { state: { tab: 'pipeline' } })}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pipeline
            </Button>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-2">{grant.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  <span>{grant.funder}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatCurrency(grant.amount_awarded)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(grant.start_date)} - {formatDate(grant.end_date)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(grant.status)}>
                {getStatusLabel(grant.status)}
              </Badge>
              {grant.status === 'active' && grant.amount_awarded && (
                <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                  <Award className="h-3 w-3" />
                  AWARDED
                </Badge>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grant Progress Bar */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <GrantProgressBar grantId={grant.id} />
        </div>
      </div>

      {/* Persistent Navigation Tabs */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <GrantWorkspaceNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            userRole={userRole || ''}
            grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
            grantId={grantId}
            isOwner={grant?.owner_id === user?.id}
            grantStatus={grant?.status}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <GrantWorkspaceOverview grantId={grant.id} grant={grant} />
                <GrantWorkspaceNotes 
                  grantId={grant.id} 
                  userRole={userRole as SystemRole || 'viewer'}
                  grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                  isOwner={grant?.owner_id === user?.id}
                />
                <ActivityFeed grantId={grant.id} />
              </div>
            )}
            
            {activeTab === 'narrative' && (
              <GrantWorkspaceNarrative 
                grantId={grant.id} 
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'compliance' && (
              <GrantWorkspaceCompliance 
                grantId={grant.id} 
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'budget' && (
              <GrantWorkspaceBudget 
                grantId={grant.id} 
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'tasks' && (
              <GrantWorkspaceTasks 
                grantId={grant.id}
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'documents' && (
              <GrantWorkspaceAttachments 
                grantId={grant.id}
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'award' && (
              <GrantAwardSetup grantId={grant.id} />
            )}

            {activeTab === 'subrecipients' && (
              <SubrecipientPanel grantId={grant.id} />
            )}

            
            {activeTab === 'closeout' && (
              <GrantWorkspaceCloseout 
                grantId={grant.id}
                userRole={userRole as SystemRole || 'viewer'}
                grantRole={assignments.find(a => a.grant_id === grantId)?.user_role as GrantRole}
                isOwner={grant?.owner_id === user?.id}
              />
            )}
            
            {activeTab === 'team' && (
              <GrantWorkspaceTeam grantId={grant.id} />
            )}
            
            {!['overview', 'narrative', 'compliance', 'budget', 'team', 'tasks', 'documents', 'closeout', 'award', 'subrecipients'].includes(activeTab) && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h3>
                <p className="text-muted-foreground">
                  The {activeTab} section is being developed with full role-based access control.
                </p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
