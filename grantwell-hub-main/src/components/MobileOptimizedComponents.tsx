import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { 
  DollarSign, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Target,
  Clock,
  Users,
  FileText
} from 'lucide-react';

interface MobileGrantCardProps {
  grant: {
    id: string;
    title: string;
    funder: string;
    amount_awarded: number;
    status: string;
    start_date?: string;
    end_date?: string;
  };
  totalExpenses: number;
  progressPercentage: number;
  completedMilestones: number;
  totalMilestones: number;
  upcomingDeadlines: number;
  onClick: () => void;
}

export const MobileGrantCard: React.FC<MobileGrantCardProps> = ({
  grant,
  totalExpenses,
  progressPercentage,
  completedMilestones,
  totalMilestones,
  upcomingDeadlines,
  onClick
}) => {
  const remainingFunds = (grant.amount_awarded || 0) - totalExpenses;
  
  return (
    <Card 
      className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer animate-fade-in"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg text-slate-900 truncate">
              {grant.title}
            </CardTitle>
            <p className="text-sm text-slate-600 truncate">{grant.funder}</p>
          </div>
          <Badge 
            variant={grant.status === 'active' ? 'default' : 'secondary'}
            className={`ml-2 ${grant.status === 'active' ? 'bg-green-600' : ''}`}
          >
            {grant.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <DollarSign className="h-4 w-4 text-green-600 mx-auto mb-1" />
            <div className="text-sm font-bold text-green-700">
              ${(grant.amount_awarded || 0).toLocaleString()}
            </div>
            <div className="text-xs text-green-600">Awarded</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Target className="h-4 w-4 text-blue-600 mx-auto mb-1" />
            <div className="text-sm font-bold text-blue-700">
              ${remainingFunds.toLocaleString()}
            </div>
            <div className="text-xs text-blue-600">Remaining</div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-700 font-medium">Progress</span>
            <span className="text-slate-700 font-medium">{progressPercentage.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-slate-600">
            <span>{completedMilestones}/{totalMilestones} milestones</span>
            {upcomingDeadlines > 0 && (
              <span className="text-orange-600 font-medium">
                {upcomingDeadlines} due soon
              </span>
            )}
          </div>
        </div>

        {/* Timeline */}
        {(grant.start_date || grant.end_date) && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            {grant.start_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Start: {format(new Date(grant.start_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
            {grant.end_date && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>End: {format(new Date(grant.end_date), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface MobileTaskCardProps {
  task: {
    id: string;
    title: string;
    due_date?: string;
    status: string;
    priority?: string;
    assigned_to?: string;
  };
  onComplete?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
}

export const MobileTaskCard: React.FC<MobileTaskCardProps> = ({
  task,
  onComplete,
  onEdit
}) => {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
  const isCompleted = task.status === 'completed';
  
  return (
    <Card className={`border animate-fade-in ${
      isCompleted 
        ? 'border-green-200 bg-green-50' 
        : isOverdue 
        ? 'border-red-200 bg-red-50' 
        : 'border-slate-200'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                  isCompleted 
                    ? 'bg-green-600 border-green-600' 
                    : 'border-slate-300'
                }`}
                onClick={() => onComplete?.(task.id)}
              >
                {isCompleted && (
                  <CheckCircle className="h-3 w-3 text-white m-0.5" />
                )}
              </div>
              <h4 className={`font-medium truncate ${
                isCompleted ? 'text-slate-600 line-through' : 'text-slate-900'
              }`}>
                {task.title}
              </h4>
            </div>
            
            <div className="space-y-1">
              {task.due_date && (
                <div className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  <span className={isOverdue ? 'text-red-600' : 'text-slate-600'}>
                    Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                  </span>
                </div>
              )}
              
              {task.assigned_to && (
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <Users className="h-3 w-3" />
                  <span>{task.assigned_to}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isCompleted ? 'default' : 'secondary'}
                  className={`text-xs ${
                    isCompleted 
                      ? 'bg-green-600' 
                      : isOverdue 
                      ? 'bg-red-600' 
                      : 'bg-orange-600'
                  }`}
                >
                  {isCompleted ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'}
                </Badge>
                
                {task.priority && (
                  <Badge variant="outline" className="text-xs">
                    {task.priority}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(task.id)}
              className="ml-2 h-8 w-8 p-0"
            >
              <FileText className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface MobileNotificationCardProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    status: string;
    scheduled_for: string;
    sent_at?: string | null;
  };
  onDismiss?: (notificationId: string) => void;
}

export const MobileNotificationCard: React.FC<MobileNotificationCardProps> = ({
  notification,
  onDismiss
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deadline_reminder':
        return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'sam_status_alert':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'missing_field_alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  return (
    <Card className={`border animate-fade-in ${getStatusColor(notification.status)}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getTypeIcon(notification.type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-slate-900 text-sm truncate">
                {notification.title}
              </h4>
              <Badge 
                variant="outline" 
                className={`ml-2 text-xs ${
                  notification.status === 'sent' 
                    ? 'border-green-600 text-green-700' 
                    : notification.status === 'failed'
                    ? 'border-red-600 text-red-700'
                    : 'border-yellow-600 text-yellow-700'
                }`}
              >
                {notification.status}
              </Badge>
            </div>
            
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
              {notification.message}
            </p>
            
            <div className="text-xs text-slate-500 mt-2">
              {notification.sent_at 
                ? `Sent: ${format(new Date(notification.sent_at), 'MMM dd, HH:mm')}`
                : `Scheduled: ${format(new Date(notification.scheduled_for), 'MMM dd, HH:mm')}`
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default {
  MobileGrantCard,
  MobileTaskCard,
  MobileNotificationCard
};