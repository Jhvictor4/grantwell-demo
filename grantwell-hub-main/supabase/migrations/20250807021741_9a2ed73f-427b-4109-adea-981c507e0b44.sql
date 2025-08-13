-- Create task_assignments table for multiple assignees per task
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for task_assignments
CREATE POLICY "Admin and managers can manage task assignments"
  ON public.task_assignments
  FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view task assignments for accessible grants"
  ON public.task_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      LEFT JOIN public.grant_team_assignments gta ON t.grant_id = gta.grant_id
      WHERE t.id = task_assignments.task_id
      AND (gta.user_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

CREATE POLICY "Users can create task assignments for accessible grants"
  ON public.task_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      LEFT JOIN public.grant_team_assignments gta ON t.grant_id = gta.grant_id
      WHERE t.id = task_assignments.task_id
      AND (gta.user_id = auth.uid() AND 'edit'::text = ANY (gta.permissions))
      OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

-- Add reminder fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_reminder_sent TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON public.task_assignments(user_id);