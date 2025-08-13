import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Calendar, CheckSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskMultiAssignmentDropdown } from '@/components/TaskMultiAssignmentDropdown';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logGrantActivityWithDescription } from '@/lib/activity-logger';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
}

interface GrantKanbanBoardProps {
  grantId: string;
}

const columns = [
  { id: 'pending', title: 'To Do', color: 'bg-slate-100 border-slate-200' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50 border-blue-200' },
  { id: 'cancelled', title: 'On Hold', color: 'bg-amber-50 border-amber-200' },
  { id: 'completed', title: 'Completed', color: 'bg-green-50 border-green-200' }
] as const;

export function GrantKanbanBoard({ grantId }: GrantKanbanBoardProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadTasks();
  }, [grantId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, priority')
        .eq('grant_id', grantId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTasks((data as Task[]) || []);
    } catch (err) {
      console.error('Error loading tasks', err);
      toast({ title: 'Error', description: 'Failed to load tasks', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openTask = async (task: Task) => {
    try {
      setSelectedTask(task);
      const { data, error } = await supabase
        .from('task_assignments')
        .select('user_id')
        .eq('task_id', task.id);
      if (error) throw error;
      setAssignedUserIds((data || []).map((a: any) => a.user_id));
      setDialogOpen(true);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load task details', variant: 'destructive' });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as Task['status'];

    // Optimistic update
    const prev = tasks;
    setTasks((t) => t.map((x) => (x.id === taskId ? { ...x, status: newStatus } : x)));

    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (error) {
      console.error('Error updating task status', error);
      setTasks(prev);
      toast({ title: 'Error', description: 'Could not update task status', variant: 'destructive' });
    } else {
      await logGrantActivityWithDescription(
        grantId,
        'task_updated',
        `moved task to ${newStatus}`,
        { task_id: taskId, new_status: newStatus }
      );
    }
  };

  const tasksByStatus = (status: Task['status']) => tasks.filter((t) => t.status === status);
  const completed = tasksByStatus('completed').length;
  const total = tasks.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" /> Grant Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span>
              {completed}/{total} completed
            </span>
            <Progress value={total ? (completed / total) * 100 : 0} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map((col) => (
            <Card key={col.id} className={`${col.color} border`}>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{col.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tasksByStatus(col.id).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] space-y-2 rounded-md p-1 ${
                        snapshot.isDraggingOver ? 'bg-background' : ''
                      }`}
                    >
                      {tasksByStatus(col.id).map((task, index) => (
                        <Draggable draggableId={task.id} index={index} key={task.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`p-3 rounded-md border bg-card hover:shadow-sm transition ${
                                dragSnapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                              onClick={() => openTask(task)}
                            >
                              <div className="text-sm font-medium truncate">{task.title}</div>
                              {task.due_date && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          ))}
        </div>
      </DragDropContext>

      {/* Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title || 'Task'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.due_date && (
                <div className="text-sm text-muted-foreground">Due {new Date(selectedTask.due_date).toLocaleDateString()}</div>
              )}
              <TaskMultiAssignmentDropdown
                taskId={selectedTask.id}
                assignedUserIds={assignedUserIds}
                onAssignmentChange={setAssignedUserIds}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GrantKanbanBoard;
