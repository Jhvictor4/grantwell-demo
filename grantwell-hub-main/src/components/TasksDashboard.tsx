import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  CheckSquare, 
  Clock, 
  Calendar as CalendarIcon,
  Plus,
  GripVertical,
  User,
  Flag
} from 'lucide-react';

interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
}

interface TaskCard {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  grant_title: string;
  assigned_to?: string;
  assignee_email?: string;
  tags?: string[];
}

interface Profile {
  id: string;
  email: string;
}

interface Grant {
  id: string;
  title: string;
}

interface TaskFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string;
  grant_id: string;
  due_date?: Date;
  tags: string;
}

// Drop Zone Component
function DropZone({ id, children, title, count }: { 
  id: string; 
  children: React.ReactNode; 
  title: string; 
  count: number;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const getZoneColor = () => {
    switch (id) {
      case 'pending': return isOver ? 'border-yellow-400 bg-yellow-50' : 'border-yellow-200 bg-yellow-50/30';
      case 'in_progress': return isOver ? 'border-blue-400 bg-blue-50' : 'border-blue-200 bg-blue-50/30';
      case 'completed': return isOver ? 'border-green-400 bg-green-50' : 'border-green-200 bg-green-50/30';
      default: return isOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-gray-50/30';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          {title}
          <Badge variant="secondary">{count}</Badge>
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[400px] p-4 border-2 border-dashed rounded-lg transition-all ${getZoneColor()}`}
      >
        {children}
      </div>
    </div>
  );
}

// Draggable Task Card Component
function DraggableTaskCard({ task, onEdit }: { task: TaskCard; onEdit: (task: TaskCard) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`cursor-pointer border-l-4 ${getPriorityColor(task.priority)} ${
        isOverdue ? 'border-red-300' : ''
      } hover:shadow-md transition-shadow mb-3`}
      onClick={(e) => {
        // Only trigger edit if not dragging
        if (!isDragging) {
          onEdit(task);
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-sm leading-tight flex-1">{task.title}</h4>
          <div 
            {...listeners} 
            className="cursor-grab p-1"
            onClick={(e) => e.stopPropagation()} // Prevent edit dialog when grabbing
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-slate-600 mb-3 line-clamp-2">{task.description}</p>
        )}

        <div className="space-y-2">
          {task.due_date && (
            <div className={`flex items-center text-xs ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
              <Clock className="h-3 w-3 mr-1" />
              {isOverdue ? 'Overdue: ' : 'Due: '}
              {format(new Date(task.due_date), 'MMM d')}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={getPriorityBadgeColor(task.priority)}>
              <Flag className="h-3 w-3 mr-1" />
              {task.priority}
            </Badge>
            
            {task.grant_title && (
              <Badge variant="outline" className="text-xs">
                {task.grant_title}
              </Badge>
            )}
          </div>

          {task.assignee_email && (
            <div className="flex items-center gap-2">
              <User className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-600">{task.assignee_email}</span>
            </div>
          )}

          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {task.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const TasksDashboard: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [taskSummary, setTaskSummary] = useState<TaskSummary>({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0
  });
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    grant_id: '',
    tags: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadTasks(), loadProfiles(), loadGrants()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    let taskQuery = supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        assigned_to,
        grant_id,
        created_by,
        progress_percentage
      `);

    // Filter based on user role
    if (userRole !== 'admin' && userRole !== 'manager') {
      taskQuery = taskQuery.eq('assigned_to', user?.id);
    }

    const { data: tasksData, error } = await taskQuery;
    if (error) throw error;

    // Get additional data for tasks
    const grantIds = tasksData?.map(t => t.grant_id).filter(Boolean) || [];
    const assigneeIds = tasksData?.map(t => t.assigned_to).filter(Boolean) || [];

    const [grantsResponse, profilesResponse] = await Promise.all([
      supabase.from('grants').select('id, title').in('id', grantIds),
      supabase.from('profiles').select('id, email').in('id', assigneeIds)
    ]);

    const grantsMap = new Map(grantsResponse.data?.map(g => [g.id, g.title]) || []);
    const profilesMap = new Map(profilesResponse.data?.map(p => [p.id, p.email]) || []);

    // Calculate task summary
    const summary: TaskSummary = {
      total: tasksData?.length || 0,
      pending: 0,
      in_progress: 0,
      completed: 0
    };

    // Map database values to proper types
    const mapPriority = (priority: string): TaskCard['priority'] => {
      switch (priority?.toLowerCase()) {
        case 'urgent': return 'urgent';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'medium';
      }
    };

    const mapStatus = (status: string): TaskCard['status'] => {
      switch (status?.toLowerCase()) {
        case 'pending': return 'pending';
        case 'in_progress': return 'in_progress';
        case 'completed': return 'completed';
        default: return 'pending';
      }
    };

    const enrichedTasks: TaskCard[] = (tasksData || []).map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: mapStatus(task.status),
      priority: mapPriority(task.priority),
      due_date: task.due_date,
      grant_title: task.grant_id ? grantsMap.get(task.grant_id) || 'Unknown Grant' : 'No Grant',
      assigned_to: task.assigned_to,
      assignee_email: task.assigned_to ? profilesMap.get(task.assigned_to) : undefined,
      tags: [] // Add tags support later if needed
    }));

    // Calculate summary stats
    enrichedTasks.forEach(task => {
      summary[task.status]++;
    });

    setTasks(enrichedTasks);
    setTaskSummary(summary);
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email')
      .order('email');

    if (error) throw error;
    setProfiles(data || []);
  };

  const loadGrants = async () => {
    const { data, error } = await supabase
      .from('grants')
      .select('id, title')
      .order('title');

    if (error) throw error;
    setGrants(data || []);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskCard['status'];

    // Find the task being moved
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          progress_percentage: newStatus === 'completed' ? 100 : undefined 
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === taskId 
          ? { ...t, status: newStatus }
          : t
      ));

      // Recalculate summary
      await loadTasks();

      toast({
        title: "Task Updated",
        description: `Task moved to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a task title",
        variant: "destructive"
      });
      return;
    }

    try {
      const tagsArray = formData.tags
        ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description,
          status: 'pending',
          priority: formData.priority,
          assigned_to: formData.assigned_to && formData.assigned_to !== '' && formData.assigned_to !== 'unassigned' ? formData.assigned_to : null,
          grant_id: formData.grant_id && formData.grant_id !== '' && formData.grant_id !== 'no-grant' ? formData.grant_id : null,
          due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: "Task Created",
        description: "New task has been created successfully",
      });

      // Reload data and reset form
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      assigned_to: '',
      grant_id: '',
      tags: '',
    });
  };

  const handleEditTask = (task: TaskCard) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assigned_to: task.assigned_to || 'unassigned',
      grant_id: grants.find(g => g.title === task.grant_title)?.id || 'no-grant',
      due_date: task.due_date ? new Date(task.due_date) : undefined,
      tags: task.tags?.join(', ') || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !editingTask) {
      toast({
        title: "Error",
        description: "Please enter a task title",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          assigned_to: formData.assigned_to && formData.assigned_to !== '' && formData.assigned_to !== 'unassigned' ? formData.assigned_to : null,
          grant_id: formData.grant_id && formData.grant_id !== '' && formData.grant_id !== 'no-grant' ? formData.grant_id : null,
          due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      toast({
        title: "Task Updated",
        description: "Task has been updated successfully",
      });

      // Reload data and reset form
      await loadData();
      resetForm();
      setIsEditDialogOpen(false);
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive"
      });
    }
  };

  const getTasksByStatus = (status: TaskCard['status']) => {
    return tasks.filter(task => task.status === status);
  };

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-4 h-96 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary Stats and Add Task Button */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{taskSummary.total}</p>
              <p className="text-sm text-slate-600">Total Tasks</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{taskSummary.pending}</p>
              <p className="text-sm text-slate-600">Pending</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{taskSummary.in_progress}</p>
              <p className="text-sm text-slate-600">In Progress</p>
            </div>
          </CardContent>
        </Card>

        {/* Add Task Button */}
        {(userRole === 'admin' || userRole === 'manager') ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Card className="border-slate-200 hover:border-blue-300 cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-center">
                  <div className="text-center">
                    <Plus className="h-8 w-8 text-blue-600 mx-auto mb-1" />
                    <p className="text-sm text-blue-600 font-medium">Add Task</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
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
                    <Label htmlFor="assigned_to">Assign To</Label>
                    <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {profiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grant_id">Grant</Label>
                    <Select value={formData.grant_id} onValueChange={(value) => setFormData(prev => ({ ...prev, grant_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select grant" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-grant">No grant</SelectItem>
                        {grants.map(grant => (
                          <SelectItem key={grant.id} value={grant.id}>
                            {grant.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.due_date ? format(formData.due_date, 'MMM d, yyyy') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date}
                          onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="urgent, quarterly, compliance"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    Create Task
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{taskSummary.completed}</p>
                <p className="text-sm text-slate-600">Completed</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Drag and Drop Task Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pending Tasks */}
          <DropZone id="pending" title="📝 Pending" count={taskSummary.pending}>
            <SortableContext items={getTasksByStatus('pending').map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {getTasksByStatus('pending').map(task => (
                  <DraggableTaskCard key={task.id} task={task} onEdit={handleEditTask} />
                ))}
                {getTasksByStatus('pending').length === 0 && (
                  <p className="text-center text-slate-500 py-8">No pending tasks</p>
                )}
              </div>
            </SortableContext>
          </DropZone>

          {/* In Progress Tasks */}
          <DropZone id="in_progress" title="⚙️ In Progress" count={taskSummary.in_progress}>
            <SortableContext items={getTasksByStatus('in_progress').map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {getTasksByStatus('in_progress').map(task => (
                  <DraggableTaskCard key={task.id} task={task} onEdit={handleEditTask} />
                ))}
                {getTasksByStatus('in_progress').length === 0 && (
                  <p className="text-center text-slate-500 py-8">No tasks in progress</p>
                )}
              </div>
            </SortableContext>
          </DropZone>

          {/* Completed Tasks */}
          <DropZone id="completed" title="✅ Completed" count={taskSummary.completed}>
            <SortableContext items={getTasksByStatus('completed').map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {getTasksByStatus('completed').map(task => (
                  <DraggableTaskCard key={task.id} task={task} onEdit={handleEditTask} />
                ))}
                {getTasksByStatus('completed').length === 0 && (
                  <p className="text-center text-slate-500 py-8">No completed tasks</p>
                )}
              </div>
            </SortableContext>
          </DropZone>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && (
            <div className="opacity-90">
              <DraggableTaskCard task={activeTask} onEdit={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}>
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
                <Label htmlFor="edit-assigned_to">Assign To</Label>
                <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-grant_id">Grant</Label>
                <Select value={formData.grant_id} onValueChange={(value) => setFormData(prev => ({ ...prev, grant_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-grant">No grant</SelectItem>
                    {grants.map(grant => (
                      <SelectItem key={grant.id} value={grant.id}>
                        {grant.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-due_date">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, 'MMM d, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
              <Input
                id="edit-tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="urgent, quarterly, compliance"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1">
                Update Task
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingTask(null);
                resetForm();
              }}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasksDashboard;