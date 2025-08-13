-- Create advanced reporting tables
CREATE TABLE public.report_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('financial', 'compliance', 'progress', 'custom')),
  fields JSONB NOT NULL DEFAULT '[]',
  filters JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated reports table
CREATE TABLE public.generated_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.report_templates(id),
  title TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  generated_by UUID,
  grant_ids UUID[] DEFAULT '{}',
  date_range_start DATE,
  date_range_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create financial analytics views
CREATE TABLE public.financial_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'fiscal_year')),
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit trail table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  grant_id UUID,
  description TEXT
);

-- Enable RLS
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated users can view report templates" 
ON public.report_templates FOR SELECT USING (true);

CREATE POLICY "Admin and managers can manage report templates" 
ON public.report_templates FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view generated reports" 
ON public.generated_reports FOR SELECT USING (true);

CREATE POLICY "Admin and managers can manage generated reports" 
ON public.generated_reports FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view financial periods" 
ON public.financial_periods FOR SELECT USING (true);

CREATE POLICY "Admin can manage financial periods" 
ON public.financial_periods FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "All authenticated users can view audit logs" 
ON public.audit_logs FOR SELECT USING (true);

CREATE POLICY "System can insert audit logs" 
ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Create triggers
CREATE TRIGGER update_report_templates_updated_at
BEFORE UPDATE ON public.report_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert system report templates
INSERT INTO public.report_templates (name, description, template_type, fields, is_system) VALUES
('Financial Summary Report', 'Comprehensive financial overview of grants with expenses and budget analysis', 'financial', 
 '[{"name": "grant_ids", "type": "multiselect", "required": false}, {"name": "date_range", "type": "daterange", "required": true}, {"name": "include_projections", "type": "boolean", "default": false}]'::jsonb, 
 true),
('Compliance Checklist Report', 'Detailed compliance status across all grant requirements', 'compliance',
 '[{"name": "grant_ids", "type": "multiselect", "required": false}, {"name": "status_filter", "type": "select", "options": ["all", "pending", "completed", "overdue"]}, {"name": "include_evidence", "type": "boolean", "default": true}]'::jsonb,
 true),
('Quarterly Progress Report', 'Progress tracking report with milestones and deliverables', 'progress',
 '[{"name": "quarter", "type": "select", "required": true, "options": ["Q1", "Q2", "Q3", "Q4"]}, {"name": "fiscal_year", "type": "number", "required": true}, {"name": "include_team_metrics", "type": "boolean", "default": false}]'::jsonb,
 true),
('Grant Performance Dashboard', 'Executive summary of grant performance metrics', 'financial',
 '[{"name": "performance_period", "type": "select", "options": ["monthly", "quarterly", "yearly"]}, {"name": "comparison_enabled", "type": "boolean", "default": true}]'::jsonb,
 true);

-- Insert current fiscal periods
INSERT INTO public.financial_periods (period_type, period_name, start_date, end_date, fiscal_year, is_current) VALUES
('fiscal_year', 'FY 2024', '2023-10-01', '2024-09-30', 2024, true),
('quarterly', 'Q1 FY2024', '2023-10-01', '2023-12-31', 2024, false),
('quarterly', 'Q2 FY2024', '2024-01-01', '2024-03-31', 2024, false),
('quarterly', 'Q3 FY2024', '2024-04-01', '2024-06-30', 2024, true),
('quarterly', 'Q4 FY2024', '2024-07-01', '2024-09-30', 2024, false),
('monthly', 'July 2024', '2024-07-01', '2024-07-31', 2024, false),
('monthly', 'August 2024', '2024-08-01', '2024-08-31', 2024, true);

-- Create function for financial analytics
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_grant_ids UUID[] DEFAULT NULL,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS TABLE (
  grant_id UUID,
  grant_title TEXT,
  total_awarded NUMERIC,
  total_expenses NUMERIC,
  remaining_budget NUMERIC,
  budget_utilization NUMERIC,
  expense_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id as grant_id,
    g.title as grant_title,
    COALESCE(g.amount_awarded, 0) as total_awarded,
    COALESCE(SUM(e.amount), 0) as total_expenses,
    COALESCE(g.amount_awarded, 0) - COALESCE(SUM(e.amount), 0) as remaining_budget,
    CASE 
      WHEN COALESCE(g.amount_awarded, 0) > 0 
      THEN (COALESCE(SUM(e.amount), 0) / g.amount_awarded * 100)
      ELSE 0 
    END as budget_utilization,
    COUNT(e.id)::integer as expense_count
  FROM grants g
  LEFT JOIN expenses e ON g.id = e.grant_id 
    AND (p_period_start IS NULL OR e.date >= p_period_start)
    AND (p_period_end IS NULL OR e.date <= p_period_end)
  WHERE (p_grant_ids IS NULL OR g.id = ANY(p_grant_ids))
  GROUP BY g.id, g.title, g.amount_awarded
  ORDER BY g.title;
END;
$$;