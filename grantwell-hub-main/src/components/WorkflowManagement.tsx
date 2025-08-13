import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Workflow,
  Activity,
  TrendingUp,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3
} from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_conditions: any;
  workflow_steps: any;
  created_at: string;
}

interface WorkflowInstance {
  id: string;
  workflow_id: string;
  grant_id: string;
  entity_type: string;
  entity_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  started_at: string;
  current_step: number;
  workflow?: Workflow;
}

interface ProcessTracker {
  id: string;
  grant_id: string;
  process_name: string;
  current_stage: string;
  total_stages: number;
  progress_percentage: number;
  status: string;
  started_at: string;
  expected_completion?: string;
  blocking_issues: any;
}

interface DataLifecycleEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_data: any;
  performed_at: string;
  performed_by: string;
}

export function WorkflowManagement() {
  const { userRole } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([]);
  const [processTrackers, setProcessTrackers] = useState<ProcessTracker[]>([]);
  const [lifecycleEvents, setLifecycleEvents] = useState<DataLifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('workflows');

  useEffect(() => {
    fetchWorkflowData();
  }, []);

  const fetchWorkflowData = async () => {
    try {
      setLoading(true);
      
      const [workflowsRes, instancesRes, trackersRes, eventsRes] = await Promise.all([
        supabase.from('workflows').select('*').order('name'),
        supabase.from('workflow_instances').select(`
          *,
          workflow:workflows(*)
        `).order('started_at', { ascending: false }),
        supabase.from('process_trackers').select('*').order('started_at', { ascending: false }),
        supabase.from('data_lifecycle_events').select('*').order('performed_at', { ascending: false }).limit(100)
      ]);

      if (workflowsRes.error) throw workflowsRes.error;
      if (instancesRes.error) throw instancesRes.error;
      if (trackersRes.error) throw trackersRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setWorkflows(workflowsRes.data || []);
      setWorkflowInstances(instancesRes.data || []);
      setProcessTrackers(trackersRes.data || []);
      setLifecycleEvents(eventsRes.data || []);
    } catch (error) {
      console.error('Error fetching workflow data:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflows')
        .update({ is_active: !isActive })
        .eq('id', workflowId);

      if (error) throw error;

      await fetchWorkflowData();
      toast({
        title: "Success",
        description: `Workflow ${!isActive ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast({
        title: "Error",
        description: "Failed to update workflow",
        variant: "destructive",
      });
    }
  };

  const executeWorkflowStep = async (instanceId: string, stepNumber: number) => {
    try {
      const { error } = await supabase.rpc('execute_workflow_step', {
        p_instance_id: instanceId,
        p_step_number: stepNumber
      });

      if (error) throw error;

      await fetchWorkflowData();
      toast({
        title: "Success",
        description: "Workflow step executed",
      });
    } catch (error) {
      console.error('Error executing workflow step:', error);
      toast({
        title: "Error",
        description: "Failed to execute workflow step",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_progress':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'paused':
      case 'blocked':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'failed':
      case 'delayed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canManageWorkflows = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflow Management</h2>
          <p className="text-muted-foreground">
            Automate processes and track data lifecycle across your grant management system.
          </p>
        </div>
        {canManageWorkflows && (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        )}
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflows" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="instances" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Instances
          </TabsTrigger>
          <TabsTrigger value="processes" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Process Tracking
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Data Lifecycle
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-4">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <Badge className={workflow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {canManageWorkflows && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWorkflow(workflow.id, workflow.is_active)}
                      >
                        {workflow.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{workflow.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{Array.isArray(workflow.workflow_steps) ? workflow.workflow_steps.length : 'N/A'} steps</span>
                    <span className="text-muted-foreground">
                      Created {new Date(workflow.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <div className="grid gap-4">
            {workflowInstances.map((instance) => (
              <Card key={instance.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-4">
                    <CardTitle className="text-lg">{instance.workflow?.name}</CardTitle>
                    <Badge className={getStatusColor(instance.status)}>
                      {instance.status}
                    </Badge>
                  </div>
                  {canManageWorkflows && instance.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => executeWorkflowStep(instance.id, instance.current_step)}
                    >
                      Execute Next Step
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>Step {instance.current_step} of {Array.isArray(instance.workflow?.workflow_steps) ? instance.workflow.workflow_steps.length : 0}</span>
                      <span className="text-muted-foreground">
                        Started {new Date(instance.started_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Progress 
                      value={(instance.current_step / (Array.isArray(instance.workflow?.workflow_steps) ? instance.workflow.workflow_steps.length : 1)) * 100} 
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="processes" className="space-y-4">
          <div className="grid gap-4">
            {processTrackers.map((tracker) => (
              <Card key={tracker.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">{tracker.process_name}</CardTitle>
                  <Badge className={getStatusColor(tracker.status)}>
                    {tracker.status.replace('_', ' ')}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{tracker.current_stage}</span>
                      <span>{tracker.progress_percentage}% complete</span>
                    </div>
                    <Progress value={tracker.progress_percentage} className="w-full" />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Started {new Date(tracker.started_at).toLocaleDateString()}
                      </div>
                      {tracker.expected_completion && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          Due {new Date(tracker.expected_completion).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    {Array.isArray(tracker.blocking_issues) && tracker.blocking_issues.length > 0 && (
                      <div className="flex items-center text-sm text-orange-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {tracker.blocking_issues.length} blocking issue(s)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="grid gap-4">
            {lifecycleEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        event.event_type === 'created' ? 'bg-green-500' :
                        event.event_type === 'updated' ? 'bg-blue-500' :
                        event.event_type === 'deleted' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`} />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium capitalize">{event.event_type}</span>
                          <Badge variant="outline">{event.entity_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Entity ID: {event.entity_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(event.performed_at).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}