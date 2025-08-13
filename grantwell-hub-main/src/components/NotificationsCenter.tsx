import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { Bell, Settings, Check, X, AlertTriangle, Clock, CheckCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_for: string;
  sent_at: string | null;
  grant_id: string;
  grants?: {
    title: string;
  } | null;
}

interface NotificationPreferences {
  id: string;
  email_enabled: boolean;
  deadline_reminders: boolean;
  task_assignments: boolean;
  milestone_alerts: boolean;
  report_reminders: boolean;
  compliance_alerts: boolean;
  sam_status_alerts: boolean;
  missing_field_alerts: boolean;
  status_change_alerts: boolean;
  reminder_days_before: number;
}

const NotificationsCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          grants (
            title
          )
        `)
        .eq('user_id', user?.id)
        .order('scheduled_for', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Handle the case where grants join might fail
      const processedNotifications = (data || []).map(notification => {
        let validGrants: { title: string } | null = null;
        
        // Type guard to safely check the grants object
        if (notification.grants && 
            typeof notification.grants === 'object' && 
            'title' in (notification.grants || {}) &&
            typeof (notification.grants as any).title === 'string') {
          validGrants = { title: (notification.grants as any).title };
        }
        
        return {
          ...notification,
          grants: validGrants
        };
      });
      
      setNotifications(processedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        // Handle case where some properties might be missing from database
        const fullPreferences: NotificationPreferences = {
          id: data.id,
          email_enabled: data.email_enabled ?? true,
          deadline_reminders: data.deadline_reminders ?? true,
          task_assignments: data.task_assignments ?? true,
          milestone_alerts: data.milestone_alerts ?? true,
          report_reminders: data.report_reminders ?? true,
          compliance_alerts: data.compliance_alerts ?? true,
          sam_status_alerts: (data as any).sam_status_alerts ?? true,
          missing_field_alerts: (data as any).missing_field_alerts ?? true,
          status_change_alerts: (data as any).status_change_alerts ?? true,
          reminder_days_before: data.reminder_days_before ?? 7,
        };
        setPreferences(fullPreferences);
      } else {
        // Create default preferences
        const defaultPreferences = {
          user_id: user?.id,
          email_enabled: true,
          deadline_reminders: true,
          task_assignments: true,
          milestone_alerts: true,
          report_reminders: true,
          compliance_alerts: true,
          sam_status_alerts: true,
          missing_field_alerts: true,
          status_change_alerts: true,
          reminder_days_before: 7,
        };

        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert(defaultPreferences)
          .select()
          .maybeSingle();

        if (insertError) throw insertError;
        if (newPrefs) {
          setPreferences({
            ...newPrefs,
            sam_status_alerts: true,
            missing_field_alerts: true,
            status_change_alerts: true,
          } as NotificationPreferences);
        }
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean | number) => {
    if (!preferences) return;

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value })
        .eq('id', preferences.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, [key]: value } : null);
      
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update notification preferences.",
        variant: "destructive",
      });
    }
  };

  const triggerNotifications = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: {}
      });
      
      if (error) throw error;

      toast({
        title: "Notifications Triggered",
        description: "Checking for new notifications and alerts.",
      });
      
      // Refresh notifications after triggering
      setTimeout(() => {
        fetchNotifications();
      }, 2000);
    } catch (error) {
      console.error('Error triggering notifications:', error);
      toast({
        title: "Error",
        description: "Failed to trigger notifications.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'deadline_reminder':
        return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'sam_status_alert':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'missing_field_alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'status_change_alert':
        return <Bell className="h-4 w-4 text-blue-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-600">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Notifications & Alerts
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="border-slate-300"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
              <Button
                size="sm"
                onClick={triggerNotifications}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Check className="h-4 w-4 mr-1" />
                Check Notifications
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showSettings && preferences && (
            <Alert className="border-blue-200 bg-blue-50">
              <Settings className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="space-y-4 mt-2">
                  <h4 className="font-medium text-slate-900">Notification Preferences</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Email Notifications</p>
                        <p className="text-sm text-slate-600">Receive notifications via email</p>
                      </div>
                      <Switch
                        checked={preferences.email_enabled}
                        onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Deadline Reminders</p>
                        <p className="text-sm text-slate-600">Alerts for upcoming deadlines</p>
                      </div>
                      <Switch
                        checked={preferences.deadline_reminders}
                        onCheckedChange={(checked) => updatePreference('deadline_reminders', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Task Assignments</p>
                        <p className="text-sm text-slate-600">Notifications for new tasks</p>
                      </div>
                      <Switch
                        checked={preferences.task_assignments}
                        onCheckedChange={(checked) => updatePreference('task_assignments', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Milestone Alerts</p>
                        <p className="text-sm text-slate-600">Updates on milestone progress</p>
                      </div>
                      <Switch
                        checked={preferences.milestone_alerts}
                        onCheckedChange={(checked) => updatePreference('milestone_alerts', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Report Reminders</p>
                        <p className="text-sm text-slate-600">Reminders for due reports</p>
                      </div>
                      <Switch
                        checked={preferences.report_reminders}
                        onCheckedChange={(checked) => updatePreference('report_reminders', checked)}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Compliance Alerts</p>
                        <p className="text-sm text-slate-600">Compliance requirements updates</p>
                      </div>
                      <Switch
                        checked={preferences.compliance_alerts}
                        onCheckedChange={(checked) => updatePreference('compliance_alerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">SAM Status Alerts</p>
                        <p className="text-sm text-slate-600">SAM registration expiration warnings</p>
                      </div>
                      <Switch
                        checked={preferences.sam_status_alerts}
                        onCheckedChange={(checked) => updatePreference('sam_status_alerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Missing Field Alerts</p>
                        <p className="text-sm text-slate-600">Alerts for incomplete grant data</p>
                      </div>
                      <Switch
                        checked={preferences.missing_field_alerts}
                        onCheckedChange={(checked) => updatePreference('missing_field_alerts', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-700">Status Change Alerts</p>
                        <p className="text-sm text-slate-600">Grant status updates</p>
                      </div>
                      <Switch
                        checked={preferences.status_change_alerts}
                        onCheckedChange={(checked) => updatePreference('status_change_alerts', checked)}
                      />
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <h4 className="font-medium text-slate-900">Recent Notifications</h4>
            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getNotificationTypeIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-slate-900 truncate">
                              {notification.title}
                            </h5>
                            <Badge className={getStatusColor(notification.status)}>
                              {getStatusIcon(notification.status)}
                              <span className="ml-1 capitalize">{notification.status}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>
                              Scheduled: {format(new Date(notification.scheduled_for), 'MMM dd, yyyy HH:mm')}
                            </span>
                            {notification.sent_at && (
                              <span>
                                Sent: {format(new Date(notification.sent_at), 'MMM dd, yyyy HH:mm')}
                              </span>
                            )}
                            {notification.grants && (
                              <span>Grant: {notification.grants.title}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No notifications found.</p>
                <p className="text-sm">Click "Check Notifications" to trigger new alerts.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsCenter;