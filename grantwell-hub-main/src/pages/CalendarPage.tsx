import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import CalendarIntegration from '@/components/CalendarIntegration';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isPast } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Settings, RefreshCw, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Deadline {
  id: string;
  name: string;
  due_date: string;
  type: string;
  completed: boolean;
  grants: { title: string; status: string };
}

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  priority: string;
  status: string;
  progress_percentage: number;
  assigned_to?: string;
  grants: { title: string; status: string };
  assignee?: { email: string };
}

interface CustomEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  event_type: string;
  grant_id?: string;
}

const CalendarPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [grants, setGrants] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [currentDate, setCurrentDate] = useState(new Date(2025, 7, 2)); // August 2, 2025 (month is 0-indexed)
  const [loading, setLoading] = useState(true);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [draggedEvent, setDraggedEvent] = useState<any>(null);
  
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'meeting',
    grant_id: '',
    event_time: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch deadlines with grant info
      const { data: deadlinesData, error: deadlinesError } = await supabase
        .from('deadlines')
        .select(`
          *,
          grants (title, status)
        `)
        .order('due_date', { ascending: true });

      if (deadlinesError) {
        // Silently handle deadlines error - not critical for app functionality
      }

      // Fetch tasks separately
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          priority,
          status,
          progress_percentage,
          assigned_to,
          grant_id
        `)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });

      // Fetch grants for dropdown and mapping
      const { data: grantsData } = await supabase
        .from('grants')
        .select('id, title, status')
        .order('title');

      // Get assignee info separately
      const assigneeIds = (tasksData || [])
        .map(task => task.assigned_to)
        .filter(Boolean);
      
      const { data: assigneesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', assigneeIds);
      
      const assigneesMap = new Map((assigneesData || []).map(p => [p.id, p.email]));
      const grantsMap = new Map((grantsData || []).map(g => [g.id, { title: g.title, status: g.status }]));

      // Map tasks with assignee and grant data  
      const tasksWithAssignees = (tasksData || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        due_date: task.due_date,
        priority: task.priority,
        status: task.status,
        progress_percentage: task.progress_percentage,
        assigned_to: task.assigned_to,
        grants: grantsMap.get(task.grant_id) || { title: 'Unknown Grant', status: 'draft' },
        assignee: task.assigned_to ? { email: assigneesMap.get(task.assigned_to) || 'Unknown' } : undefined
      }));

      // Fetch custom events
      const { data: eventsData } = await supabase
        .from('calendar_custom_events')
        .select('*')
        .order('event_date', { ascending: true });

      setDeadlines(deadlinesData || []);
      setTasks(tasksWithAssignees || []);
      setCustomEvents(eventsData || []);
      setGrants(grantsData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load calendar data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const syncWithCalendars = async () => {
    try {
      toast({
        title: "Refreshing Calendar",
        description: "Loading latest grant deadlines and tasks...",
      });

      await fetchData();

      toast({
        title: "Calendar Updated",
        description: "Calendar has been refreshed with the latest information.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh calendar data. Please try again.",
        variant: "destructive"
      });
    }
  };

  const testCalendarConnection = async () => {
    try {
      const { data: testData, error: testError } = await supabase
        .from('calendar_custom_events')
        .select('count')
        .limit(1);
      
      if (testError) {
        toast({
          title: "Connection Test Failed",
          description: `Database error: ${testError.message}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Connection Test Passed",
          description: "Calendar database connection is working."
        });
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Unable to connect to calendar database.",
        variant: "destructive"
      });
    }
  };

  const createCustomEvent = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create calendar events.",
        variant: "destructive"
      });
      return;
    }

    if (!eventForm.title?.trim()) {
      toast({
        title: "Event Title Required",
        description: "Please provide an event title.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date for the event.",
        variant: "destructive"
      });
      return;
    }

    try {
      const eventData = {
        title: eventForm.title.trim(),
        description: eventForm.description?.trim() || null,
        event_date: selectedDate.toISOString().split('T')[0],
        event_time: eventForm.event_time || null,
        event_type: eventForm.event_type || 'meeting',
        grant_id: eventForm.grant_id !== 'no-grant' ? eventForm.grant_id : null,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('calendar_custom_events')
        .insert([eventData])
        .select();

      if (error) throw error;
      
      toast({
        title: "Event Created",
        description: `"${eventForm.title}" has been added to your calendar.`,
      });

      // Reset form and close dialog
      setEventForm({
        title: '',
        description: '',
        event_type: 'meeting',
        grant_id: '',
        event_time: ''
      });
      setSelectedDate(null);
      setShowEventDialog(false);
      
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Could Not Create Event",
        description: error.message || "Unable to create calendar event. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleEditEvent = (eventData: any) => {
    setEditingEvent(eventData);
    
    // Set form based on event type
    if (eventData.event_type) {
      // Custom event
      setEventForm({
        title: eventData.title,
        description: eventData.description || '',
        event_type: eventData.event_type,
        grant_id: eventData.grant_id || '',
        event_time: eventData.event_time || ''
      });
      setSelectedDate(new Date(eventData.event_date));
    } else {
      // Other event types (deadline, task, etc.)
      setEventForm({
        title: eventData.title,
        description: eventData.description || '',
        event_type: 'custom',
        grant_id: eventData.grant_id || '',
        event_time: ''
      });
      setSelectedDate(new Date(eventData.due_date));
    }
    
    setShowEditDialog(true);
  };

  const updateEvent = async () => {
    if (!editingEvent || !user) {
      toast({
        title: "Error",
        description: "No event selected for editing.",
        variant: "destructive"
      });
      return;
    }

    if (!eventForm.title?.trim()) {
      toast({
        title: "Event Title Required",
        description: "Please provide an event title.",
        variant: "destructive"
      });
      return;
    }

    try {
      let updateData: any;
      let tableName: string;
      let idField = 'id';

      if (editingEvent.event_type) {
        // Custom event
        tableName = 'calendar_custom_events';
        updateData = {
          title: eventForm.title.trim(),
          description: eventForm.description?.trim() || null,
          event_date: selectedDate?.toISOString().split('T')[0],
          event_time: eventForm.event_time || null,
          event_type: eventForm.event_type,
          grant_id: eventForm.grant_id !== 'no-grant' ? eventForm.grant_id : null,
        };
      } else if (editingEvent.name && editingEvent.due_date) {
        // Deadline
        tableName = 'deadlines';
        updateData = {
          name: eventForm.title.trim(),
          due_date: selectedDate?.toISOString().split('T')[0],
        };
      } else if (editingEvent.title && editingEvent.due_date && editingEvent.status) {
        // Task
        tableName = 'tasks';
        updateData = {
          title: eventForm.title.trim(),
          description: eventForm.description?.trim() || null,
          due_date: selectedDate?.toISOString().split('T')[0],
        };
      } else {
        // For other types that we can't directly edit
        toast({
          title: "Cannot Edit",
          description: "This event type cannot be edited from the calendar. Please use the respective module.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq(idField, editingEvent.id);

      if (error) throw error;

      toast({
        title: "Event Updated",
        description: `"${eventForm.title}" has been updated successfully.`,
      });

      // Reset form and close dialog
      setEventForm({
        title: '',
        description: '',
        event_type: 'meeting',
        grant_id: '',
        event_time: ''
      });
      setSelectedDate(null);
      setEditingEvent(null);
      setShowEditDialog(false);
      
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Could Not Update Event",
        description: error.message || "Unable to update event. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteEvent = async () => {
    if (!editingEvent || !user) {
      toast({
        title: "Error",
        description: "No event selected for deletion.",
        variant: "destructive"
      });
      return;
    }

    try {
      let tableName: string;
      
      if (editingEvent.event_type) {
        tableName = 'calendar_custom_events';
      } else if (editingEvent.name && editingEvent.due_date) {
        tableName = 'deadlines';
      } else if (editingEvent.title && editingEvent.due_date && editingEvent.status) {
        tableName = 'tasks';
      } else {
        toast({
          title: "Cannot Delete",
          description: "This event type cannot be deleted from the calendar.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast({
        title: "Event Deleted",
        description: "Event has been deleted successfully.",
      });

      setEditingEvent(null);
      setShowEditDialog(false);
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Could Not Delete Event",
        description: error.message || "Unable to delete event. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDragStart = (event: React.DragEvent, eventData: any) => {
    setDraggedEvent(eventData);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event: React.DragEvent, targetDate: Date) => {
    event.preventDefault();
    
    if (!draggedEvent) return;

    const newDateString = targetDate.toISOString().split('T')[0];
    
    try {
      let tableName: string;
      let updateData: any;
      let dateField: string;

      // Determine which table and field to update based on event type
      if (draggedEvent.event_type) {
        // Custom event
        tableName = 'calendar_custom_events';
        dateField = 'event_date';
        updateData = { event_date: newDateString };
      } else if (draggedEvent.name && draggedEvent.due_date && draggedEvent.type) {
        // Deadline
        tableName = 'deadlines';
        dateField = 'due_date';
        updateData = { due_date: newDateString };
      } else if (draggedEvent.title && draggedEvent.due_date && draggedEvent.status) {
        // Task
        tableName = 'tasks';
        dateField = 'due_date';
        updateData = { due_date: newDateString };
      } else {
        toast({
          title: "Cannot Move Event",
          description: "This event type cannot be moved.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq('id', draggedEvent.id);

      if (error) throw error;

      toast({
        title: "Event Moved",
        description: `Event moved to ${format(targetDate, 'MMM dd, yyyy')}`,
      });

      await fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to Move Event",
        description: error.message || "Unable to move event. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDraggedEvent(null);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Calculate the calendar grid - start from the Sunday before the month starts
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());
  
  // End on the Saturday after the month ends
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()));
  
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    
    const deadlinesForDate = deadlines.filter(deadline => 
      deadline.due_date === dateString
    );
    
    const tasksForDate = tasks.filter(task => 
      task.due_date === dateString
    );
    
    const customEventsForDate = customEvents.filter(event => 
      event.event_date === dateString
    );
    
    return { deadlines: deadlinesForDate, tasks: tasksForDate, customEvents: customEventsForDate };
  };

  const getTypeColor = (type: string, isOverdue = false, isCompleted = false) => {
    if (isCompleted) return 'bg-green-600 opacity-75';
    if (isOverdue) return 'bg-red-600';
    
    switch (type) {
      case 'report': return 'bg-blue-600';
      case 'renewal': return 'bg-green-600';
      case 'closeout': return 'bg-red-600';
      case 'drawdown': return 'bg-orange-600';
      case 'meeting': return 'bg-purple-600';
      case 'deadline': return 'bg-yellow-600';
      case 'custom': return 'bg-indigo-600';
      case 'urgent': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-green-600';
      default: return 'bg-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-slate-900">Loading Calendar</h3>
            <p className="text-sm text-slate-600">Please wait while we load your grant calendar...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Grant Calendar</h1>
              <p className="text-slate-600">Grant Deadlines And Important Dates</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={syncWithCalendars} className="flex-1 md:flex-none">
              <RefreshCw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Refresh Calendar</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
            <Button variant="outline" onClick={testCalendarConnection} className="hidden md:flex">
              <Settings className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            
            <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-none">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Add Event</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Custom Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-title">Event Title *</Label>
                    <Input
                      id="event-title"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Meeting with stakeholders"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="event-description">Description</Label>
                    <Textarea
                      id="event-description"
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Event details..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Event Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-lg z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-type">Event Type</Label>
                      <Select 
                        value={eventForm.event_type} 
                        onValueChange={(value) => setEventForm(prev => ({ ...prev, event_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="deadline">Deadline</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="training">Training</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="event-time">Time (Optional)</Label>
                      <Input
                        id="event-time"
                        type="time"
                        value={eventForm.event_time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="related-grant">Related Grant (Optional)</Label>
                    <Select 
                      value={eventForm.grant_id} 
                      onValueChange={(value) => setEventForm(prev => ({ ...prev, grant_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a grant" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                        <SelectItem value="no-grant">No specific grant</SelectItem>
                        {grants.map(grant => (
                          <SelectItem key={grant.id} value={grant.id}>
                            {grant.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowEventDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createCustomEvent}>
                      Create Event
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Event Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-event-title">Event Title *</Label>
                    <Input
                      id="edit-event-title"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Meeting with stakeholders"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-event-description">Description</Label>
                    <Textarea
                      id="edit-event-description"
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Event details..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Event Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white border border-slate-200 shadow-lg z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {editingEvent?.event_type && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-event-type">Event Type</Label>
                          <Select 
                            value={eventForm.event_type} 
                            onValueChange={(value) => setEventForm(prev => ({ ...prev, event_type: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                              <SelectItem value="meeting">Meeting</SelectItem>
                              <SelectItem value="deadline">Deadline</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="training">Training</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="edit-event-time">Time (Optional)</Label>
                          <Input
                            id="edit-event-time"
                            type="time"
                            value={eventForm.event_time}
                            onChange={(e) => setEventForm(prev => ({ ...prev, event_time: e.target.value }))}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="edit-related-grant">Related Grant (Optional)</Label>
                        <Select 
                          value={eventForm.grant_id} 
                          onValueChange={(value) => setEventForm(prev => ({ ...prev, grant_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a grant" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                            <SelectItem value="no-grant">No specific grant</SelectItem>
                            {grants.map(grant => (
                              <SelectItem key={grant.id} value={grant.id}>
                                {grant.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between space-x-2">
                    <Button 
                      variant="destructive" 
                      onClick={deleteEvent}
                      disabled={!editingEvent}
                    >
                      Delete Event
                    </Button>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={updateEvent}>
                        Update Event
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-slate-900">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                ←
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentDate(new Date(2025, 7, 2))} // August 2, 2025
              >
                Today
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center font-medium text-slate-600 border-b">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Desktop Calendar View */}
            <div className="hidden md:grid grid-cols-7 gap-1">
              {monthDays.map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isToday = isSameDay(day, new Date(2025, 7, 2)); // August 2, 2025
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                
                return (
                  <div 
                    key={index}
                    className={`min-h-[120px] p-2 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors relative ${
                      isToday ? 'bg-blue-50 border-blue-300' : 
                      isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                    onClick={() => {
                      setSelectedDate(day);
                      setShowEventDialog(true);
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, day)}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-blue-900' : 
                      isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    
                    <div className="space-y-1">
                        {dayEvents.deadlines.map(deadline => {
                          const isOverdue = isPast(day) && !deadline.completed;
                          return (
                            <div
                              key={`deadline-${deadline.id}`}
                              className={`text-xs p-1 rounded text-white truncate relative cursor-move hover:opacity-80 ${getTypeColor(deadline.type, isOverdue, deadline.completed)}`}
                              title={`Deadline: ${deadline.name} - ${deadline.grants?.title} (${deadline.grants?.status})`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, deadline)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvent(deadline);
                              }}
                            >
                              {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                              {deadline.completed && <CheckCircle className="inline h-3 w-3 mr-1" />}
                              {deadline.name}
                            </div>
                          );
                        })}
                      
                        {dayEvents.tasks.map(task => {
                          const isOverdue = isPast(day) && task.status !== 'completed';
                          const isCompleted = task.status === 'completed';
                          return (
                            <div
                              key={`task-${task.id}`}
                              className={`text-xs p-1 rounded text-white truncate relative cursor-move hover:opacity-80 ${getTypeColor(task.priority, isOverdue, isCompleted)}`}
                              title={`Task: ${task.title} - ${task.grants?.title} (${task.assignee?.email || 'Unassigned'})`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, task)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEvent(task);
                              }}
                            >
                              {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                              {isCompleted && <CheckCircle className="inline h-3 w-3 mr-1" />}
                              <Clock className="inline h-3 w-3 mr-1" />
                              {task.title}
                            </div>
                          );
                        })}
                      
                        {dayEvents.customEvents.map(customEvent => (
                          <div
                            key={`custom-${customEvent.id}`}
                            className={`text-xs p-1 rounded text-white truncate relative cursor-move hover:opacity-80 ${getTypeColor(customEvent.event_type)}`}
                            title={`${customEvent.title} ${customEvent.event_time ? `at ${customEvent.event_time}` : ''}`}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, customEvent)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditEvent(customEvent);
                            }}
                          >
                            {customEvent.title}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Calendar View */}
            <div className="md:hidden space-y-3">
              {monthDays.filter(day => {
                const dayEvents = getEventsForDate(day);
                return dayEvents.deadlines.length > 0 || dayEvents.tasks.length > 0 || dayEvents.customEvents.length > 0;
              }).map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isToday = isSameDay(day, new Date(2025, 7, 2)); // August 2, 2025
                
                return (
                  <Card key={index} className={`${isToday ? 'border-blue-300 bg-blue-50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`font-medium ${isToday ? 'text-blue-900' : 'text-slate-900'}`}>
                          {format(day, 'EEEE, MMMM d')}
                        </h3>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedDate(day);
                            setShowEventDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        {dayEvents.deadlines.map(deadline => {
                          const isOverdue = isPast(day) && !deadline.completed;
                          return (
                            <div 
                              key={`deadline-${deadline.id}`} 
                              className="p-2 bg-white rounded border cursor-pointer hover:bg-slate-50 transition-colors"
                              onClick={() => handleEditEvent(deadline)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{deadline.name}</span>
                                <Badge className={getTypeColor(deadline.type, isOverdue, deadline.completed)}>
                                  {deadline.type}
                                </Badge>
                              </div>
                              {deadline.grants?.title && (
                                <p className="text-xs text-slate-600 mt-1">{deadline.grants.title}</p>
                              )}
                            </div>
                          );
                        })}
                        
                        {dayEvents.tasks.map(task => {
                          const isOverdue = isPast(day) && task.status !== 'completed';
                          const isCompleted = task.status === 'completed';
                          return (
                            <div 
                              key={`task-${task.id}`} 
                              className="p-2 bg-white rounded border cursor-pointer hover:bg-slate-50 transition-colors"
                              onClick={() => handleEditEvent(task)}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{task.title}</span>
                                <Badge className={getTypeColor(task.priority, isOverdue, isCompleted)}>
                                  {task.priority}
                                </Badge>
                              </div>
                              {task.assignee?.email && (
                                <p className="text-xs text-slate-600 mt-1">Assigned to: {task.assignee.email}</p>
                              )}
                            </div>
                          );
                        })}
                        
                        {dayEvents.customEvents.map(event => (
                          <div 
                            key={`event-${event.id}`} 
                            className="p-2 bg-white rounded border cursor-pointer hover:bg-slate-50 transition-colors"
                            onClick={() => handleEditEvent(event)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{event.title}</span>
                              <Badge className={getTypeColor(event.event_type)}>
                                {event.event_type}
                              </Badge>
                            </div>
                            {event.event_time && (
                              <p className="text-xs text-slate-600 mt-1">Time: {event.event_time}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Calendar Integration Section */}
        <div className="mt-8">
          <CalendarIntegration deadlines={deadlines} tasks={tasks} />
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;