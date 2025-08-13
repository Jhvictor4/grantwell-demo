-- Create closeout_logs table for tracking grant closeout activities
CREATE TABLE IF NOT EXISTS public.closeout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL,
  log_type TEXT NOT NULL CHECK (log_type IN ('final_report', 'fiscal_closeout', 'final_submission')),
  description TEXT,
  file_url TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.closeout_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for closeout_logs
CREATE POLICY "Admin and managers can manage closeout logs" 
ON public.closeout_logs 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view closeout logs for accessible grants" 
ON public.closeout_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = closeout_logs.grant_id 
    AND gta.user_id = auth.uid()
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can create closeout logs for accessible grants" 
ON public.closeout_logs 
FOR INSERT 
WITH CHECK (
  completed_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = closeout_logs.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit' = ANY(gta.permissions)
    ) OR 
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Users can update closeout logs for accessible grants" 
ON public.closeout_logs 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = closeout_logs.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- Create justgrants_status table for sync status tracking
CREATE TABLE IF NOT EXISTS public.justgrants_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id TEXT NOT NULL,
  grant_title TEXT NOT NULL,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'failed', 'pending')),
  last_sync_attempt TIMESTAMP WITH TIME ZONE DEFAULT now(),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.justgrants_status ENABLE ROW LEVEL SECURITY;

-- Create policies for justgrants_status
CREATE POLICY "All authenticated users can view justgrants status" 
ON public.justgrants_status 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage justgrants status" 
ON public.justgrants_status 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add trigger for updated_at
CREATE TRIGGER update_closeout_logs_updated_at
  BEFORE UPDATE ON public.closeout_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_justgrants_status_updated_at
  BEFORE UPDATE ON public.justgrants_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample sync status data
INSERT INTO public.justgrants_status (grant_id, grant_title, sync_status) VALUES
('grant-001', 'COPS Community Policing Development Grant', 'synced'),
('grant-002', 'BJA Justice Assistance Grant', 'synced'),
('grant-003', 'School Safety Enhancement Grant', 'failed'),
('grant-004', 'Equipment Acquisition Grant', 'synced'),
('grant-005', 'Training and Technical Assistance', 'pending')
ON CONFLICT DO NOTHING;