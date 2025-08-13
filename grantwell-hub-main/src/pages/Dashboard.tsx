import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileText, 
  DollarSign, 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  Plus, 
  TrendingUp, 
  CheckSquare, 
  Target,
  Search,
  Clock,
  Award,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { PerformanceMetricsWidget } from '@/components/PerformanceMetricsWidget';
import { cn } from '@/lib/utils';
import { useGrantAccess } from '@/hooks/useGrantAccess';
import { WelcomeScreen } from '@/components/WelcomeScreen';

interface Grant {
  id: string;
  title: string;
  funder: string;
  amount_awarded: number;
  status: string;
  deadline?: string;
}

interface Deadline {
  id: string;
  name: string;
  due_date: string;
  type: string;
  grants: { title: string };
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string;
}

interface TrackedGrant {
  id: string;
  title: string;
  agency: string;
  deadline?: string;
  funding_amount_min?: number;
  funding_amount_max?: number;
  status: string;
  dateTracked: string;
}

interface StateGrant {
  id: string;
  title: string;
  agency: string;
  state: string;
  deadline?: string;
  funding_amount_min?: number;
  funding_amount_max?: number;
  status: string;
  external_url?: string;
  category?: string;
}

const Dashboard = () => {
  const { userRole, user } = useAuth();
  const { assignments, loading: accessLoading, hasAccess, refreshAccess } = useGrantAccess();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [trackedGrants, setTrackedGrants] = useState<TrackedGrant[]>([]);
  const [stateGrants, setStateGrants] = useState<StateGrant[]>([]);
  const [userState, setUserState] = useState<string | null>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Show welcome screen if user has no grant access
  if (!accessLoading && !hasAccess) {
    return <WelcomeScreen assignments={assignments} onRefresh={refreshAccess} />;
  }

  const fetchDashboardData = async () => {
    if (!user) {
      console.log('Dashboard: No user available, skipping data fetch');
      return;
    }

    console.log('Dashboard: Fetching data for user:', user.id);
    
    try {
      // Fetch grants
      const { data: grantsData } = await supabase
        .from('grants')
        .select('id, title, funder, amount_awarded, status')
        .order('created_at', { ascending: false });

      console.log('Dashboard: Fetched grants:', grantsData?.length || 0);

      // Fetch tracked grants from application_tracking (consistent with GrantsPage)
      let trackedGrantsData: TrackedGrant[] = [];
      const { data: trackingData, error: trackingError } = await supabase
        .from('application_tracking')
        .select('*')
        .eq('user_id', user.id);

      if (trackingError) {
        console.error('Dashboard: Error fetching tracked grants:', trackingError);
      } else {
        console.log('Dashboard: Fetched tracked grants:', trackingData?.length || 0);
      }

      trackedGrantsData = (trackingData || []).map((tracking: any) => ({
        id: tracking.grant_id,
        title: tracking.title,
        agency: tracking.agency,
        deadline: tracking.due_date,
        funding_amount_min: tracking.amount_min,
        funding_amount_max: tracking.amount_max,
        status: tracking.status || 'tracked',
        dateTracked: tracking.created_at
      }));

      console.log('Dashboard: Mapped tracked grants data:', trackedGrantsData);
      console.log('Dashboard: Tracked grants with deadlines (before filter):', 
        trackedGrantsData.map(g => ({ title: g.title, deadline: g.deadline }))
      );

      // Fetch deadlines from deadlines table
      const { data: deadlinesData } = await supabase
        .from('deadlines')
        .select(`
          id,
          name,
          due_date,
          type,
          grants (title)
        `)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      // Fetch custom calendar events with deadline type
      const { data: customDeadlineEvents } = await supabase
        .from('calendar_custom_events')
        .select(`
          id,
          title,
          event_date,
          event_type,
          grant_id
        `)
        .eq('event_type', 'deadline')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true });

      // Create deadlines from tracked grants
      const currentDate = new Date();
      console.log('Dashboard: Current date for filtering:', currentDate.toISOString());
      
      const trackedGrantDeadlines = trackedGrantsData
        .filter(grant => {
          const hasDeadline = grant.deadline;
          const isFuture = hasDeadline && new Date(grant.deadline) >= currentDate;
          console.log(`Dashboard: Grant "${grant.title}" - deadline: ${grant.deadline}, isFuture: ${isFuture}`);
          return hasDeadline && isFuture;
        })
        .map(grant => ({
          id: `tracked-${grant.id}`,
          name: `${grant.title} - Application Deadline`,
          due_date: grant.deadline!,
          type: 'grant_deadline',
          grants: { title: grant.title }
        }));

      console.log('Dashboard: Created tracked grant deadlines:', trackedGrantDeadlines.length);
      console.log('Dashboard: Tracked grants with deadlines:', trackedGrantDeadlines);

      // Convert custom calendar events to deadline format
      const customDeadlines = (customDeadlineEvents || []).map(event => ({
        id: `custom-${event.id}`,
        name: event.title,
        due_date: event.event_date,
        type: 'deadline',
        grants: { title: event.grant_id ? 'Related Grant' : 'No Grant' }
      }));

      console.log('Dashboard: Custom deadline events:', customDeadlines.length);

      // Combine deadlines and sort by date
      const allDeadlines = [...(deadlinesData || []), ...trackedGrantDeadlines, ...customDeadlines]
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);

      console.log('Dashboard: Final combined deadlines:', allDeadlines.length);

      // Fetch recent tasks (excluding completed tasks for priority view)
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, priority')
        .neq('status', 'completed')
        .order('due_date', { ascending: true })
        .limit(10);

      // Fetch user's state and state-specific grants
      const { data: profileData } = await supabase
        .from('profiles')
        .select('state')
        .eq('id', user.id)
        .single();

      let stateGrantsData: StateGrant[] = [];
      if (profileData?.state) {
        const { data: stateGrantsResponse } = await supabase
          .from('state_grants')
          .select('*')
          .eq('state', profileData.state)
          .eq('status', 'open')
          .order('deadline', { ascending: true })
          .limit(5);
        
        stateGrantsData = stateGrantsResponse || [];
      }

      setGrants(grantsData || []);
      setTrackedGrants(trackedGrantsData);
      setStateGrants(stateGrantsData);
      setUserState(profileData?.state || null);
      setDeadlines(allDeadlines);
      setTasks(tasksData || []);

      console.log('Dashboard: Final state set:', {
        grants: grantsData?.length || 0,
        trackedGrants: trackedGrantsData.length,
        deadlines: allDeadlines.length,
        tasks: tasksData?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const activeGrants = grants.filter(g => g.status === 'active');
  const totalAwarded = grants.reduce((sum, g) => sum + (g.amount_awarded || 0), 0);
  
  // Only count awarded tracked grants for total funding
  const awardedTrackedGrants = trackedGrants.filter(g => g.status === 'awarded');
  const trackedGrantsFunding = awardedTrackedGrants.reduce((sum, g) => {
    // Use max funding amount if available, otherwise min, otherwise 0
    const amount = g.funding_amount_max || g.funding_amount_min || 0;
    return sum + amount;
  }, 0);
  
  // Total funding should only show awarded tracked grants
  const totalFunding = trackedGrantsFunding;
  const urgentDeadlines = deadlines.filter(d => {
    const daysUntil = differenceInDays(new Date(d.due_date), new Date());
    return daysUntil <= 7;
  });
  const overdueTasks = tasks.filter(t => {
    return t.due_date && new Date(t.due_date) < new Date();
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getDaysUntilDeadline = (date: string) => {
    const today = new Date();
    const deadlineDate = new Date(date);
    
    // Set both dates to start of day to avoid timezone issues
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const days = differenceInDays(deadlineDate, today);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Overdue';
    return `${days} days`;
  };

  const getDeadlineBadgeClass = (date: string) => {
    const days = differenceInDays(new Date(date), new Date());
    const base = "inline-flex items-center gap-1.5";
    if (days < 0) return `${base} bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800`;
    if (days <= 7) return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
    return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
  };

  const getStatusBadgeClass = (status: string) => {
    const base = "inline-flex items-center gap-1.5";
    const s = (status || '').toLowerCase();
    if (["awarded", "closed", "completed"].includes(s)) {
      return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
    }
    return `${base} bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/30 dark:text-slate-200 dark:ring-slate-700`;
  };

  const getTaskPriorityClass = (priority: string) => {
    const base = "inline-flex items-center gap-1.5";
    const p = (priority || '').toLowerCase();
    switch (p) {
      case 'urgent':
        return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800`;
      case 'high':
        return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800`;
      case 'low':
        return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800`;
      case 'medium':
      default:
        return `${base} bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/30 dark:text-slate-200 dark:ring-slate-700`;
    }
  };
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = [] as Array<{ type: string; title: string; subtitle?: string; data: any }>;
    
    // Add deadlines for this date
    deadlines.forEach(deadline => {
      if (format(new Date(deadline.due_date), 'yyyy-MM-dd') === dateStr) {
        events.push({
          type: 'deadline',
          title: deadline.name,
          subtitle: deadline.grants?.title,
          data: deadline
        });
      }
    });
    
    // Add tasks for this date
    tasks.forEach(task => {
      if (task.due_date && format(new Date(task.due_date), 'yyyy-MM-dd') === dateStr) {
        events.push({
          type: 'task',
          title: task.title,
          subtitle: task.priority,
          data: task
        });
      }
    });
    
    return events;
  };

  const hasEventOnDate = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Grant Dashboard</h1>
            <p className="text-slate-600 mt-1">Track Your Grants, Deadlines, And Progress</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Tracked Grants</p>
                  <p className="text-3xl font-bold text-slate-900">{trackedGrants.length}</p>
                  <p className="text-xs text-slate-500 mt-1">{awardedTrackedGrants.length} Awarded</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Funding</p>
                  <p className="text-3xl font-bold text-slate-900">{formatCurrency(totalFunding)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {awardedTrackedGrants.length} Awarded Grants
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Urgent Deadlines</p>
                  <p className="text-3xl font-bold text-red-600">{urgentDeadlines.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Within 7 Days</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Overdue Tasks</p>
                  <p className="text-3xl font-bold text-orange-600">{overdueTasks.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Need Attention</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics Widget */}
        <PerformanceMetricsWidget />

        {/* Calendar and Recent Grants Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar with Events and Deadlines */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-slate-800 font-semibold">Calendar and Deadlines</CardTitle>
              <Button 
                variant="outline" 
                onClick={() => window.location.href = '/calendar'}
                className="text-slate-600 hover:text-slate-900"
              >
                View Calendar
              </Button>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <div className="grid grid-cols-5 gap-4">
                {/* Calendar - takes 3 columns */}
            <div className="col-span-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border border-slate-200 w-full"
                modifiers={{
                  hasEvent: (date) => hasEventOnDate(date),
                  overdue: (date) => getEventsForDate(date).some((e) => {
                    const d = new Date(format(date, 'yyyy-MM-dd'));
                    return d < new Date();
                  }),
                  urgent: (date) => {
                    const today = new Date();
                    const d = new Date(format(date, 'yyyy-MM-dd'));
                    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000*60*60*24));
                    return diff >= 0 && diff <= 7 && getEventsForDate(date).length > 0;
                  },
                }}
                modifiersClassNames={{
                  hasEvent: "relative after:content-[''] after:absolute after:top-1 after:right-1 after:w-2 after:h-2 after:rounded-full after:z-10 after:bg-blue-500",
                  urgent: "relative after:bg-amber-500",
                  overdue: "relative after:bg-red-500",
                }}
              />
            </div>
            
            {/* Deadlines Widget - takes 2 columns with maximized height */}
            <div className="col-span-2 flex flex-col h-full">
              <div className="flex-shrink-0 space-y-3">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" />
                  Upcoming Deadlines
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-2 pr-2">
                  {deadlines.slice(0, 5).map((deadline) => {
                    const daysUntil = getDaysUntilDeadline(deadline.due_date);
                    const isUrgent = urgentDeadlines.includes(deadline);
                    
                    return (
                      <div
                        key={deadline.id}
                        className={`p-2 rounded-lg border text-xs ${
                          isUrgent ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className={`font-medium ${isUrgent ? 'text-red-900' : 'text-slate-900'}`}>
                          {deadline.name}
                        </div>
                        <div className="text-slate-600 truncate">
                          {deadline.grants?.title || 'General'}
                        </div>
                        <div className={`font-medium ${
                          isUrgent ? 'text-red-700' : 'text-slate-700'
                        }`}>
                          {daysUntil}
                        </div>
                      </div>
                    );
                  })}
                  {deadlines.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-xs">
                      <Clock className="h-6 w-6 mx-auto mb-2" />
                      No upcoming deadlines
                    </div>
                  )}
                </div>
              </div>
            </div>
              </div>
              
              {/* Events for Selected Date */}
              {selectedDate && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-semibold text-slate-900 text-sm mb-3">
                    Events for {format(selectedDate, 'MMMM d, yyyy')}
                  </h4>
                  {getEventsForDate(selectedDate).length === 0 ? (
                    <p className="text-sm text-slate-500">No events on this date</p>
                  ) : (
                    <div className="space-y-2">
                      {getEventsForDate(selectedDate).map((event, index) => (
                        <div
                          key={`${event.type}-${index}`}
                          className="p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium text-slate-900 text-sm mb-1">
                            {event.title}
                          </div>
                          <div className="text-xs text-slate-600">
                            {event.type === 'deadline' 
                              ? `Deadline for ${event.subtitle || 'Unknown Grant'}`
                              : event.subtitle || 'Calendar Event'
                            }
                          </div>
                          {event.type === 'deadline' && event.data && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "mt-2 text-xs",
                                getTaskPriorityClass(event.data.priority || 'medium')
                              )}
                            >
                              {event.data.priority || 'medium'} priority
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upcoming Deadlines duplicate removed for simplicity */}
            </CardContent>
          </Card>
          
          {/* Recent Grants */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-800 font-semibold">Recent Grants</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/grants">
                  <Target className="h-4 w-4 mr-2" />
                  View All
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {grants.length > 0 ? (
                <div className="space-y-4">
                  {grants.slice(0, 5).map((grant) => (
                    <Link
                      key={grant.id}
                      to={`/grants/${grant.id}`}
                      className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{grant.title}</div>
                          <div className="text-sm text-slate-600">{grant.funder}</div>
                          <div className="text-sm font-medium text-green-600 mt-1">
                            {formatCurrency(grant.amount_awarded || 0)}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="outline"
                            className={getStatusBadgeClass(grant.status)}
                          >
                            {grant.status}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No Grants Yet</p>
                  <Button asChild>
                    <Link to="/grants">
                      <Search className="h-4 w-4 mr-2" />
                      Find Your First Grant
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* State Grants Section */}
        {userState && stateGrants.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-800 font-semibold">Available Grants in {userState}</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/grants">
                  <Search className="h-4 w-4 mr-2" />
                  View All
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stateGrants.map((grant) => {
                  const daysUntilDeadline = grant.deadline ? getDaysUntilDeadline(grant.deadline) : null;
                  const isUrgent = grant.deadline && differenceInDays(new Date(grant.deadline), new Date()) <= 14;
                  
                  return (
                    <div
                      key={grant.id}
                      className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">{grant.title}</div>
                          <div className="text-sm text-slate-600">{grant.agency}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {grant.category && (
                              <Badge variant="outline" className="text-xs">
                                {grant.category}
                              </Badge>
                            )}
                            {grant.funding_amount_min && grant.funding_amount_max && (
                              <span className="text-sm text-green-600 font-medium">
                                {formatCurrency(grant.funding_amount_min)} - {formatCurrency(grant.funding_amount_max)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          {grant.deadline && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${isUrgent ? 'border-red-500 text-red-700 bg-red-50' : 'border-slate-400'}`}
                            >
                              Due: {format(new Date(grant.deadline), 'MMM dd, yyyy')}
                            </Badge>
                          )}
                          {grant.external_url && (
                            <Button asChild size="sm" variant="outline">
                              <a href={grant.external_url} target="_blank" rel="noopener noreferrer">
                                <ArrowRight className="h-3 w-3 mr-1" />
                                Apply
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Priority Tasks */}
        {tasks.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-800 font-semibold">Priority Tasks</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link to="/tasks">
                  <CheckSquare className="h-4 w-4 mr-2" />
                  View All Tasks
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date();
                  
                  return (
                    <div key={task.id} className={`p-4 rounded-lg border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-slate-900 text-sm">{task.title}</div>
                        <Badge className={getTaskPriorityClass(task.priority)} variant="outline">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.due_date && (
                        <div className={`text-xs ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                          Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                          {isOverdue && ' (Overdue)'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;