import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  Activity, 
  Clock, 
  User, 
  FileText, 
  CheckSquare, 
  DollarSign,
  Users,
  Filter,
  Calendar,
  Download,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  entity_type: string;
  event_type: string;
  event_data: any;
  performed_by: string;
  performed_at: string;
  user_email?: string;
  entity_name?: string;
  tags?: string[];
}

interface ActivityLogProps {
  grantId?: string;
  limit?: number;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ grantId, limit = 50 }) => {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [users, setUsers] = useState<any[]>([]);
  const { userRole } = useAuth();

  useEffect(() => {
    fetchActivities();
    fetchUsers();
  }, [grantId, filter, userFilter, tagFilter]);

  const fetchActivities = async () => {
    try {
      let query = supabase
        .from('data_lifecycle_events')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(limit);

      if (filter !== 'all') {
        query = query.eq('event_type', filter);
      }

      if (userFilter !== 'all') {
        query = query.eq('performed_by', userFilter);
      }

      // Filter by grant-related entities if grantId is provided
      if (grantId) {
        query = query.or(`entity_id.eq.${grantId},event_data->>grant_id.eq.${grantId}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrich activities with entity names and user emails
      const enrichedActivities = await Promise.all(
        (data || []).map(async (activity) => {
          let entityName = activity.entity_id;
          let userEmail = 'System';
          
          // Fetch user email
          if (activity.performed_by) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', activity.performed_by)
                .single();
              userEmail = profile?.email || 'Unknown User';
            } catch (error) {
              // Keep default
            }
          }
          
          // Try to get readable names for entities
          try {
            switch (activity.entity_type) {
              case 'grants':
                const { data: grant } = await supabase
                  .from('grants')
                  .select('title')
                  .eq('id', activity.entity_id)
                  .single();
                entityName = grant?.title || activity.entity_id;
                break;
              case 'tasks':
                const { data: task } = await supabase
                  .from('tasks')
                  .select('title')
                  .eq('id', activity.entity_id)
                  .single();
                entityName = task?.title || activity.entity_id;
                break;
              case 'documents':
                const { data: doc } = await supabase
                  .from('documents')
                  .select('file_name')
                  .eq('id', activity.entity_id)
                  .single();
                entityName = doc?.file_name || activity.entity_id;
                break;
            }
          } catch (error) {
            // Keep original entity_id if we can't fetch the name
          }

          // Auto-tag entries based on content
          const autoTags = [];
          const eventData = activity.event_data as any;
          if (activity.entity_type === 'expenses' || (eventData && eventData.amount)) {
            autoTags.push('reimbursement');
          }
          if (activity.entity_type === 'deadlines' || (eventData && eventData.due_date)) {
            autoTags.push('submission');
          }
          if (eventData && (eventData.extension || eventData.new_date)) {
            autoTags.push('extension');
          }

          return {
            ...activity,
            user_email: userEmail,
            entity_name: entityName,
            tags: autoTags
          };
        })
      );

      // Apply tag filter
      const filteredActivities = tagFilter === 'all' 
        ? enrichedActivities 
        : enrichedActivities.filter(activity => activity.tags?.includes(tagFilter));

      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email');
      
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const getEventIcon = (entityType: string, eventType: string) => {
    switch (entityType) {
      case 'grants':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'tasks':
        return <CheckSquare className="h-4 w-4 text-green-600" />;
      case 'expenses':
        return <DollarSign className="h-4 w-4 text-orange-600" />;
      case 'grant_team_assignments':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-slate-600" />;
    }
  };

  const getEventDescription = (activity: ActivityLogEntry) => {
    const { entity_type, event_type, entity_name, user_email } = activity;
    const userName = user_email || 'System';
    
    switch (event_type) {
      case 'created':
        return `${userName} created ${entity_type.replace('_', ' ')} "${entity_name}"`;
      case 'updated':
        return `${userName} updated ${entity_type.replace('_', ' ')} "${entity_name}"`;
      case 'deleted':
        return `${userName} deleted ${entity_type.replace('_', ' ')} "${entity_name}"`;
      default:
        return `${userName} performed ${event_type} on ${entity_type.replace('_', ' ')} "${entity_name}"`;
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <Badge className="bg-green-100 text-green-800">Created</Badge>;
      case 'updated':
        return <Badge className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'deleted':
        return <Badge className="bg-red-100 text-red-800">Deleted</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  const exportToCSV = () => {
    const csvData = activities.map(activity => ({
      Date: format(new Date(activity.performed_at), 'yyyy-MM-dd HH:mm:ss'),
      User: activity.user_email || 'System',
      Action: activity.event_type,
      Entity: activity.entity_type,
      Description: getEventDescription(activity),
      Tags: activity.tags?.join(', ') || ''
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-slate-600">
            <Activity className="h-4 w-4 mr-2 animate-spin" />
            Loading activity...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Activity Log
            {grantId && <span className="text-sm font-normal text-slate-600">(Grant specific)</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                <SelectItem value="submission">Submission</SelectItem>
                <SelectItem value="reimbursement">Reimbursement</SelectItem>
                <SelectItem value="extension">Extension</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Activity className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No activity to display</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getEventIcon(activity.entity_type, activity.event_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getEventBadge(activity.event_type)}
                    <span className="text-xs text-slate-500 capitalize">
                      {activity.entity_type.replace('_', ' ')}
                    </span>
                    {activity.tags && activity.tags.length > 0 && (
                      <div className="flex gap-1">
                        {activity.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600"
                          >
                            <Tag className="h-2 w-2 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-900 mb-1">
                    {getEventDescription(activity)}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3 w-3" />
                    {format(new Date(activity.performed_at), 'MMM dd, yyyy at h:mm a')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLog;
