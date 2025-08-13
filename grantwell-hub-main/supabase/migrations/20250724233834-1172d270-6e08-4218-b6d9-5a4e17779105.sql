-- Create enum for notification types
CREATE TYPE public.notification_type AS ENUM ('deadline_reminder', 'task_assigned', 'milestone_due', 'report_due', 'compliance_overdue');

-- Create enum for notification status
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  grant_id UUID NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status notification_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  related_id UUID, -- ID of related deadline, milestone, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_reminders BOOLEAN NOT NULL DEFAULT true,
  task_assignments BOOLEAN NOT NULL DEFAULT true,
  milestone_alerts BOOLEAN NOT NULL DEFAULT true,
  report_reminders BOOLEAN NOT NULL DEFAULT true,
  compliance_alerts BOOLEAN NOT NULL DEFAULT true,
  reminder_days_before INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table for comprehensive task management
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID, -- user ID from profiles table
  assigned_by UUID, -- user ID from profiles table
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admin and managers can manage notifications" 
ON public.notifications 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create RLS policies for notification_preferences
CREATE POLICY "Users can view and update their own preferences" 
ON public.notification_preferences 
FOR ALL 
USING (user_id = auth.uid());

-- Create RLS policies for tasks
CREATE POLICY "All authenticated users can view tasks" 
ON public.tasks 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage tasks" 
ON public.tasks 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can update tasks assigned to them" 
ON public.tasks 
FOR UPDATE 
USING (assigned_to = auth.uid());

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate deadline notifications
CREATE OR REPLACE FUNCTION public.generate_deadline_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert notifications for upcoming deadlines
  INSERT INTO public.notifications (user_id, grant_id, type, title, message, scheduled_for, related_id)
  SELECT 
    p.id as user_id,
    d.grant_id,
    'deadline_reminder'::notification_type,
    'Upcoming Deadline: ' || d.name,
    'Deadline "' || d.name || '" is due on ' || d.due_date::text || '. Don''t forget to complete this task.',
    (d.due_date - INTERVAL '7 days')::timestamp with time zone,
    d.id
  FROM deadlines d
  CROSS JOIN profiles p
  JOIN grant_team gt ON gt.grant_id = d.grant_id AND p.email = gt.email
  LEFT JOIN notification_preferences np ON np.user_id = p.id
  WHERE d.completed = false
    AND d.due_date >= CURRENT_DATE
    AND d.due_date <= CURRENT_DATE + INTERVAL '30 days'
    AND (np.deadline_reminders IS NULL OR np.deadline_reminders = true)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.related_id = d.id 
        AND n.type = 'deadline_reminder' 
        AND n.user_id = p.id
    );
END;
$$;

-- Insert demo notification preferences for existing users
INSERT INTO public.notification_preferences (user_id, email_enabled, deadline_reminders, task_assignments, milestone_alerts, report_reminders, compliance_alerts, reminder_days_before)
SELECT id, true, true, true, true, true, true, 7
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Insert demo tasks
INSERT INTO public.tasks (grant_id, title, description, assigned_to, assigned_by, priority, status, due_date) VALUES
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Review vendor proposals', 'Evaluate and compare proposals from body camera vendors', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM profiles LIMIT 1), 'high', 'in_progress', '2024-08-15'),
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Prepare quarterly report', 'Compile financial and progress data for Q2 report', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM profiles LIMIT 1), 'medium', 'pending', '2024-09-30'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'Community outreach planning', 'Organize community engagement events for the policing initiative', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM profiles LIMIT 1), 'medium', 'pending', '2024-08-20'),
('5b70699d-7907-44f9-be91-90f832a3a79f', 'Equipment inventory audit', 'Complete full inventory of all equipment purchased with grant funds', (SELECT id FROM profiles LIMIT 1), (SELECT id FROM profiles LIMIT 1), 'urgent', 'pending', '2024-07-31');