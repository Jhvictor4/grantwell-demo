-- Create quarterly_reports table for tracking quarterly compliance
CREATE TABLE IF NOT EXISTS public.quarterly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  quarter_year TEXT NOT NULL, -- Format: "Q1-2024"
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted', 'late')),
  sf425_file_url TEXT,
  narrative_file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create closeout_status table for tracking final closeout
CREATE TABLE IF NOT EXISTS public.closeout_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  final_sf425_completed BOOLEAN NOT NULL DEFAULT false,
  final_sf425_file_url TEXT,
  final_narrative_completed BOOLEAN NOT NULL DEFAULT false,
  final_narrative_file_url TEXT,
  equipment_disposition_completed BOOLEAN NOT NULL DEFAULT false,
  equipment_disposition_file_url TEXT,
  unspent_funds_completed BOOLEAN NOT NULL DEFAULT false,
  unspent_funds_file_url TEXT,
  closeout_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on quarterly_reports
ALTER TABLE public.quarterly_reports ENABLE ROW LEVEL SECURITY;

-- Enable RLS on closeout_status  
ALTER TABLE public.closeout_status ENABLE ROW LEVEL SECURITY;

-- Create policies for quarterly_reports
CREATE POLICY "Admin and managers can manage quarterly reports" ON public.quarterly_reports
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view quarterly reports for accessible grants" ON public.quarterly_reports
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = quarterly_reports.grant_id 
      AND gta.user_id = auth.uid()
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can create quarterly reports for accessible grants" ON public.quarterly_reports
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND (
      (EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = quarterly_reports.grant_id 
        AND gta.user_id = auth.uid() 
        AND 'edit'::text = ANY (gta.permissions)
      )) OR 
      (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

CREATE POLICY "Users can update quarterly reports for accessible grants" ON public.quarterly_reports
  FOR UPDATE USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = quarterly_reports.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit'::text = ANY (gta.permissions)
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

-- Create policies for closeout_status
CREATE POLICY "Admin and managers can manage closeout status" ON public.closeout_status
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view closeout status for accessible grants" ON public.closeout_status
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = closeout_status.grant_id 
      AND gta.user_id = auth.uid()
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can create closeout status for accessible grants" ON public.closeout_status
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = closeout_status.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit'::text = ANY (gta.permissions)
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can update closeout status for accessible grants" ON public.closeout_status
  FOR UPDATE USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = closeout_status.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit'::text = ANY (gta.permissions)
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

-- Add triggers for updating updated_at columns
CREATE TRIGGER update_quarterly_reports_updated_at
  BEFORE UPDATE ON public.quarterly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_closeout_status_updated_at
  BEFORE UPDATE ON public.closeout_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better query performance
CREATE INDEX idx_quarterly_reports_grant_id ON public.quarterly_reports(grant_id);
CREATE INDEX idx_quarterly_reports_quarter_year ON public.quarterly_reports(quarter_year);
CREATE INDEX idx_quarterly_reports_due_date ON public.quarterly_reports(due_date);
CREATE INDEX idx_quarterly_reports_status ON public.quarterly_reports(status);

CREATE INDEX idx_closeout_status_grant_id ON public.closeout_status(grant_id);
CREATE INDEX idx_closeout_status_closeout_complete ON public.closeout_status(closeout_complete);