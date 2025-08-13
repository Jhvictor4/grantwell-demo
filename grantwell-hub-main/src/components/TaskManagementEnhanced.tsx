import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, Edit, Trash2, Clock, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toTitleCase } from '@/lib/utils';
import { ContextualFileUpload } from '@/components/ContextualFileUpload';

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: string;
  status: string;
  progress_percentage: number;
  assigned_to?: string;
  assigned_by?: string;
  grant_id: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
}

interface Profile {
  id: string;
  email?: string;
  role?: string;
}

interface TaskManagementProps {
  grantId?: string;
}

export const TaskManagementEnhanced: React.FC<TaskManagementProps> = ({ grantId }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: undefined as Date | undefined,
    priority: 'medium',
    status: 'pending',
    progress_percentage: 0,
    assigned_to: '',
    grant_id: grantId || ''
  });

  useEffect(() => {
    loadTasks();
    loadProfiles();
  }, [grantId]);

  const loadTasks = async () => {
    try {
      let query = supabase.from('tasks').select('*');
      
      if (grantId) {
        query = query.eq('grant_id', grantId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, email, role');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const taskData = {
        ...formData,
        due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
        created_by: user?.id,
        assigned_by: user?.id
      };

      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id);
        if (error) throw error;
        toast({ title: "Success", description: "Task updated successfully" });
      } else {
        const { error } = await supabase.from('tasks').insert([taskData]);
        if (error) throw error;
        toast({ title: "Success", description: "Task created successfully" });
      }

      resetForm();
      loadTasks();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: "Error",
        description: "Failed to save task",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      due_date: undefined,
      priority: 'medium',
      status: 'pending',
      progress_percentage: 0,
      assigned_to: '',
      grant_id: grantId || ''
    });
    setEditingTask(null);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date ? new Date(task.due_date) : undefined,
      priority: task.priority,
      status: task.status,
      progress_percentage: task.progress_percentage,
      assigned_to: task.assigned_to || '',
      grant_id: task.grant_id
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      toast({ title: "Success", description: "Task deleted successfully" });
      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const updateTaskProgress = async (taskId: string, progress: number) => {
    try {
      const updateData: any = { progress_percentage: progress };
      if (progress === 100) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);
      
      if (error) throw error;
      loadTasks();
      toast({ title: "Success", description: "Task progress updated" });
    } catch (error) {
      console.error('Error updating progress:', error);
      toast({
        title: "Error",
        description: "Failed to update task progress",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'on_hold': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && !tasks.find(t => t.due_date === dueDate && t.status === 'completed');
  };

  const canEditTask = (task: Task) => {
    return userRole === 'admin' || userRole === 'manager' || task.created_by === user?.id || task.assigned_to === user?.id;
  };

  if (loading) {
    return <div className="p-6">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Task Management</h2>
        {(userRole === 'admin' || userRole === 'manager') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                </div>

                <div>
                  <Label>Assigned To</Label>
                  <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.email || profile.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.due_date ? format(formData.due_date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.due_date}
                        onSelect={(date) => setFormData({ ...formData, due_date: date })}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label htmlFor="progress">Progress ({formData.progress_percentage}%)</Label>
                  <input
                    type="range"
                    id="progress"
                    min="0"
                    max="100"
                    value={formData.progress_percentage}
                    onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingTask ? 'Update' : 'Create'} Task
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {task.title}
                    {task.due_date && isOverdue(task.due_date) && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge className={getPriorityColor(task.priority)}>
                      {toTitleCase(task.priority)}
                    </Badge>
                    <Badge className={getStatusColor(task.status)}>
                      {toTitleCase(task.status.replace('_', ' '))}
                    </Badge>
                    {task.due_date && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.due_date), "MMM dd, yyyy")}
                      </Badge>
                    )}
                  </div>
                </div>
                {canEditTask(task) && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(task)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(task.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {task.description && (
                <p className="text-muted-foreground mb-4">{task.description}</p>
              )}
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{task.progress_percentage}%</span>
                </div>
                <Progress value={task.progress_percentage} className="h-2" />
                
                {canEditTask(task) && task.status !== 'completed' && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTaskProgress(task.id, Math.min(100, task.progress_percentage + 25))}
                    >
                      +25%
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTaskProgress(task.id, 100)}
                    >
                      Complete
                    </Button>
                  </div>
                )}
              </div>

              {/* Task Supporting Documents */}
              <div className="border-t pt-4 mt-4">
                <ContextualFileUpload
                  context_type="task"
                  context_id={task.id}
                  grantId={grantId}
                  title="Task Supporting Files"
                  description="Upload evidence, documents, reports, or other files related to this task"
                  acceptedTypes=".pdf,.doc,.docx,.txt,.xlsx,.xls,.jpg,.jpeg,.png,.zip"
                  maxSizeMB={20}
                  multiple={true}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        
        {tasks.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No tasks found. Create your first task to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};