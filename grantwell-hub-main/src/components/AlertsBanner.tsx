import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { AlertTriangle, Clock, CheckSquare, Bell, X, Calendar, FileText, DollarSign, Users } from 'lucide-react';

interface AlertItem {
  id: string;
  type: 'deadline' | 'missing_data' | 'task_reminder' | 'budget_alert' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  actionRequired: boolean;
  relatedId?: string;
  dueDate?: string;
  dismissible: boolean;
  created_at: string;
}

interface AlertBannerProps {
  onAlertsUpdate?: (count: number) => void;
}

const AlertsBanner: React.FC<AlertBannerProps> = ({ onAlertsUpdate }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    generateAlerts();
  }, [user]);

  useEffect(() => {
    const visibleAlerts = alerts.filter(alert => !dismissedAlerts.includes(alert.id));
    onAlertsUpdate?.(visibleAlerts.length);
  }, [alerts, dismissedAlerts, onAlertsUpdate]);

  const generateAlerts = async () => {
    if (!user) return;

    try {
      const alertsList: AlertItem[] = [];

      // Fetch upcoming deadlines
      const { data: deadlines } = await supabase
        .from('deadlines')
        .select(`
          *,
          grants (title, funder)
        `)
        .eq('completed', false)
        .gte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      // Fetch overdue tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          *,
          grants (title, funder)
        `)
        .neq('status', 'completed')
        .not('due_date', 'is', null);

      // Fetch grants with missing critical data
      const { data: grants } = await supabase
        .from('grants')
        .select(`
          *,
          grant_team_assignments (count)
        `)
        .neq('status', 'closed');

      // Generate deadline alerts
      deadlines?.forEach(deadline => {
        const daysUntil = differenceInDays(new Date(deadline.due_date), new Date());
        let severity: AlertItem['severity'] = 'low';
        
        if (daysUntil <= 3) severity = 'critical';
        else if (daysUntil <= 7) severity = 'high';
        else if (daysUntil <= 14) severity = 'medium';

        if (daysUntil <= 14) {
          alertsList.push({
            id: `deadline-${deadline.id}`,
            type: 'deadline',
            severity,
            title: `Deadline Approaching: ${deadline.name}`,
            message: `${deadline.grants?.title} has a ${deadline.type} deadline in ${daysUntil} days (${format(new Date(deadline.due_date), 'MMM dd, yyyy')}).`,
            actionRequired: true,
            relatedId: deadline.grant_id,
            dueDate: deadline.due_date,
            dismissible: true,
            created_at: new Date().toISOString()
          });
        }
      });

      // Generate task reminders
      tasks?.forEach(task => {
        if (task.due_date) {
          const daysUntil = differenceInDays(new Date(task.due_date), new Date());
          if (daysUntil < 0) {
            alertsList.push({
              id: `task-${task.id}`,
              type: 'task_reminder',
              severity: 'high',
              title: `Overdue Task: ${task.title}`,
              message: `Task "${task.title}" was due ${Math.abs(daysUntil)} days ago and needs attention.`,
              actionRequired: true,
              relatedId: task.grant_id,
              dueDate: task.due_date,
              dismissible: true,
              created_at: new Date().toISOString()
            });
          } else if (daysUntil <= 3) {
            alertsList.push({
              id: `task-${task.id}`,
              type: 'task_reminder',
              severity: 'medium',
              title: `Task Due Soon: ${task.title}`,
              message: `Task "${task.title}" is due in ${daysUntil} days.`,
              actionRequired: true,
              relatedId: task.grant_id,
              dueDate: task.due_date,
              dismissible: true,
              created_at: new Date().toISOString()
            });
          }
        }
      });

      // Generate missing data alerts
      grants?.forEach(grant => {
        const issues: string[] = [];
        
        if (!grant.coordinator_name) issues.push('SAM registration info');
        if (!grant.start_date) issues.push('start date');
        if (!grant.end_date) issues.push('end date');
        
        if (issues.length > 0) {
          alertsList.push({
            id: `missing-data-${grant.id}`,
            type: 'missing_data',
            severity: 'medium',
            title: `Incomplete Grant Information`,
            message: `Grant "${grant.title}" is missing: ${issues.join(', ')}.`,
            actionRequired: true,
            relatedId: grant.id,
            dismissible: true,
            created_at: new Date().toISOString()
          });
        }
      });

      // Sort alerts by severity and date
      const sortedAlerts = alertsList.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });

      setAlerts(sortedAlerts);
    } catch (error) {
      console.error('Error generating alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId]);
    toast({
      title: "Alert Dismissed",
      description: "You can view dismissed alerts in the notifications panel.",
    });
  };

  const getSeverityColor = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
    }
  };

  const getSeverityIcon = (severity: AlertItem['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'medium': return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'low': return <Bell className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTypeIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'deadline': return <Calendar className="h-4 w-4" />;
      case 'task_reminder': return <CheckSquare className="h-4 w-4" />;
      case 'missing_data': return <FileText className="h-4 w-4" />;
      case 'budget_alert': return <DollarSign className="h-4 w-4" />;
      case 'compliance': return <Users className="h-4 w-4" />;
    }
  };

  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.includes(alert.id));

  if (loading || visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleAlerts.slice(0, 5).map((alert) => (
        <Alert key={alert.id} className={`${getSeverityColor(alert.severity)} border-l-4`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(alert.severity)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {getTypeIcon(alert.type)}
                  <AlertTitle className="text-sm font-medium">
                    {alert.title}
                  </AlertTitle>
                  <Badge variant="outline" className="text-xs">
                    {alert.type.replace('_', ' ')}
                  </Badge>
                </div>
                <AlertDescription className="text-sm">
                  {alert.message}
                </AlertDescription>
                {alert.actionRequired && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      Take Action
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {alert.dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAlert(alert.id)}
                className="flex-shrink-0 h-8 w-8 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Alert>
      ))}
      
      {visibleAlerts.length > 5 && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-slate-600">
            View {visibleAlerts.length - 5} more alerts
          </Button>
        </div>
      )}
    </div>
  );
};

export default AlertsBanner;