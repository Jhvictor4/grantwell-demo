-- Alter the existing view to use SECURITY INVOKER mode
-- This will make the view respect the permissions and RLS policies of the user making the query
ALTER VIEW public.user_accessible_grants
SET (security_invoker = true);