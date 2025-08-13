import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { CheckSquare, Clock, AlertTriangle, Plus, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TaskForm from './TaskForm';

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  grant_id: string;
  grants: {
    title: string;
  } | null;
  assignee?: {
    email: string;
  } | null;
  assigner?: {
    email: string;
  } | null;
}

const TaskManagement = ({ grantId }: { grantId?: string }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'created'>('all');
  const [showPriority, setShowPriority] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [grantId, filter]);

  const fetchTasks = async () => {
    if (!user) return;

    let query = supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        assigned_to,
        assigned_by,
        priority,
        status,
        due_date,
        completed_at,
        grant_id
      `)
      .order('due_date', { ascending: true });

    // Filter by grant if specified
    if (grantId) {
      query = query.eq('grant_id', grantId);
    }

    // Apply user filter
    if (filter === 'assigned') {
      query = query.eq('assigned_to', user.id);
    } else if (filter === 'created') {
      query = query.eq('assigned_by', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive"
      });
    } else {
      // Get related data separately
      const grantIds = [...new Set((data || []).map(item => item.grant_id))];
      const userIds = [...new Set((data || []).flatMap(item => [item.assigned_to, item.assigned_by].filter(Boolean)))];

      const [grantsData, profilesData] = await Promise.all([
        supabase.from('grants').select('id, title').in('id', grantIds),
        supabase.from('profiles').select('id, email').in('id', userIds)
      ]);

      const grantsMap = new Map((grantsData.data || []).map(g => [g.id, g.title]));
      const profilesMap = new Map((profilesData.data || []).map(p => [p.id, p.email]));

      // Type-safe mapping
      const typedTasks: Task[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        assigned_to: item.assigned_to,
        assigned_by: item.assigned_by,
        priority: item.priority as 'low' | 'medium' | 'high' | 'urgent',
        status: item.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
        due_date: item.due_date,
        completed_at: item.completed_at,
        grant_id: item.grant_id,
        grants: grantsMap.has(item.grant_id) ? { title: grantsMap.get(item.grant_id)! } : null,
        assignee: item.assigned_to && profilesMap.has(item.assigned_to) ? { email: profilesMap.get(item.assigned_to)! } : null,
        assigner: item.assigned_by && profilesMap.has(item.assigned_by) ? { email: profilesMap.get(item.assigned_by)! } : null
      }));
      setTasks(typedTasks);
    }
    setLoading(false);
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const updates: any = { status };
    
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (status !== 'completed') {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Task status updated"
      });
      fetchTasks();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'medium':
        return 'bg-yellow-600';
      default:
        return 'bg-green-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'in_progress':
        return 'bg-blue-600';
      case 'cancelled':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return <div className="p-4">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <CheckSquare className="h-6 w-6 mr-2" />
          Task Management
        </h2>
        <div className="flex space-x-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">View Options:</label>
            <div className="flex items-center space-x-1">
              <input
                type="checkbox"
                id="show-priority"
                checked={showPriority}
                onChange={(e) => setShowPriority(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-priority" className="text-sm">Show Priority</label>
            </div>
          </div>
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="assigned">Assigned to Me</SelectItem>
              <SelectItem value="created">Created by Me</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <TaskForm grantId={grantId} onTaskCreated={fetchTasks} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <Card key={task.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-slate-900">{task.title}</h4>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(task.status)}
                      >
                        {task.status.replace('_', ' ')}
                      </Badge>
                      {showPriority && (
                        <>
                          {getPriorityIcon(task.priority)}
                          <Badge
                            variant="secondary"
                            className={getPriorityColor(task.priority)}
                          >
                            {task.priority}
                          </Badge>
                        </>
                      )}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-slate-500">
                      {task.grants && (
                        <span>Grant: {task.grants.title}</span>
                      )}
                      {task.due_date && (
                        <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
                      )}
                      {task.assignee && (
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {task.assignee.email}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {(task.assigned_to === user?.id || canEdit) && task.status !== 'completed' && (
                      <Select
                        value={task.status}
                        onValueChange={(value) => updateTaskStatus(task.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center text-slate-500">
              <CheckSquare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No tasks found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TaskManagement;