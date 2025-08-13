import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  Clock, 
  User, 
  FileText, 
  CheckCircle, 
  Upload, 
  Settings,
  Edit,
  Calendar,
  UserCheck,
  Save,
  Plus,
  Trash2
} from 'lucide-react';

interface ActivityItem {
  id: string;
  grant_id: string;
  user_id: string;
  action: string;
  description: string | null;
  timestamp: string;
  payload: any;
  user_email?: string;
  user_name?: string;
  user_full_name?: string;
}

interface ActivityFeedProps {
  grantId: string;
}

export function ActivityFeed({ grantId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (grantId) {
      loadActivityFeed();
      
      // Set up real-time subscription on data_lifecycle_events
      const channel = supabase
        .channel('grant-activity-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'grant_activity_log',
            filter: `grant_id=eq.${grantId}`
          },
          () => {
            loadActivityFeed();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [grantId]);

  // Helpers for names and initials
  const toTitle = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
  const deriveNameFromEmail = (email?: string): string => {
    if (!email) return 'Unknown User';
    const local = email.split('@')[0];
    const tokens = local.split(/[._+-]/).filter(Boolean);
    const parts = (tokens.length >= 2 ? tokens.slice(0, 2) : [local]);
    return parts.map(toTitle).join(' ');
  };
  const getInitialsFromName = (name?: string): string => {
    if (!name) return 'UN';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return 'UN';
  };
  const normalizeToFirstLast = (raw?: string): string => {
    if (!raw) return '';
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = toTitle(parts[0]);
      const last = toTitle(parts[parts.length - 1]);
      return `${first} ${last}`;
    }
    if (parts.length === 1) {
      return toTitle(parts[0]);
    }
    return '';
  };

  const loadActivityFeed = async () => {
    try {
      setLoading(true);
      
      // Query grant_activity_log
      const { data: activityData, error: activityError } = await supabase
        .from('grant_activity_log')
        .select('*')
        .eq('grant_id', grantId)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (activityError) {
        console.error('Error loading activity data:', activityError);
        return;
      }

      // Get user details for activities
      const userIds = [...new Set(activityData?.map(a => a.user_id).filter(Boolean) || [])];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        
        profiles = profilesData || [];
      }

      // Merge activity data with user profiles
      const enrichedActivities = (activityData || []).map(activity => {
        const profile = profiles.find(p => p.id === activity.user_id);
        const nameFromProfile = normalizeToFirstLast(profile?.full_name);
        const fullName = nameFromProfile || deriveNameFromEmail(profile?.email);
        return {
          ...activity,
          user_email: profile?.email || 'Unknown',
          user_full_name: fullName
        };
      });

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error loading activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'status_update':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'task_created':
      case 'task_updated':
        return <CheckCircle className="h-3 w-3 text-blue-600" />;
      case 'file_uploaded':
        return <Upload className="h-3 w-3 text-purple-600" />;
      case 'note_added':
        return <FileText className="h-3 w-3 text-orange-600" />;
      case 'user_assigned':
        return <UserCheck className="h-3 w-3 text-indigo-600" />;
      case 'budget_updated':
        return <Settings className="h-3 w-3 text-teal-600" />;
      case 'compliance_updated':
        return <Settings className="h-3 w-3 text-red-600" />;
      case 'deadline_updated':
        return <Calendar className="h-3 w-3 text-yellow-600" />;
      case 'document_updated':
        return <Edit className="h-3 w-3 text-gray-600" />;
      case 'progress_saved':
        return <Save className="h-3 w-3 text-green-600" />;
      case 'item_created':
        return <Plus className="h-3 w-3 text-blue-600" />;
      case 'item_deleted':
        return <Trash2 className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getUserInitials = (email?: string, name?: string) => {
    if (name && name.trim()) {
      const nameParts = name.trim().split(' ').filter(part => part.length > 0);
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      } else if (nameParts.length === 1) {
        return nameParts[0].slice(0, 2).toUpperCase();
      }
    }
    if (email && email.trim()) {
      // Handle special characters and provide better fallbacks
      const emailPrefix = email.split('@')[0];
      const cleanPrefix = emailPrefix.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanPrefix.length >= 2) {
        return cleanPrefix.slice(0, 2).toUpperCase();
      } else if (cleanPrefix.length === 1) {
        return (cleanPrefix + emailPrefix.charAt(emailPrefix.length - 1)).toUpperCase();
      } else {
        // Fallback to first character of email domain if prefix is empty
        const domain = email.split('@')[1];
        return domain ? domain.slice(0, 2).toUpperCase() : 'UN';
      }
    }
    return 'UN';
  };

  const getDisplayText = (activity: ActivityItem) => {
    if (activity.description) {
      return activity.description;
    }
    
    // Enhanced display text for compliance uploads
    if (activity.action === 'file_uploaded' && activity.payload?.compliance_section) {
      return `uploaded ${activity.payload.file_name} to ${activity.payload.folder_path}`;
    }
    
    // Fallback display text based on action type
    switch (activity.action) {
      case 'status_update':
        return 'updated grant status';
      case 'task_created':
        return 'created a new task';
      case 'task_updated':
        return 'updated a task';
      case 'file_uploaded':
        return activity.payload?.file_name ? `uploaded ${activity.payload.file_name}` : 'uploaded a file';
      case 'note_added':
        return 'added a note';
      case 'user_assigned':
        return 'was assigned to this grant';
      case 'budget_updated':
        return 'updated budget information';
      case 'compliance_updated':
        return 'updated compliance information';
      case 'deadline_updated':
        return 'updated a deadline';
      case 'document_updated':
        return 'updated a document';
      case 'progress_saved':
        return 'saved progress notes';
      case 'item_created':
        return activity.payload?.folder_name ? `created folder "${activity.payload.folder_name}"` : 'created an item';
      case 'item_deleted':
        return 'deleted an item';
      case 'closeout_updated':
        return activity.payload?.task_name ? `updated closeout task "${activity.payload.task_name}"` : 'updated closeout task';
      case 'closeout_submitted':
        return 'submitted grant closeout for review';
      default:
        return 'performed an action';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    // For older activities, show formatted date like "Aug 10, 9:32 AM"
    return activityTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getActivityLink = (activity: ActivityItem) => {
    const currentPath = window.location.pathname;
    const baseUrl = currentPath.includes('/grants/') ? currentPath.split('?')[0] : `/grants/${grantId}`;
    
    // Map actions to tabs - deep linking for better UX
    switch (activity.action) {
      case 'task_created':
      case 'task_updated':
        return `${baseUrl}?tab=tasks`;
      case 'file_uploaded':
      case 'document_updated':
        return `${baseUrl}?tab=attachments`;
      case 'budget_updated':
        return `${baseUrl}?tab=budget`;
      case 'compliance_updated':
        return `${baseUrl}?tab=compliance`;
      case 'note_added':
      case 'progress_saved':
        return `${baseUrl}?tab=narrative`;
      case 'user_assigned':
        return `${baseUrl}?tab=team`;
      default:
        return `${baseUrl}?tab=overview`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3 py-2 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                  <div className="h-2 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[320px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[220px]">
          {activities.length === 0 ? (
            <div className="text-center py-4">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <Link 
                  key={activity.id} 
                  to={getActivityLink(activity)}
                  className="block no-underline hover:scale-[1.01] transition-transform"
                >
                  <div className="flex items-start space-x-3 p-3 bg-card rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer shadow-sm">
                    <div className="flex-shrink-0">
                      <div className="w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                        {getInitialsFromName(activity.user_full_name || activity.user_email)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {getActionIcon(activity.action)}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-foreground font-medium leading-tight mb-1">
                            {getDisplayText(activity)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{activity.user_full_name || activity.user_email || 'Unknown User'}</span>
                            <span>•</span>
                            <span>{formatTimeAgo(activity.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}