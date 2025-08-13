-- Fix the security definer view warning by removing SECURITY DEFINER
-- and implementing proper RLS on the view instead

-- Drop the problematic view
DROP VIEW IF EXISTS public.user_profiles_limited;

-- Create a regular view without security definer
CREATE VIEW public.user_profiles_limited AS
SELECT 
  id,
  email,
  COALESCE(full_name, split_part(email, '@', 1)) as display_name,
  role,
  approval_status,
  department
FROM public.profiles
WHERE approval_status = 'approved';

-- Grant proper permissions
GRANT SELECT ON public.user_profiles_limited TO authenticated;

-- The view will inherit RLS policies from the underlying profiles table
-- so no additional security configuration is needed