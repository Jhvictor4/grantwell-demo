-- Create compliance_logs table for tracking compliance activities
CREATE TABLE public.compliance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  log_type TEXT NOT NULL DEFAULT 'activity',
  activity_description TEXT NOT NULL,
  status TEXT DEFAULT 'logged',
  notes TEXT,
  attachment_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admin and managers can manage compliance logs" 
ON public.compliance_logs FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view compliance logs for accessible grants" 
ON public.compliance_logs FOR SELECT 
USING ((EXISTS ( SELECT 1
   FROM grant_team_assignments gta
  WHERE ((gta.grant_id = compliance_logs.grant_id) AND (gta.user_id = auth.uid())))) OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])));

CREATE POLICY "Users can create compliance logs for accessible grants" 
ON public.compliance_logs FOR INSERT 
WITH CHECK ((created_by = auth.uid()) AND ((EXISTS ( SELECT 1
   FROM grant_team_assignments gta
  WHERE ((gta.grant_id = compliance_logs.grant_id) AND (gta.user_id = auth.uid())))) OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))));

-- Add trigger for updated_at
CREATE TRIGGER update_compliance_logs_updated_at
BEFORE UPDATE ON public.compliance_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();