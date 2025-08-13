-- Remove the view entirely since it may be causing conflicts
-- Components should query the profiles table directly with proper RLS

DROP VIEW IF EXISTS public.user_profiles_limited;

-- Ensure the profiles table has proper RLS policies only
-- The existing policies we created should be sufficient for security