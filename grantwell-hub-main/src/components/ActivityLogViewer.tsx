import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { 
  Activity, 
  Filter, 
  CalendarIcon, 
  User, 
  FileText, 
  CheckSquare, 
  Building, 
  RefreshCw,
  Search,
  Download,
  Eye,
  Clock
} from 'lucide-react';

interface ActivityLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_data: any;
  performed_at: string;
  performed_by: string | null;
  user_email?: string;
}

interface ActivityLogViewerProps {
  grantId?: string; // If provided, show only activities for this grant
  userId?: string;  // If provided, show only activities for this user
  compact?: boolean; // Compact view for smaller spaces
}

const ENTITY_TYPE_ICONS = {
  grants: FileText,
  tasks: CheckSquare,
  documents: FileText,
  organization_settings: Building,
  profiles: User,
  grant_team_assignments: User,
  team_invitations: User,
  default: Activity
};

const EVENT_TYPE_COLORS = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  completed: 'bg-purple-100 text-purple-800',
  default: 'bg-gray-100 text-gray-800'
};

export const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({
  grantId,
  userId,
  compact = false
}) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredActivities, setFilteredActivities] = useState<ActivityLogEntry[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [grantId, userId]);

  useEffect(() => {
    applyFilters();
  }, [activities, searchTerm, selectedEntityType, selectedEventType, selectedUser, dateRange]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('data_lifecycle_events')
        .select(`
          *,
          profiles!data_lifecycle_events_performed_by_fkey(email)
        `)
        .order('performed_at', { ascending: false })
        .limit(200);

      // Apply filters based on props
      if (grantId) {
        query = query.or(`entity_id.eq.${grantId},event_data->grant_id.eq.${grantId}`);
      }

      if (userId) {
        query = query.eq('performed_by', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const activitiesWithUserInfo = data?.map(activity => ({
        ...activity,
        user_email: (activity as any).profiles?.email || 'Unknown User'
      })) || [];

      setActivities(activitiesWithUserInfo);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast({
        title: "Error",
        description: "Failed to load activity log",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...activities];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(activity => 
        activity.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(activity.event_data).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Entity type filter
    if (selectedEntityType !== 'all') {
      filtered = filtered.filter(activity => activity.entity_type === selectedEntityType);
    }

    // Event type filter
    if (selectedEventType !== 'all') {
      filtered = filtered.filter(activity => activity.event_type === selectedEventType);
    }

    // User filter
    if (selectedUser !== 'all') {
      filtered = filtered.filter(activity => activity.performed_by === selectedUser);
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(activity => {
        const activityDate = new Date(activity.performed_at);
        const isAfterFrom = !dateRange.from || activityDate >= dateRange.from;
        const isBeforeTo = !dateRange.to || activityDate <= dateRange.to;
        return isAfterFrom && isBeforeTo;
      });
    }

    setFilteredActivities(filtered);
  };

  const getEntityIcon = (entityType: string) => {
    const IconComponent = ENTITY_TYPE_ICONS[entityType as keyof typeof ENTITY_TYPE_ICONS] || ENTITY_TYPE_ICONS.default;
    return <IconComponent className="h-4 w-4" />;
  };

  const getEventTypeColor = (eventType: string) => {
    return EVENT_TYPE_COLORS[eventType as keyof typeof EVENT_TYPE_COLORS] || EVENT_TYPE_COLORS.default;
  };

  const formatEventDescription = (activity: ActivityLogEntry) => {
    const { entity_type, event_type, event_data } = activity;
    
    switch (entity_type) {
      case 'grants':
        if (event_type === 'created') return `Created new grant: ${event_data?.title || 'Untitled'}`;
        if (event_type === 'updated') return `Updated grant settings`;
        if (event_type === 'deleted') return `Deleted grant`;
        break;
      
      case 'tasks':
        if (event_type === 'created') return `Created ${event_data?.count || 1} task(s)`;
        if (event_type === 'updated') return `Updated task status or details`;
        if (event_type === 'completed') return `Completed task`;
        break;
      
      case 'organization_settings':
        if (event_type === 'created') return `Set up organization: ${event_data?.organization_name}`;
        if (event_type === 'updated') return `Updated organization settings`;
        break;
      
      case 'team_invitations':
        if (event_type === 'created') return `Invited ${event_data?.invited_count || 1} team member(s)`;
        break;
      
      default:
        return `${event_type.charAt(0).toUpperCase() + event_type.slice(1)} ${entity_type.replace('_', ' ')}`;
    }
    
    return `${event_type.charAt(0).toUpperCase() + event_type.slice(1)} ${entity_type.replace('_', ' ')}`;
  };

  const exportActivities = () => {
    const csvContent = [
      ['Date', 'User', 'Action', 'Entity', 'Details'].join(','),
      ...filteredActivities.map(activity => [
        new Date(activity.performed_at).toLocaleString(),
        activity.user_email || 'Unknown',
        activity.event_type,
        activity.entity_type,
        formatEventDescription(activity).replace(/,/g, ';')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const uniqueEntityTypes = [...new Set(activities.map(a => a.entity_type))];
  const uniqueEventTypes = [...new Set(activities.map(a => a.event_type))];
  const uniqueUsers = [...new Set(activities.map(a => ({ id: a.performed_by, email: a.user_email })))]
    .filter(u => u.id);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Recent Activity</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadActivities}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-4 text-slate-500">Loading...</div>
              ) : filteredActivities.length === 0 ? (
                <div className="text-center py-4 text-slate-500">No activities found</div>
              ) : (
                filteredActivities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-2 p-2 rounded hover:bg-slate-50">
                    <div className="mt-1">{getEntityIcon(activity.entity_type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">
                        {formatEventDescription(activity)}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {activity.user_email}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(activity.performed_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Activity Log</h2>
            <p className="text-slate-600">Track all system activities and changes</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportActivities}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadActivities}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Entity Type</label>
                <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueEntityTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Event Type</label>
                <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {uniqueEventTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">User</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user.id} value={user.id || ''}>
                        {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <div className="flex items-center space-x-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {dateRange.from ? format(dateRange.from, 'MMM d') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <span className="text-slate-500">to</span>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {dateRange.to ? format(dateRange.to, 'MMM d') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(dateRange.from || dateRange.to) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDateRange({})}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Activities ({filteredActivities.length})
            </CardTitle>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              Loading activities...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activities found</p>
              <p className="text-sm">Try adjusting your filters or check back later</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      {getEntityIcon(activity.entity_type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {formatEventDescription(activity)}
                        </p>
                        
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {activity.user_email?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-slate-600">
                              {activity.user_email}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 text-sm text-slate-500">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(new Date(activity.performed_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge className={getEventTypeColor(activity.event_type)}>
                          {activity.event_type}
                        </Badge>
                        <Badge variant="outline">
                          {activity.entity_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {/* Additional event data */}
                    {activity.event_data && Object.keys(activity.event_data).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                          View details
                        </summary>
                        <pre className="text-xs text-slate-600 mt-2 p-2 bg-slate-50 rounded overflow-x-auto">
                          {JSON.stringify(activity.event_data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};