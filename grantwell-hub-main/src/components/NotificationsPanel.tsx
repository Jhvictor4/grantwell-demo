import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { Bell, Settings, Check, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  scheduled_for: string;
  sent_at: string | null;
  grants: {
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
  reminder_days_before: number;
}

const NotificationsPanel = () => {
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
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        status,
        scheduled_for,
        sent_at,
        grant_id
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive"
      });
    } else {
      // Get grant titles separately
      const grantIds = [...new Set((data || []).map(item => item.grant_id))];
      const { data: grantsData } = await supabase
        .from('grants')
        .select('id, title')
        .in('id', grantIds);

      const grantsMap = new Map((grantsData || []).map(g => [g.id, g.title]));

      // Type-safe mapping
      const typedNotifications: Notification[] = (data || []).map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        status: item.status as 'pending' | 'sent' | 'failed',
        scheduled_for: item.scheduled_for,
        sent_at: item.sent_at,
        grants: grantsMap.has(item.grant_id) ? { title: grantsMap.get(item.grant_id)! } : null
      }));
      setNotifications(typedNotifications);
    }
  };

  const fetchPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error);
    } else if (data) {
      setPreferences(data);
    } else {
      // Create default preferences if none exist
      const { data: newPrefs, error: createError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          email_enabled: true,
          deadline_reminders: true,
          task_assignments: true,
          milestone_alerts: true,
          report_reminders: true,
          compliance_alerts: true,
          reminder_days_before: 7
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating preferences:', createError);
      } else {
        setPreferences(newPrefs);
      }
    }
    setLoading(false);
  };

  const updatePreference = async (field: keyof NotificationPreferences, value: boolean | number) => {
    if (!preferences || !user) return;

    const { error } = await supabase
      .from('notification_preferences')
      .update({ [field]: value })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating preference:', error);
      toast({
        title: "Error",
        description: "Failed to update notification preferences",
        variant: "destructive"
      });
    } else {
      setPreferences({ ...preferences, [field]: value });
      toast({
        title: "Success",
        description: "Notification preferences updated"
      });
    }
  };

  const triggerNotifications = async () => {
    try {
      const { error } = await supabase.functions.invoke('send-notifications', {
        body: { type: 'deadline_reminder' }
      });

      if (error) {
        console.error('Error triggering notifications:', error);
        toast({
          title: "Error",
          description: "Failed to trigger notifications",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Notifications processing initiated"
        });
        fetchNotifications();
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to trigger notifications",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-orange-600';
    }
  };

  if (loading) {
    return <div className="p-4">Loading notifications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <Bell className="h-6 w-6 mr-2" />
          Notifications
        </h2>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={triggerNotifications} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Bell className="h-4 w-4 mr-2" />
            Check Notifications
          </Button>
        </div>
      </div>

      {showSettings && preferences && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Email Notifications</span>
              <Switch
                checked={preferences.email_enabled}
                onCheckedChange={(checked) => updatePreference('email_enabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Deadline Reminders</span>
              <Switch
                checked={preferences.deadline_reminders}
                onCheckedChange={(checked) => updatePreference('deadline_reminders', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Task Assignments</span>
              <Switch
                checked={preferences.task_assignments}
                onCheckedChange={(checked) => updatePreference('task_assignments', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Milestone Alerts</span>
              <Switch
                checked={preferences.milestone_alerts}
                onCheckedChange={(checked) => updatePreference('milestone_alerts', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Report Reminders</span>
              <Switch
                checked={preferences.report_reminders}
                onCheckedChange={(checked) => updatePreference('report_reminders', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Compliance Alerts</span>
              <Switch
                checked={preferences.compliance_alerts}
                onCheckedChange={(checked) => updatePreference('compliance_alerts', checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Recent Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(notification.status)}
                      <h4 className="font-medium text-slate-900">{notification.title}</h4>
                      <Badge
                        variant="secondary"
                        className={getStatusColor(notification.status)}
                      >
                        {notification.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                    <div className="text-xs text-slate-500 mt-2">
                      {notification.grants && `Grant: ${notification.grants.title}`}
                      {notification.sent_at ? (
                        <span className="ml-2">
                          Sent: {format(new Date(notification.sent_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      ) : (
                        <span className="ml-2">
                          Scheduled: {format(new Date(notification.scheduled_for), 'MMM dd, yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              No notifications yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPanel;