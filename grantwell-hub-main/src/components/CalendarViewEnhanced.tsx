import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar as CalendarIcon, Clock, Target, FileText, Users, AlertTriangle } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'task' | 'milestone' | 'report' | 'custom';
  status?: string;
  priority?: string;
  grant_title?: string;
  description?: string;
}

interface Grant {
  id: string;
  title: string;
}

export const CalendarViewEnhanced: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    deadlines: true,
    tasks: true,
    milestones: true,
    reports: true,
    custom: true
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: new Date(),
    event_time: '',
    grant_id: ''
  });

  useEffect(() => {
    fetchCalendarEvents();
    fetchGrants();
  }, [currentMonth]);

  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch deadlines
      const { data: deadlines } = await supabase
        .from('deadlines')
        .select(`
          id, name, due_date, type,
          grants!inner(title)
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, priority, grant_id')
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch milestones
      const { data: milestones } = await supabase
        .from('milestones')
        .select('id, name, due_date, status, grant_id')
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch report logs
      const { data: reports } = await supabase
        .from('report_logs')
        .select('id, type, due_date, grant_id')
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch compliance events (SF-425, Narrative)
      const { data: compliance } = await supabase
        .from('compliance_events')
        .select('id, type, due_on, grant_id, status')
        .gte('due_on', monthStart.toISOString().split('T')[0])
        .lte('due_on', monthEnd.toISOString().split('T')[0]);

      // Fetch custom events
      const { data: customEvents } = await supabase
        .from('calendar_custom_events')
        .select(`
          id, title, description, event_date,
          grants(title)
        `)
        .gte('event_date', monthStart.toISOString().split('T')[0])
        .lte('event_date', monthEnd.toISOString().split('T')[0]);

      // Get grant titles for mapping
      const grantTitles = grants.reduce((acc, grant) => {
        acc[grant.id] = grant.title;
        return acc;
      }, {} as Record<string, string>);

      // Transform and combine all events
      const allEvents: CalendarEvent[] = [
        ...(deadlines || []).map(d => ({
          id: d.id,
          title: d.name,
          date: d.due_date,
          type: 'deadline' as const,
          grant_title: d.grants?.title
        })),
        ...(tasks || []).map(t => ({
          id: t.id,
          title: t.title,
          date: t.due_date,
          type: 'task' as const,
          status: t.status,
          priority: t.priority,
          grant_title: grantTitles[t.grant_id]
        })),
        ...(milestones || []).map(m => ({
          id: m.id,
          title: m.name,
          date: m.due_date,
          type: 'milestone' as const,
          status: m.status,
          grant_title: grantTitles[m.grant_id]
        })),
        ...(reports || []).map(r => ({
          id: r.id,
          title: `${r.type} Report`,
          date: r.due_date,
          type: 'report' as const,
          grant_title: grantTitles[r.grant_id]
        })),
        ...(compliance || []).map(c => ({
          id: c.id,
          title: `${c.type}`,
          date: c.due_on,
          type: 'report' as const,
          status: c.status,
          grant_title: grantTitles[c.grant_id]
        })),
        ...(customEvents || []).map(c => ({
          id: c.id,
          title: c.title,
          date: c.event_date,
          type: 'custom' as const,
          description: c.description,
          grant_title: c.grants?.title
        }))
      ];

      setEvents(allEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGrants = async () => {
    try {
      const { data, error } = await supabase.from('grants').select('id, title');
      if (error) throw error;
      setGrants(data || []);
    } catch (error) {
      console.error('Error fetching grants:', error);
    }
  };

  const applyFilters = () => {
    const filtered = events.filter(event => {
      switch (event.type) {
        case 'deadline': return filters.deadlines;
        case 'task': return filters.tasks;
        case 'milestone': return filters.milestones;
        case 'report': return filters.reports;
        case 'custom': return filters.custom;
        default: return true;
      }
    });
    setFilteredEvents(filtered);
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'deadline': return 'bg-red-100 text-red-800 border-red-200';
      case 'task': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'milestone': return 'bg-green-100 text-green-800 border-green-200';
      case 'report': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'custom': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'deadline': return AlertTriangle;
      case 'task': return Clock;
      case 'milestone': return Target;
      case 'report': return FileText;
      case 'custom': return CalendarIcon;
      default: return CalendarIcon;
    }
  };

  const computeTypeBadgeClass = (event: CalendarEvent) => {
    const base = "inline-flex items-center gap-1.5";
    const today = new Date();
    if (event.status && ['completed','closed'].includes((event.status || '').toLowerCase())) {
      return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
    }
    const d = new Date(event.date);
    const days = isSameDay(d, today) ? 0 : Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24));
    if (days < 0) return `${base} bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800`;
    if (days <= 7) return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
    return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
  };

  const computeStatusBadgeClass = (status?: string) => {
    const base = "inline-flex items-center gap-1.5";
    const s = (status || '').toLowerCase();
    if (['completed','closed'].includes(s)) return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
    if (s === 'overdue') return `${base} bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800`;
    return `${base} bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/30 dark:text-slate-200 dark:ring-slate-700`;
  };

  const computePriorityBadgeClass = (priority?: string) => {
    const base = "inline-flex items-center gap-1.5";
    const p = (priority || '').toLowerCase();
    if (p === 'urgent') return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
    if (p === 'low') return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
    return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => 
      isSameDay(new Date(event.date), date)
    );
  };

  const handleCreateCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const { error } = await supabase.from('calendar_custom_events').insert([{
        title: formData.title,
        description: formData.description,
        event_date: formData.event_date.toISOString().split('T')[0],
        event_time: formData.event_time || null,
        grant_id: formData.grant_id || null,
        created_by: user?.id
      }]);

      if (error) throw error;

      toast({ title: "Success", description: "Event created successfully" });
      setFormData({
        title: '',
        description: '',
        event_date: new Date(),
        event_time: '',
        grant_id: ''
      });
      setIsDialogOpen(false);
      fetchCalendarEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  if (loading) {
    return <div className="p-6">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Calendar View</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goToToday}>Today</Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCustomEvent} className="space-y-4">
                <div>
                  <Label htmlFor="title">Event Title</Label>
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
                    <Label htmlFor="event_date">Date</Label>
                    <Input
                      id="event_date"
                      type="date"
                      value={formData.event_date.toISOString().split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, event_date: new Date(e.target.value) })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="event_time">Time (optional)</Label>
                    <Input
                      id="event_time"
                      type="time"
                      value={formData.event_time}
                      onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Related Grant (optional)</Label>
                  <Select value={formData.grant_id} onValueChange={(value) => setFormData({ ...formData, grant_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a grant" />
                    </SelectTrigger>
                    <SelectContent>
                      {grants.map((grant) => (
                        <SelectItem key={grant.id} value={grant.id}>
                          {grant.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Event</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Event Type Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(filters).map(([key, value]) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.checked })}
                  className="rounded"
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                    ←
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                    →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
                components={{
                  Day: ({ date, ...props }) => {
                    const dayEvents = getEventsForDate(date);
                    return (
                      <div className="relative w-full h-full p-1">
                        <button
                          {...props}
                          className={`w-full h-full min-h-[2.5rem] text-sm rounded ${
                            isSameDay(date, selectedDate) ? 'bg-primary text-primary-foreground' : ''
                          } ${isSameDay(date, new Date()) ? 'ring-2 ring-primary' : ''}`}
                        >
                          {date.getDate()}
                          {dayEvents.length > 0 && (
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                              {dayEvents.slice(0, 3).map((event, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    event.type === 'deadline' ? 'bg-red-500' :
                                    event.type === 'task' ? 'bg-blue-500' :
                                    event.type === 'milestone' ? 'bg-green-500' :
                                    event.type === 'report' ? 'bg-purple-500' :
                                    'bg-gray-500'
                                  }`}
                                />
                              ))}
                              {dayEvents.length > 3 && (
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              )}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Events Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Events for {format(selectedDate, 'MMM dd, yyyy')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getEventsForDate(selectedDate).map((event) => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div key={event.id} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-2">
                        <Icon className="h-4 w-4 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{event.title}</h4>
                          {event.grant_title && (
                            <p className="text-xs text-muted-foreground">{event.grant_title}</p>
                          )}
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                          )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`${computeTypeBadgeClass(event)} text-xs`}>
                                {event.type}
                              </Badge>
                              {event.status && (
                                <Badge className={`${computeStatusBadgeClass(event.status)} text-xs`}>
                                  {event.status}
                                </Badge>
                              )}
                              {event.priority && (
                                <Badge className={`${computePriorityBadgeClass(event.priority)} text-xs`}>
                                  {event.priority}
                                </Badge>
                              )}
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {getEventsForDate(selectedDate).length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No events for this date
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredEvents
                  .filter(event => new Date(event.date) >= new Date())
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 5)
                  .map((event) => {
                    const Icon = getEventIcon(event.type);
                    return (
                      <div key={event.id} className="flex items-center gap-2 p-2 rounded border">
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.date), 'MMM dd')}
                          </p>
                        </div>
                        <Badge className={`${computeTypeBadgeClass(event)} text-xs`}>
                          {event.type}
                        </Badge>
                      </div>
                    );
                  })}
                
                {filteredEvents.filter(event => new Date(event.date) >= new Date()).length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    No upcoming events
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};