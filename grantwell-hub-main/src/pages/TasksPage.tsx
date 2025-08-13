import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { CheckSquare, Calendar, Settings, RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import KanbanBoard from '@/components/KanbanBoard';

const TasksPage: React.FC = () => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [triggeringReminders, setTriggeringReminders] = useState(false);

  const triggerTaskReminders = async () => {
    try {
      setTriggeringReminders(true);
      
      const { data, error } = await supabase.functions.invoke('task-reminders');
      
      if (error) throw error;

      toast({
        title: "Reminders Sent",
        description: `Successfully processed task reminders. ${data?.reminders_sent || 0} reminders sent.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send task reminders. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTriggeringReminders(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckSquare className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Task Center</h1>
              <p className="text-slate-600">Manage Tasks, Deadlines, And Track Progress Across All Grants</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        {/* Simplified Task Dashboard */}
        <KanbanBoard />
      </div>
    </div>
  );
};

export default TasksPage;