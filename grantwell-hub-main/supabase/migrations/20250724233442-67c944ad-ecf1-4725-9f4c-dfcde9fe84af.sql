-- Create enum for report types
CREATE TYPE public.report_type AS ENUM ('financial', 'narrative', 'closeout');

-- Create report_logs table
CREATE TABLE public.report_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  type report_type NOT NULL,
  due_date DATE NOT NULL,
  submitted_on DATE,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create grant_team table
CREATE TABLE public.grant_team (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance_checklist table
CREATE TABLE public.compliance_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  completed_by TEXT,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checklist ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for report_logs
CREATE POLICY "All authenticated users can view report logs" 
ON public.report_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage report logs" 
ON public.report_logs 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create RLS policies for grant_team
CREATE POLICY "All authenticated users can view grant team" 
ON public.grant_team 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage grant team" 
ON public.grant_team 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create RLS policies for compliance_checklist
CREATE POLICY "All authenticated users can view compliance checklist" 
ON public.compliance_checklist 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage compliance checklist" 
ON public.compliance_checklist 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_report_logs_updated_at
BEFORE UPDATE ON public.report_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grant_team_updated_at
BEFORE UPDATE ON public.grant_team
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compliance_checklist_updated_at
BEFORE UPDATE ON public.compliance_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert demo data for report_logs using actual grant IDs
INSERT INTO public.report_logs (grant_id, type, due_date, submitted_on, notes) VALUES
('adaded15-14b3-4cee-bb0f-235b1066d768', 'financial', '2024-03-31', '2024-03-28', 'Q1 financial report submitted on time'),
('adaded15-14b3-4cee-bb0f-235b1066d768', 'narrative', '2024-06-30', NULL, 'Q2 narrative report pending'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'financial', '2024-02-28', '2024-02-25', 'Annual financial report completed'),
('5b70699d-7907-44f9-be91-90f832a3a79f', 'closeout', '2024-08-15', NULL, 'Final closeout report due soon');

-- Insert demo data for grant_team using actual grant IDs
INSERT INTO public.grant_team (grant_id, name, role, email) VALUES
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Detective Sarah Johnson', 'Project Lead', 'sjohnson@police.gov'),
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Officer Mike Chen', 'Technical Coordinator', 'mchen@police.gov'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'Sergeant Lisa Rodriguez', 'Community Liaison', 'lrodriguez@police.gov'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'Captain James Wilson', 'Program Supervisor', 'jwilson@police.gov'),
('5b70699d-7907-44f9-be91-90f832a3a79f', 'Lieutenant Tom Davis', 'Equipment Manager', 'tdavis@police.gov');

-- Insert demo data for compliance_checklist using actual grant IDs
INSERT INTO public.compliance_checklist (grant_id, item_name, is_complete, completed_by, due_date) VALUES
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Submit quarterly financial report', true, 'Sarah Johnson', '2024-03-31'),
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Complete vendor compliance audit', false, NULL, '2024-04-15'),
('adaded15-14b3-4cee-bb0f-235b1066d768', 'Update privacy policy documentation', true, 'Mike Chen', '2024-02-28'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'Submit annual impact assessment', false, NULL, '2024-05-30'),
('0460ffeb-24c7-4031-a3a6-69bcfc785aa1', 'Complete community feedback survey', true, 'Lisa Rodriguez', '2024-01-31'),
('5b70699d-7907-44f9-be91-90f832a3a79f', 'Final inventory reconciliation', false, NULL, '2024-08-01'),
('5b70699d-7907-44f9-be91-90f832a3a79f', 'Submit equipment disposal documentation', false, NULL, '2024-07-15');