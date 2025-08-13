import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  Target, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { GrantReadinessScore } from '@/components/GrantReadinessScore';

interface GrantWorkspaceOverviewProps {
  grantId: string;
  grant: any;
}

export function GrantWorkspaceOverview({ grantId, grant }: GrantWorkspaceOverviewProps) {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    upcomingDeadlines: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (grantId) {
      loadGrantStats();
    }
  }, [grantId]);

  const loadGrantStats = async () => {
    try {
      setLoading(true);
      
      // Load task statistics
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, due_date')
        .eq('grant_id', grantId);

      if (tasksError) throw tasksError;

      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const overdueTasks = tasks?.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed'
      ).length || 0;
      const upcomingDeadlines = tasks?.filter(t => 
        t.due_date && 
        new Date(t.due_date) > new Date() && 
        new Date(t.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
        t.status !== 'completed'
      ).length || 0;

      setStats({
        totalTasks,
        completedTasks,
        overdueTasks,
        upcomingDeadlines
      });
    } catch (error) {
      console.error('Error loading grant stats:', error);
    } finally {
      setLoading(false);
    }
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

  const completionPercentage = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasks Complete</p>
                <p className="text-2xl font-bold">{stats.completedTasks}/{stats.totalTasks}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <Progress value={completionPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueTasks}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due This Week</p>
                <p className="text-2xl font-bold text-orange-600">{stats.upcomingDeadlines}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Grant Status</p>
                <Badge className={getStatusColor(grant.status)}>
                  {getStatusLabel(grant.status)}
                </Badge>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grant Readiness Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Grant Readiness Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GrantReadinessScore grantId={grantId} />
        </CardContent>
      </Card>

      {/* Grant Details */}
      <Card>
        <CardHeader>
          <CardTitle>Grant Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Grant ID</p>
              <p className="font-medium">{grant.id}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Funder</p>
              <p className="font-medium">{grant.funder}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Award Amount</p>
              <p className="font-medium">{formatCurrency(grant.amount_awarded)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{formatDate(grant.start_date)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">{formatDate(grant.end_date)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(grant.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grant Metadata from Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Application Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Agency</p>
              <p className="font-medium">{grant.funder}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Opportunity Number</p>
              <p className="font-medium">{grant.discovered_grant_id || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Funding Range</p>
              <p className="font-medium">{formatCurrency(grant.amount_awarded)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Submission Method</p>
              <p className="font-medium">Grants.gov</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Synced Status</p>
              <p className="font-medium">Active</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Date Added</p>
              <p className="font-medium">{formatDate(grant.created_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity - Moved here from elsewhere */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {/* Activity feed will be imported here */}
        </div>
      </div>
    </div>
  );
}