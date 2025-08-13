-- Create budget categories table
CREATE TABLE public.budget_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default budget categories
INSERT INTO public.budget_categories (name, description) VALUES
  ('Personnel', 'Salaries, benefits, and personnel costs'),
  ('Equipment', 'Vehicles, technology, and hardware purchases'),
  ('Training', 'Professional development and training programs'),
  ('Operations', 'Day-to-day operational expenses'),
  ('Travel', 'Conference attendance and travel expenses'),
  ('Supplies', 'Office supplies and materials'),
  ('Contractual', 'External contractor and service costs'),
  ('Other', 'Miscellaneous expenses not covered elsewhere');

-- Create budget line items table
CREATE TABLE public.budget_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.budget_categories(id),
  item_name TEXT NOT NULL,
  description TEXT,
  budgeted_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  allocated_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER CHECK (quarter BETWEEN 1 AND 4),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhance existing expenses table with new columns
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS budget_line_item_id UUID REFERENCES public.budget_line_items(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Enhance existing milestones table with new columns  
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS completion_date DATE;
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100);
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS milestone_type TEXT DEFAULT 'deliverable' CHECK (milestone_type IN ('deliverable', 'outcome', 'reporting', 'compliance'));
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create outcome tracking table
CREATE TABLE public.outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id),
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('quantitative', 'qualitative')),
  metric_name TEXT NOT NULL,
  target_value TEXT,
  actual_value TEXT,
  measurement_date DATE,
  notes TEXT,
  evidence_url TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create grant team assignments table (for collaboration)
CREATE TABLE public.grant_team_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coordinator', 'reviewer', 'contributor', 'observer')),
  permissions TEXT[] DEFAULT ARRAY['view'],
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(grant_id, user_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_team_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for budget categories (public read, admin write)
CREATE POLICY "Everyone can view budget categories"
  ON public.budget_categories FOR SELECT
  USING (true);

CREATE POLICY "Admin and managers can manage budget categories"
  ON public.budget_categories FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS policies for budget line items
CREATE POLICY "Users can view budget line items for accessible grants"
  ON public.budget_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_team_assignments gta 
      WHERE gta.grant_id = budget_line_items.grant_id 
      AND gta.user_id = auth.uid()
    ) OR 
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  );

CREATE POLICY "Admin and managers can manage budget line items"
  ON public.budget_line_items FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Enhanced RLS policies for expenses (building on existing policies)
CREATE POLICY "Users can create expenses for their assigned grants"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grant_team_assignments gta 
      WHERE gta.grant_id = expenses.grant_id 
      AND gta.user_id = auth.uid()
      AND 'edit' = ANY(gta.permissions)
    ) OR
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  );

-- RLS policies for outcomes
CREATE POLICY "Users can view outcomes for accessible grants"
  ON public.outcomes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.grant_team_assignments gta 
      WHERE gta.grant_id = outcomes.grant_id 
      AND gta.user_id = auth.uid()
    ) OR 
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  );

CREATE POLICY "Admin and managers can manage outcomes"
  ON public.outcomes FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS policies for grant team assignments
CREATE POLICY "Users can view their own assignments"
  ON public.grant_team_assignments FOR SELECT
  USING (user_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admin and managers can manage assignments"
  ON public.grant_team_assignments FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add updated_at triggers
CREATE TRIGGER update_budget_line_items_updated_at
  BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outcomes_updated_at
  BEFORE UPDATE ON public.outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create budget summary function
CREATE OR REPLACE FUNCTION public.get_budget_summary(
  p_grant_id UUID,
  p_fiscal_year INTEGER DEFAULT NULL,
  p_quarter INTEGER DEFAULT NULL
)
RETURNS TABLE(
  total_budgeted NUMERIC,
  total_allocated NUMERIC,
  total_spent NUMERIC,
  total_remaining NUMERIC,
  utilization_rate NUMERIC,
  category_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH budget_data AS (
    SELECT 
      COALESCE(SUM(bli.budgeted_amount), 0) as budgeted,
      COALESCE(SUM(bli.allocated_amount), 0) as allocated,
      COALESCE(SUM(bli.spent_amount), 0) as spent,
      COALESCE(SUM(bli.budgeted_amount - bli.spent_amount), 0) as remaining
    FROM budget_line_items bli
    WHERE bli.grant_id = p_grant_id
      AND (p_fiscal_year IS NULL OR bli.fiscal_year = p_fiscal_year)
      AND (p_quarter IS NULL OR bli.quarter = p_quarter)
  ),
  category_data AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'category', bc.name,
        'budgeted', COALESCE(SUM(bli.budgeted_amount), 0),
        'spent', COALESCE(SUM(bli.spent_amount), 0),
        'remaining', COALESCE(SUM(bli.budgeted_amount - bli.spent_amount), 0)
      )
    ) as breakdown
    FROM budget_categories bc
    LEFT JOIN budget_line_items bli ON bc.id = bli.category_id 
      AND bli.grant_id = p_grant_id
      AND (p_fiscal_year IS NULL OR bli.fiscal_year = p_fiscal_year)
      AND (p_quarter IS NULL OR bli.quarter = p_quarter)
    GROUP BY bc.id, bc.name
  )
  SELECT 
    bd.budgeted as total_budgeted,
    bd.allocated as total_allocated,
    bd.spent as total_spent,
    bd.remaining as total_remaining,
    CASE 
      WHEN bd.budgeted > 0 THEN ROUND((bd.spent / bd.budgeted) * 100, 2)
      ELSE 0 
    END as utilization_rate,
    cd.breakdown as category_breakdown
  FROM budget_data bd
  CROSS JOIN category_data cd;
END;
$$;