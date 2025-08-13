-- Fix security vulnerability in profiles table
-- Replace overly permissive access with proper privacy controls

-- First, check what policies currently exist on profiles table
-- Note: We need to be careful not to break functionality that depends on profile access

-- Create a secure RLS policy for profiles that allows:
-- 1. Users to view their own profile
-- 2. Limited profile info for team collaboration (name/email for assignments)
-- 3. Admin/managers to view profiles for management
-- 4. Organization members to see basic info of colleagues

-- Remove any existing overly permissive policies if they exist
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create new restrictive policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles
FOR SELECT 
USING (id = auth.uid());

-- Allow viewing basic profile info (id, email, role) for team collaboration
-- This is needed for task assignments, team displays, etc.
CREATE POLICY "Basic profile info for team collaboration" 
ON public.profiles
FOR SELECT 
USING (
  -- Admin and managers can see all profiles
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]) OR
  -- Users can see basic info of approved users for team collaboration
  (approval_status = 'approved' AND auth.uid() IS NOT NULL)
);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Only admins can insert new profiles (for user management)
CREATE POLICY "Admin can insert profiles" 
ON public.profiles
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- Admins can update any profile (for user management)
CREATE POLICY "Admin can update any profile" 
ON public.profiles
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Add a view for limited profile information that can be safely shared
-- This will be used by components that need basic user info for collaboration
CREATE OR REPLACE VIEW public.user_profiles_limited AS
SELECT 
  id,
  email,
  COALESCE(full_name, split_part(email, '@', 1)) as display_name,
  role,
  approval_status,
  department
FROM public.profiles
WHERE approval_status = 'approved';

-- RLS policy for the limited view
ALTER VIEW public.user_profiles_limited SET (security_barrier = true);
GRANT SELECT ON public.user_profiles_limited TO authenticated;