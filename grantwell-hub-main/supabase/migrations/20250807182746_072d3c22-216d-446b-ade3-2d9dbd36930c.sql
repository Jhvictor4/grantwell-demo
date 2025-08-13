-- Add owner_id to grants table
ALTER TABLE public.grants ADD COLUMN owner_id UUID REFERENCES auth.users(id);

-- Update RLS policies for grants table to include owner access
DROP POLICY IF EXISTS "Users can view accessible grants" ON public.grants;
CREATE POLICY "Users can view accessible grants" 
ON public.grants 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grants.id AND gta.user_id = auth.uid()
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- Create grant progress tracking table for the progress bar
CREATE TABLE public.grant_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  overview_complete BOOLEAN NOT NULL DEFAULT false,
  narrative_complete BOOLEAN NOT NULL DEFAULT false,
  compliance_complete BOOLEAN NOT NULL DEFAULT false,
  budget_complete BOOLEAN NOT NULL DEFAULT false,
  tasks_complete BOOLEAN NOT NULL DEFAULT false,
  attachments_complete BOOLEAN NOT NULL DEFAULT false,
  closeout_complete BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(grant_id)
);

-- Enable RLS on grant_progress
ALTER TABLE public.grant_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for grant_progress
CREATE POLICY "Users can view progress for accessible grants"
ON public.grant_progress
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_progress.grant_id AND gta.user_id = auth.uid()
  ) OR 
  EXISTS (
    SELECT 1 FROM public.grants g 
    WHERE g.id = grant_progress.grant_id AND g.owner_id = auth.uid()
  ) OR
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can update progress for accessible grants"
ON public.grant_progress
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_progress.grant_id AND gta.user_id = auth.uid() AND 'edit'::text = ANY (gta.permissions)
  ) OR 
  EXISTS (
    SELECT 1 FROM public.grants g 
    WHERE g.id = grant_progress.grant_id AND g.owner_id = auth.uid()
  ) OR
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- Create function to update grant progress
CREATE OR REPLACE FUNCTION public.update_grant_progress_section(
  p_grant_id UUID,
  p_section TEXT,
  p_complete BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.grant_progress (grant_id)
  VALUES (p_grant_id)
  ON CONFLICT (grant_id) DO NOTHING;
  
  CASE p_section
    WHEN 'overview' THEN
      UPDATE public.grant_progress SET overview_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'narrative' THEN
      UPDATE public.grant_progress SET narrative_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'compliance' THEN
      UPDATE public.grant_progress SET compliance_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'budget' THEN
      UPDATE public.grant_progress SET budget_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'tasks' THEN
      UPDATE public.grant_progress SET tasks_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'attachments' THEN
      UPDATE public.grant_progress SET attachments_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
    WHEN 'closeout' THEN
      UPDATE public.grant_progress SET closeout_complete = p_complete, updated_at = now() WHERE grant_id = p_grant_id;
  END CASE;
END;
$$;