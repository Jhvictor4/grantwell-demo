import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, User, Clock, AlertTriangle, GripVertical, Bell, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskMultiAssignmentDropdown } from '@/components/TaskMultiAssignmentDropdown';
import { TaskChecklistDisplay } from '@/components/TaskChecklistDisplay';
import { UserAssignmentDisplay } from '@/components/UserAssignmentDisplay';
import { useConfetti } from '@/hooks/useConfetti';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: string;
  status: string;
  grant_id?: string;
  progress_percentage?: number;
  assigned_users?: AssignedUser[];
  reminder_enabled?: boolean;
  reminder_days_before?: number;
  reminder_date?: string;
  last_reminder_sent?: string;
  grant_title?: string;
}

interface AssignedUser {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
}

interface Grant {
  id: string;
  title: string;
  status: string;
}

const statusColumns = [
  { id: 'pending', title: 'To Do', color: 'bg-slate-100 border-slate-200' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50 border-blue-200' },
  { id: 'cancelled', title: 'On Hold', color: 'bg-amber-50 border-amber-200' },
  { id: 'completed', title: 'Completed', color: 'bg-green-50 border-green-200' }
];

interface KanbanBoardProps { grantId?: string }
const KanbanBoard = ({ grantId }: KanbanBoardProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { celebrateTaskCompletion } = useConfetti();
  const { sounds } = useSoundEffects();
  const completedTaskRef = useRef<HTMLElement | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    grant_id: grantId || 'no-grant',
    due_date: undefined as Date | undefined,
    reminder_enabled: true,
    reminder_days_before: 3,
  });
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTasks(), loadGrants()]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data. Please refresh the page.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    let query = supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        status,
        grant_id,
        progress_percentage,
        reminder_enabled,
        reminder_days_before,
        reminder_date,
        last_reminder_sent
      `)
      .order('created_at', { ascending: false });

    if (grantId) {
      query = query.eq('grant_id', grantId);
    }

    const { data: tasksData, error } = await query;

    if (error) throw error;

    // Get task assignments, grants, and profiles
    const taskIds = tasksData?.map(t => t.id) || [];
    const grantIds = tasksData?.map(t => t.grant_id).filter(Boolean) || [];

    const [assignmentsResponse, grantsResponse] = await Promise.all([
      supabase
        .from('task_assignments')
        .select('task_id, user_id')
        .in('task_id', taskIds),
      supabase.from('grants').select('id, title').in('id', grantIds)
    ]);

    // Get user profiles separately
    const userIds = assignmentsResponse.data?.map(a => a.user_id) || [];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', userIds);

    // Build maps
    const grantsMap = new Map(grantsResponse.data?.map(g => [g.id, g.title]) || []);
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const taskAssignmentsMap = new Map<string, AssignedUser[]>();
    
    assignmentsResponse.data?.forEach(assignment => {
      if (!taskAssignmentsMap.has(assignment.task_id)) {
        taskAssignmentsMap.set(assignment.task_id, []);
      }
      const profile = profilesMap.get(assignment.user_id);
      if (profile) {
        taskAssignmentsMap.get(assignment.task_id)?.push({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          role: profile.role
        });
      }
    });

    const enrichedTasks = tasksData?.map(task => ({
      ...task,
      assigned_users: taskAssignmentsMap.get(task.id) || [],
      grant_title: task.grant_id ? grantsMap.get(task.grant_id) : undefined,
    })) || [];

    setTasks(enrichedTasks);
  };

  const loadGrants = async () => {
    const { data, error } = await supabase
      .from('grants')
      .select('id, title, status')
      .order('title');

    if (error) throw error;
    setGrants(data || []);
  };

  const createTask = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a task title.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: newTask, error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description,
          status: 'pending',
          priority: formData.priority,
          grant_id: grantId ?? (formData.grant_id !== 'no-grant' ? formData.grant_id : null),
          due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
          reminder_enabled: formData.reminder_enabled,
          reminder_days_before: formData.reminder_days_before,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create task assignments
      if (assignedUserIds.length > 0) {
        const assignments = assignedUserIds.map(userId => ({
          task_id: newTask.id,
          user_id: userId,
          assigned_by: user?.id,
        }));

        const { error: assignmentError } = await supabase
          .from('task_assignments')
          .insert(assignments);

        if (assignmentError) {
          console.error('Error creating assignments:', assignmentError);
        }
      }

      toast({
        title: "Task Created",
        description: "New task has been added to the board.",
      });

      resetForm();
      setShowCreateDialog(false);
      loadTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create task.",
        variant: "destructive"
      });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string, taskElement?: HTMLElement) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress_percentage: newStatus === 'completed' ? 100 : undefined
        })
        .eq('id', taskId);

      if (error) throw error;

      // Trigger satisfaction feedback for task completion
      if (newStatus === 'completed') {
        // Use the provided element or find the task card
        const element = taskElement || document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
        
        // Add subtle celebration animation to the task card
        if (element) {
          element.style.transform = 'scale(1.02)';
          element.style.transition = 'transform 0.2s ease-out';
          setTimeout(() => {
            element.style.transform = 'scale(1)';
          }, 200);
        }
        
        // Trigger professional confetti
        celebrateTaskCompletion(element || undefined);
        
        // Play subtle completion sound
        sounds.taskComplete();
      }

      toast({
        title: "Task Updated",
        description: "Task status has been updated.",
      });

      loadTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update task.",
        variant: "destructive"
      });
    }
  };

  const handleTaskEdit = async (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      grant_id: task.grant_id || 'no-grant',
      due_date: task.due_date ? new Date(task.due_date) : undefined,
      reminder_enabled: task.reminder_enabled ?? true,
      reminder_days_before: task.reminder_days_before ?? 3,
    });
    setAssignedUserIds(task.assigned_users?.map(u => u.id) || []);
  };

  const updateTask = async () => {
    if (!editingTask || !formData.title.trim()) return;

    try {
      // Update task details
      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          grant_id: formData.grant_id !== 'no-grant' ? formData.grant_id : null,
          due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
          reminder_enabled: formData.reminder_enabled,
          reminder_days_before: formData.reminder_days_before,
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      // Update task assignments
      const currentAssignments = editingTask.assigned_users?.map(u => u.id) || [];
      const newAssignments = assignedUserIds;

      // Remove assignments that are no longer needed
      const toRemove = currentAssignments.filter(id => !newAssignments.includes(id));
      if (toRemove.length > 0) {
        await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', editingTask.id)
          .in('user_id', toRemove);
      }

      // Add new assignments
      const toAdd = newAssignments.filter(id => !currentAssignments.includes(id));
      if (toAdd.length > 0) {
        const assignments = toAdd.map(userId => ({
          task_id: editingTask.id,
          user_id: userId,
          assigned_by: user?.id,
        }));

        await supabase
          .from('task_assignments')
          .insert(assignments);
      }

      toast({
        title: "Task Updated",
        description: "Task has been updated successfully.",
      });

      resetForm();
      setEditingTask(null);
      loadTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update task.",
        variant: "destructive"
      });
    }
  };

  const deleteTask = async () => {
    if (!editingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', editingTask.id);

      if (error) throw error;

      toast({
        title: "Task Deleted",
        description: "Task has been deleted successfully.",
      });

      resetForm();
      setEditingTask(null);
      loadTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete task.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      grant_id: 'no-grant',
      due_date: undefined,
      reminder_enabled: true,
      reminder_days_before: 3,
    });
    setAssignedUserIds([]);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      // Get the dragged element for feedback effects
      const draggedElement = document.querySelector(`[data-task-id="${draggedTask.id}"]`) as HTMLElement;
      updateTaskStatus(draggedTask.id, newStatus, draggedElement);
    }
    setDraggedTask(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Task Button */}
      <div className="flex justify-end">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Task Title *</Label>
                <Input
                  id="task-title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

               <div className="space-y-2">
                 <Label>Assign To</Label>
                 <TaskMultiAssignmentDropdown
                   taskId="new"
                   assignedUserIds={assignedUserIds}
                   onAssignmentChange={setAssignedUserIds}
                 />
               </div>
              </div>

              <div className="space-y-2">
                <Label>Grant</Label>
                <Select value={formData.grant_id} onValueChange={(value) => setFormData(prev => ({ ...prev, grant_id: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                    <SelectItem value="no-grant">No grant</SelectItem>
                    {grants.map(grant => (
                      <SelectItem key={grant.id} value={grant.id}>
                        {grant.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-lg z-50">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Reminder Settings */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminder-enabled">Enable Reminders</Label>
                  <Switch
                    id="reminder-enabled"
                    checked={formData.reminder_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminder_enabled: checked }))}
                  />
                </div>
                
                {formData.reminder_enabled && (
                  <div className="space-y-2">
                    <Label>Remind before due date</Label>
                    <Select 
                      value={formData.reminder_days_before.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, reminder_days_before: parseInt(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day before</SelectItem>
                        <SelectItem value="3">3 days before</SelectItem>
                        <SelectItem value="7">1 week before</SelectItem>
                        <SelectItem value="14">2 weeks before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createTask}>
                  Create Task
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statusColumns.map(column => (
          <div
            key={column.id}
            className={cn("rounded-lg border-2 border-dashed", column.color)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">{column.title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {tasks.filter(task => task.status === column.id).length}
                </Badge>
              </div>
              
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {tasks
                  .filter(task => task.status === column.id)
                  .map(task => (
                    <Card
                      key={task.id}
                      data-task-id={task.id}
                      className="cursor-move hover:shadow-md transition-all duration-200 hover:scale-[1.01] bg-white"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => handleTaskEdit(task)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-slate-900 text-sm line-clamp-2">
                            {task.title}
                          </h4>
                          <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
                        </div>
                        
                        {task.description && (
                          <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-xs", getPriorityColor(task.priority))}>
                                {task.priority}
                              </Badge>
                              {task.reminder_enabled && task.due_date && (
                                <div className="flex items-center text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  <Bell className="h-3 w-3 mr-1" />
                                  {task.reminder_days_before}d
                                </div>
                              )}
                            </div>
                            {task.due_date && (
                              <div className={cn(
                                "flex items-center text-xs",
                                isOverdue(task.due_date) ? "text-red-600 font-medium" : "text-slate-600"
                              )}>
                                <Clock className="h-3 w-3 mr-1" />
                                {isOverdue(task.due_date) && <AlertTriangle className="h-3 w-3 mr-1" />}
                                {format(new Date(task.due_date), "MMM d")}
                              </div>
                            )}
                          </div>
                          
                          {task.assigned_users && task.assigned_users.length > 0 && (
                            <div className="flex items-center">
                              <UserAssignmentDisplay
                                assignedUsers={task.assigned_users}
                                maxDisplay={3}
                                size="sm"
                                showNames={false}
                              />
                            </div>
                          )}
                          
                          {task.grant_title && (
                            <div className="text-xs text-blue-600 truncate">
                              {task.grant_title}
                            </div>
                          )}
                          
                          {/* Task Checklist */}
                          <div className="mt-3 pt-2 border-t border-slate-200">
                            <TaskChecklistDisplay 
                              taskId={task.id} 
                              isCompact={true} 
                              maxDisplayItems={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task-title">Task Title *</Label>
              <Input
                id="edit-task-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-task-description">Description</Label>
              <Textarea
                id="edit-task-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Task description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <TaskMultiAssignmentDropdown
                    taskId={editingTask?.id || ''}
                    assignedUserIds={assignedUserIds}
                    onAssignmentChange={setAssignedUserIds}
                  />
                </div>
            </div>

            <div className="space-y-2">
              <Label>Grant</Label>
              <Select value={formData.grant_id} onValueChange={(value) => setFormData(prev => ({ ...prev, grant_id: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                  <SelectItem value="no-grant">No grant</SelectItem>
                  {grants.map(grant => (
                    <SelectItem key={grant.id} value={grant.id}>
                      {grant.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checklist Section */}
            <div className="space-y-2">
              <Label>Task Checklist</Label>
              <div className="border rounded-lg p-3 bg-slate-50">
                <TaskChecklistDisplay taskId={editingTask?.id || ''} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-lg z-50">
                  <Calendar
                    mode="single"
                    selected={formData.due_date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Reminder Settings */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-reminder-enabled">Enable Reminders</Label>
                <Switch
                  id="edit-reminder-enabled"
                  checked={formData.reminder_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, reminder_enabled: checked }))}
                />
              </div>
              
              {formData.reminder_enabled && (
                <div className="space-y-2">
                  <Label>Remind before due date</Label>
                  <Select 
                    value={formData.reminder_days_before.toString()} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, reminder_days_before: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day before</SelectItem>
                      <SelectItem value="3">3 days before</SelectItem>
                      <SelectItem value="7">1 week before</SelectItem>
                      <SelectItem value="14">2 weeks before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteTask}>
                Delete
              </Button>
              <Button onClick={updateTask}>
                Update Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KanbanBoard;