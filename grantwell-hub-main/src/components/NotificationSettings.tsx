import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  Bell, 
  Mail, 
  Clock, 
  Calendar,
  Settings,
  CheckCircle,
  AlertTriangle,
  Send
} from 'lucide-react';

interface NotificationSettings {
  id?: string;
  user_id: string;
  email_notifications: boolean;
  deadline_reminders: boolean;
  task_assignments: boolean;
  quarterly_reports: boolean;
  compliance_alerts: boolean;
  reminder_advance_days: number;
  digest_frequency: 'daily' | 'weekly' | 'never';
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at?: string;
  updated_at?: string;
}

interface NotificationHistory {
  id: string;
  type: string;
  title: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  created_at: string;
  grant_title?: string;
}

const NotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: '',
    email_notifications: true,
    deadline_reminders: true,
    task_assignments: true,
    quarterly_reports: true,
    compliance_alerts: true,
    reminder_advance_days: 7,
    digest_frequency: 'weekly',
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  });
  const [history, setHistory] = useState<NotificationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadSettings();
      loadHistory();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          ...data,
          email_notifications: data.email_enabled || true,
          quarterly_reports: data.report_reminders || true,
          reminder_advance_days: data.reminder_days_before || 7,
          digest_frequency: 'weekly',
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00'
        });
      } else {
        // Set default settings with user ID
        setSettings(prev => ({
          ...prev,
          user_id: user?.id || ''
        }));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      toast({
        title: "Error",
        description: "Failed to load notification settings.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const historyData: NotificationHistory[] = (data || []).map(item => ({
        id: item.id,
        type: item.type,
        title: item.title,
        message: item.message,
        status: item.status,
        sent_at: item.sent_at,
        created_at: item.created_at,
        grant_title: undefined
      }));

      setHistory(historyData);
    } catch (error) {
      console.error('Error loading notification history:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);

    try {
      const settingsData = {
        user_id: user?.id,
        email_notifications: settings.email_notifications,
        deadline_reminders: settings.deadline_reminders,
        task_assignments: settings.task_assignments,
        quarterly_reports: settings.quarterly_reports,
        compliance_alerts: settings.compliance_alerts,
        reminder_advance_days: settings.reminder_advance_days,
        digest_frequency: settings.digest_frequency,
        quiet_hours_start: settings.quiet_hours_start,
        quiet_hours_end: settings.quiet_hours_end
      };

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(settingsData, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Your notification preferences have been updated."
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save notification settings.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async () => {
    setTesting(true);

    try {
      // Create a test notification
      const { data: testNotification, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          grant_id: null,
          type: 'task_assigned',
          title: 'Test Notification',
          message: 'This is a test notification to verify your email settings are working correctly.',
          scheduled_for: new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger notification sending
      const { error: sendError } = await supabase.functions.invoke('send-notifications', {
        body: {
          notificationId: testNotification.id
        }
      });

      if (sendError) throw sendError;

      toast({
        title: "Test Sent",
        description: "A test notification has been sent to your email address."
      });

      await loadHistory();
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Test Failed",
        description: "Failed to send test notification.",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const scheduleReminders = async () => {
    try {
      const { error } = await supabase.functions.invoke('schedule-reminders', {
        body: {
          advance_days: settings.reminder_advance_days
        }
      });

      if (error) throw error;

      toast({
        title: "Reminders Scheduled",
        description: "Upcoming reminders have been scheduled based on your preferences."
      });
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule reminders.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="outline" className="bg-green-50 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">Loading notification settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Email Notifications</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={settings.email_notifications}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, email_notifications: checked }))
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Deadline Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Grant application deadlines
                  </p>
                </div>
                <Switch
                  checked={settings.deadline_reminders}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, deadline_reminders: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Task Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    When tasks are assigned to you
                  </p>
                </div>
                <Switch
                  checked={settings.task_assignments}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, task_assignments: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Quarterly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Progress report due dates
                  </p>
                </div>
                <Switch
                  checked={settings.quarterly_reports}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, quarterly_reports: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Compliance Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Compliance requirements
                  </p>
                </div>
                <Switch
                  checked={settings.compliance_alerts}
                  onCheckedChange={(checked) => 
                    setSettings(prev => ({ ...prev, compliance_alerts: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Timing Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Timing & Frequency</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Reminder Advance (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={settings.reminder_advance_days}
                  onChange={(e) => 
                    setSettings(prev => ({ 
                      ...prev, 
                      reminder_advance_days: parseInt(e.target.value) || 7 
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Digest Frequency</Label>
                <Select 
                  value={settings.digest_frequency}
                  onValueChange={(value: 'daily' | 'weekly' | 'never') => 
                    setSettings(prev => ({ ...prev, digest_frequency: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quiet Hours</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="time"
                    value={settings.quiet_hours_start}
                    onChange={(e) => 
                      setSettings(prev => ({ ...prev, quiet_hours_start: e.target.value }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={settings.quiet_hours_end}
                    onChange={(e) => 
                      setSettings(prev => ({ ...prev, quiet_hours_end: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4 border-t">
            <Button onClick={saveSettings} disabled={saving}>
              <Settings className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            
            <Button variant="outline" onClick={sendTestNotification} disabled={testing}>
              <Send className="h-4 w-4 mr-2" />
              {testing ? 'Sending...' : 'Send Test'}
            </Button>
            
            <Button variant="outline" onClick={scheduleReminders}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Reminders
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Recent Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notification history available.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(item => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{item.title}</h4>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>
                    {item.grant_title && (
                      <p className="text-xs text-muted-foreground">
                        Grant: {item.grant_title}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatDate(item.created_at)}</div>
                    {item.sent_at && (
                      <div>Sent: {formatDate(item.sent_at)}</div>
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

export default NotificationSettings;