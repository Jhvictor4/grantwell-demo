import React, { useState, useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Target,
  Filter,
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { logger } from '@/lib/logger';
import { COMPLIANCE_LABEL } from '@/lib/compliance-labels';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'deadline' | 'task' | 'milestone' | 'report' | 'compliance';
  status: string;
  priority?: string;
  grant_title?: string;
  description?: string;
}

interface EventFilters {
  deadlines: boolean;
  tasks: boolean;
  milestones: boolean;
  reports: boolean;
  compliance: boolean;
}

export function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  
  const [filters, setFilters] = useState<EventFilters>({
    deadlines: true,
    tasks: true,
    milestones: true,
    reports: true,
    compliance: true
  });

  useEffect(() => {
    fetchCalendarEvents();
  }, [currentMonth]);

  useEffect(() => {
    applyFilters();
  }, [events, filters]);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      // Expand date range to show more historical and future data
      const monthStart = subMonths(startOfMonth(currentMonth), 6); // 6 months back
      const monthEnd = addMonths(endOfMonth(currentMonth), 6); // 6 months forward

      // Fetch deadlines
      const { data: deadlinesData } = await supabase
        .from('deadlines')
        .select(`
          id,
          name,
          due_date,
          type,
          completed,
          grant_id
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status,
          priority,
          description,
          grant_id
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch milestones
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select(`
          id,
          name,
          due_date,
          status,
          grant_id
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch report logs
      const { data: reportsData } = await supabase
        .from('report_logs')
        .select(`
          id,
          type,
          due_date,
          submitted_on,
          grant_id
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch compliance checklist
      const { data: complianceData } = await supabase
        .from('compliance_checklist')
        .select(`
          id,
          item_name,
          due_date,
          is_complete,
          grant_id
        `)
        .gte('due_date', monthStart.toISOString().split('T')[0])
        .lte('due_date', monthEnd.toISOString().split('T')[0]);

      // Fetch compliance events
      const { data: complianceEvents } = await supabase
        .from('compliance_events')
        .select(`
          id,
          type,
          due_on,
          status,
          grant_id
        `)
        .gte('due_on', monthStart.toISOString().split('T')[0])
        .lte('due_on', monthEnd.toISOString().split('T')[0]);

      // Fetch grants for title lookup
      const { data: grantsData } = await supabase
        .from('grants')
        .select('id, title');

      // Transform data into calendar events
      const calendarEvents: CalendarEvent[] = [];
      
      // Create grant lookup map
      const grantsMap = new Map(grantsData?.map(grant => [grant.id, grant.title]) || []);

      // Add deadlines
      deadlinesData?.forEach(deadline => {
        calendarEvents.push({
          id: `deadline-${deadline.id}`,
          title: deadline.name,
          date: parseISO(deadline.due_date),
          type: 'deadline',
          status: deadline.completed ? 'completed' : 'pending',
          grant_title: grantsMap.get(deadline.grant_id)
        });
      });

      // Add tasks
      tasksData?.forEach(task => {
        if (task.due_date) {
          calendarEvents.push({
            id: `task-${task.id}`,
            title: task.title,
            date: parseISO(task.due_date),
            type: 'task',
            status: task.status,
            priority: task.priority,
            grant_title: grantsMap.get(task.grant_id),
            description: task.description
          });
        }
      });

      // Add milestones
      milestonesData?.forEach(milestone => {
        calendarEvents.push({
          id: `milestone-${milestone.id}`,
          title: milestone.name,
          date: parseISO(milestone.due_date),
          type: 'milestone',
          status: milestone.status,
          grant_title: grantsMap.get(milestone.grant_id)
        });
      });

      // Add reports
      reportsData?.forEach(report => {
        calendarEvents.push({
          id: `report-${report.id}`,
          title: `${report.type} Report`,
          date: parseISO(report.due_date),
          type: 'report',
          status: report.submitted_on ? 'completed' : 'pending',
          grant_title: grantsMap.get(report.grant_id)
        });
      });

      // Add compliance items
      complianceData?.forEach(item => {
        if (item.due_date) {
          calendarEvents.push({
            id: `compliance-${item.id}`,
            title: item.item_name,
            date: parseISO(item.due_date),
            type: 'compliance',
            status: item.is_complete ? 'completed' : 'pending',
            grant_title: grantsMap.get(item.grant_id)
          });
        }
      });

      // Add compliance events table
      complianceEvents?.forEach(ev => {
        calendarEvents.push({
          id: `compliance-event-${ev.id}`,
          title: ev.type ? `${ev.type}` : COMPLIANCE_LABEL,
          date: parseISO(ev.due_on),
          type: 'compliance',
          status: ev.status || 'Due',
          grant_title: grantsMap.get(ev.grant_id)
        });
      });

      setEvents(calendarEvents);
    } catch (error) {
      logger.error('Error fetching calendar events', error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const filtered = events.filter(event => {
      return filters[`${event.type}s` as keyof EventFilters];
    });
    setFilteredEvents(filtered);
  };

  const getEventColor = (event: CalendarEvent) => {
    const colors = {
      deadline: 'bg-red-100 text-red-800 border-red-200',
      task: 'bg-blue-100 text-blue-800 border-blue-200',
      milestone: 'bg-green-100 text-green-800 border-green-200',
      report: 'bg-purple-100 text-purple-800 border-purple-200',
      compliance: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[event.type];
  };

  const getEventIcon = (type: string) => {
    const icons = {
      deadline: AlertTriangle,
      task: CheckCircle,
      milestone: Target,
      report: FileText,
      compliance: Clock
    };
    const Icon = icons[type as keyof typeof icons];
    return Icon ? <Icon className="h-3 w-3" /> : null;
  };

  const computeBadgeClass = (event: CalendarEvent) => {
    const base = "inline-flex items-center gap-1.5";
    const today = new Date();
    if (event.status && ['completed','closed'].includes(event.status.toLowerCase())) {
      return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
    }
    const days = isSameDay(event.date, today) ? 0 : Math.ceil((event.date.getTime() - today.getTime()) / (1000*60*60*24));
    if (days < 0) return `${base} bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800`;
    if (days <= 7) return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
    return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, date));
  };

  const getUrgentEvents = () => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    return filteredEvents.filter(event => 
      isAfter(event.date, today) && 
      isBefore(event.date, nextWeek) && 
      event.status !== 'completed'
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentMonth(subMonths(currentMonth, 1));
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const urgentEvents = getUrgentEvents();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
          <p className="text-muted-foreground">
            Comprehensive view of deadlines, tasks, milestones, and compliance items.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={goToToday}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Today
          </Button>
          <Select value={viewMode} onValueChange={(value: 'month' | 'agenda') => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="agenda">Agenda</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Event Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(filters).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={value}
                  onCheckedChange={(checked) => 
                    setFilters(prev => ({ ...prev, [key]: checked }))
                  }
                />
                <label htmlFor={key} className="text-sm font-medium capitalize">
                  {key.replace('s', '')}s
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'month' | 'agenda')} className="space-y-6">
        <TabsContent value="month" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    className="rounded-md border"
                    showOutsideDays={true}
                    components={{
                      DayContent: ({ date }) => {
                        const dayEvents = getEventsForDate(date);
                        return (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                 <div 
                                   className="relative w-full h-full cursor-pointer hover:bg-accent/50 rounded transition-colors flex items-center justify-center"
                                   onClick={() => setSelectedDate(date)}
                                   aria-label={`Select ${format(date, 'MMMM d, yyyy')}${dayEvents.length > 0 ? ` (${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''})` : ''}`}
                                 >
                                   <span>{date.getDate()}</span>
                                   {dayEvents.length > 0 && (
                                     <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"></div>
                                   )}
                                 </div>
                              </TooltipTrigger>
                              {dayEvents.length > 0 && (
                                <TooltipContent side="top" className="max-w-80 p-3">
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm">
                                      {format(date, 'MMM dd, yyyy')} ({dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''})
                                    </div>
                                    {dayEvents.slice(0, 4).map((event, idx) => (
                                       <div key={idx} className="flex items-start space-x-2 text-xs">
                                         <div className={`w-2 h-2 rounded-full mt-1 ${
                                           event.type === 'deadline' ? 'bg-red-500' :
                                           event.type === 'task' ? 'bg-blue-500' :
                                           event.type === 'milestone' ? 'bg-green-500' :
                                           event.type === 'report' ? 'bg-purple-500' :
                                           'bg-orange-500'
                                         }`} />
                                         <div className="flex-1">
                                           <div className="font-medium">{event.title}</div>
                                           <div className="text-muted-foreground">
                                             {event.type === 'deadline' ? '• Deadline' : 
                                              event.type === 'task' ? '• Task' : 
                                              event.type === 'milestone' ? '• Milestone' :
                                              event.type === 'report' ? '• Report' :
                                              '• Compliance'}
                                             {event.grant_title && ` • ${event.grant_title}`}
                                             {event.status && ` • ${event.status}`}
                                             {event.priority && ` • ${event.priority} priority`}
                                           </div>
                                          {event.description && (
                                            <div className="text-muted-foreground mt-1">
                                              {event.description.length > 60 
                                                ? `${event.description.substring(0, 60)}...` 
                                                : event.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {dayEvents.length > 4 && (
                                      <div className="text-xs text-muted-foreground text-center pt-1">
                                        ...and {dayEvents.length - 4} more event{dayEvents.length - 4 !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Selected Date Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Select a date'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((event) => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getEventColor(event)}`}
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowEventDialog(true);
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              {getEventIcon(event.type)}
                              <div>
                                <div className="font-medium text-sm">{event.title}</div>
                                <div className="text-xs opacity-75">{event.grant_title}</div>
                              </div>
                            </div>
                            <Badge variant="outline" className={`${computeBadgeClass(event)} text-xs`}>
                              {event.type}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No events for this date</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Urgent Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
                    Urgent (Next 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {urgentEvents.slice(0, 5).map((event) => (
                      <div
                        key={event.id}
                        className="p-2 rounded-lg bg-orange-50 border border-orange-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{event.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(event.date, 'MMM dd')}
                            </div>
                          </div>
                          <Badge variant="outline" className={`${computeBadgeClass(event)} text-xs`}>
                            {event.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {urgentEvents.length === 0 && (
                      <p className="text-sm text-muted-foreground">No urgent items</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agenda">
          <Card>
            <CardHeader>
              <CardTitle>Agenda View - {format(currentMonth, 'MMMM yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEvents
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((event) => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border ${getEventColor(event)} cursor-pointer hover:shadow-md transition-shadow`}
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDialog(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getEventIcon(event.type)}
                          <div>
                            <div className="font-medium">{event.title}</div>
                            <div className="text-sm opacity-75">{event.grant_title}</div>
                            {event.description && (
                              <div className="text-sm opacity-75 mt-1">{event.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{format(event.date, 'MMM dd, yyyy')}</div>
                          <Badge variant="outline" className={`${computeBadgeClass(event)} mt-1`}>
                            {event.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredEvents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No events found for the current filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedEvent && getEventIcon(selectedEvent.type)}
              <span>{selectedEvent?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedEvent.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedEvent.date, 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <p className="text-sm text-muted-foreground capitalize">{selectedEvent.status}</p>
                </div>
                {selectedEvent.priority && (
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <p className="text-sm text-muted-foreground capitalize">{selectedEvent.priority}</p>
                  </div>
                )}
              </div>
              {selectedEvent.grant_title && (
                <div>
                  <label className="text-sm font-medium">Grant</label>
                  <p className="text-sm text-muted-foreground">{selectedEvent.grant_title}</p>
                </div>
              )}
              {selectedEvent.description && (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}