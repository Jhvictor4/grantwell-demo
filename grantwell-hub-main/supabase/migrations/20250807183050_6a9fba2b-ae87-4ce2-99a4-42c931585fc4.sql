-- Fix security warning: Add search_path to the function
CREATE OR REPLACE FUNCTION public.update_grant_progress_section(
  p_grant_id UUID,
  p_section TEXT,
  p_complete BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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