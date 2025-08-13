-- Fix security vulnerability in grant_team table
-- Replace overly permissive RLS policy with proper access control

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "All authenticated users can view grant team" ON public.grant_team;

-- Create new restrictive policy that only allows access to grant team info
-- for grants the user has access to
CREATE POLICY "Users can view grant team for accessible grants" 
ON public.grant_team
FOR SELECT 
USING (
  -- Users can only see team info for grants they have access to
  user_has_grant_access(auth.uid(), grant_id) OR 
  -- Admin and managers can see all grant teams
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);