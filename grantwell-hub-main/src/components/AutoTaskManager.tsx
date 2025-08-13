import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { 
  createAutomaticTasks, 
  getTaskTemplatesForGrant,
  type CreateTasksOptions 
} from '@/lib/grant-task-automation';
import { 
  CheckSquare, 
  Plus, 
  Settings, 
  Clock, 
  User, 
  Calendar,
  AlertCircle,
  Trash2,
  Edit
} from 'lucide-react';

interface AutoTaskManagerProps {
  grantId: string;
  grantTitle: string;
  agency?: string;
  deadline?: string;
  grantType?: string;
  onTasksCreated?: (count: number) => void;
}

interface TaskTemplate {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  daysFromNow: number;
  category: string;
  selected: boolean;
  customized?: boolean;
}

export const AutoTaskManager: React.FC<AutoTaskManagerProps> = ({
  grantId,
  grantTitle,
  agency,
  deadline,
  grantType,
  onTasksCreated
}) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [customTask, setCustomTask] = useState<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    daysFromNow: number;
    category: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    daysFromNow: 7,
    category: 'custom'
  });

  useEffect(() => {
    if (isOpen) {
      loadTaskTemplates();
    }
  }, [isOpen, grantType, agency]);

  const loadTaskTemplates = () => {
    const templates = getTaskTemplatesForGrant(grantType, agency);
    setTaskTemplates(
      templates.map(template => ({
        ...template,
        selected: true, // Default to all selected
        customized: false
      }))
    );
  };

  const toggleTaskSelection = (index: number) => {
    setTaskTemplates(prev => 
      prev.map((task, i) => 
        i === index ? { ...task, selected: !task.selected } : task
      )
    );
  };

  const updateTaskTemplate = (index: number, field: keyof TaskTemplate, value: any) => {
    setTaskTemplates(prev => 
      prev.map((task, i) => 
        i === index ? { ...task, [field]: value, customized: true } : task
      )
    );
  };

  const addCustomTask = () => {
    if (!customTask.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a task title",
        variant: "destructive"
      });
      return;
    }

    setTaskTemplates(prev => [
      ...prev,
      {
        ...customTask,
        selected: true,
        customized: true
      }
    ]);

    setCustomTask({
      title: '',
      description: '',
      priority: 'medium',
      daysFromNow: 7,
      category: 'custom'
    });
  };

  const removeTask = (index: number) => {
    setTaskTemplates(prev => prev.filter((_, i) => i !== index));
  };

  const createTasks = async () => {
    if (!user) return;

    const selectedTasks = taskTemplates.filter(task => task.selected);
    
    if (selectedTasks.length === 0) {
      toast({
        title: "No Tasks Selected",
        description: "Please select at least one task to create",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await createAutomaticTasks({
        grantId,
        grantTitle,
        agency,
        deadline,
        grantType,
        userId: user.id,
        customTasks: selectedTasks,
        skipDefaultTasks: true // We're providing our own selected tasks
      });

      if (result.success) {
        toast({
          title: "Tasks Created",
          description: `Successfully created ${result.tasksCreated} tasks for this grant`,
        });
        
        onTasksCreated?.(result.tasksCreated);
        setIsOpen(false);
      } else {
        throw new Error(result.error || 'Failed to create tasks');
      }
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast({
        title: "Error",
        description: "Failed to create tasks. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const calculateDueDate = (daysFromNow: number) => {
    let dueDate: Date;
    
    if (deadline) {
      dueDate = new Date(deadline);
      dueDate.setDate(dueDate.getDate() - daysFromNow);
      
      // If calculated date is in the past, use current date + 1 day
      const currentDate = new Date();
      if (dueDate < currentDate) {
        dueDate = new Date(currentDate);
        dueDate.setDate(dueDate.getDate() + 1);
      }
    } else {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysFromNow);
    }
    
    return dueDate.toLocaleDateString();
  };

  // Only show to admins and managers
  if (userRole !== 'admin' && userRole !== 'manager') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckSquare className="h-4 w-4 mr-2" />
          Auto-Generate Tasks
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Automatic Task Generation</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Grant Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-900">Grant Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Title:</span>
                  <p className="text-blue-700">{grantTitle}</p>
                </div>
                {agency && (
                  <div>
                    <span className="font-medium text-blue-800">Agency:</span>
                    <p className="text-blue-700">{agency}</p>
                  </div>
                )}
                {deadline && (
                  <div>
                    <span className="font-medium text-blue-800">Deadline:</span>
                    <p className="text-blue-700">{new Date(deadline).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Task Templates */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recommended Tasks</h3>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTaskTemplates(prev => prev.map(task => ({ ...task, selected: true })))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTaskTemplates(prev => prev.map(task => ({ ...task, selected: false })))}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {taskTemplates.map((task, index) => (
                <Card key={index} className={`${task.selected ? 'ring-2 ring-blue-200' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={task.selected}
                        onCheckedChange={() => toggleTaskSelection(index)}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {task.customized ? (
                              <Input
                                value={task.title}
                                onChange={(e) => updateTaskTemplate(index, 'title', e.target.value)}
                                className="font-medium"
                              />
                            ) : (
                              <h4 className="font-medium">{task.title}</h4>
                            )}
                            <Badge variant={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            {task.customized && (
                              <Badge variant="outline">
                                <Edit className="h-3 w-3 mr-1" />
                                Modified
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1 text-sm text-slate-500">
                              <Calendar className="h-4 w-4" />
                              <span>{calculateDueDate(task.daysFromNow)}</span>
                            </div>
                            {task.customized && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTask(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {task.customized ? (
                          <Textarea
                            value={task.description}
                            onChange={(e) => updateTaskTemplate(index, 'description', e.target.value)}
                            rows={2}
                          />
                        ) : (
                          <p className="text-sm text-slate-600">{task.description}</p>
                        )}
                        
                        {task.customized && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Priority</Label>
                              <Select
                                value={task.priority}
                                onValueChange={(value) => updateTaskTemplate(index, 'priority', value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label className="text-xs">Days {deadline ? 'Before Deadline' : 'From Now'}</Label>
                              <Input
                                type="number"
                                value={task.daysFromNow}
                                onChange={(e) => updateTaskTemplate(index, 'daysFromNow', parseInt(e.target.value) || 1)}
                                className="h-8"
                                min="1"
                              />
                            </div>
                            
                            <div>
                              <Label className="text-xs">Category</Label>
                              <Input
                                value={task.category}
                                onChange={(e) => updateTaskTemplate(index, 'category', e.target.value)}
                                className="h-8"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Add Custom Task */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Custom Task</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Task Title</Label>
                  <Input
                    value={customTask.title}
                    onChange={(e) => setCustomTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Review budget requirements"
                  />
                </div>
                
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={customTask.priority}
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setCustomTask(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea
                  value={customTask.description}
                  onChange={(e) => setCustomTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what needs to be done..."
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Days {deadline ? 'Before Deadline' : 'From Now'}</Label>
                  <Input
                    type="number"
                    value={customTask.daysFromNow}
                    onChange={(e) => setCustomTask(prev => ({ ...prev, daysFromNow: parseInt(e.target.value) || 1 }))}
                    min="1"
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={addCustomTask} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <CheckSquare className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">
                      {taskTemplates.filter(t => t.selected).length} tasks selected
                    </span>
                  </div>
                  
                  {deadline && (
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Tasks will be scheduled based on grant deadline</span>
                    </div>
                  )}
                </div>
                
                <Button 
                  onClick={createTasks} 
                  disabled={loading || taskTemplates.filter(t => t.selected).length === 0}
                >
                  {loading ? 'Creating...' : 'Create Tasks'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};