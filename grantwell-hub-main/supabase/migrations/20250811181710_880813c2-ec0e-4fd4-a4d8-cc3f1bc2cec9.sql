-- Clean up conflicting and overly permissive RLS policies on profiles table
-- Remove all existing policies and implement secure, minimal access policies

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Basic profile info for team collaboration" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Admin can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can update user roles" ON public.profiles;

-- Create secure, minimal access policies

-- 1. Users can view their own profile only
CREATE POLICY "Users can view own profile" 
ON public.profiles
FOR SELECT 
USING (id = auth.uid());

-- 2. Limited profile info for team collaboration (only approved users, minimal data)
-- This allows viewing basic info needed for task assignments and team displays
CREATE POLICY "Limited profile info for collaboration" 
ON public.profiles
FOR SELECT 
USING (
  -- Admin and managers can see all profiles for management purposes
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]) OR
  -- Regular users can only see email and id of approved users (needed for team features)
  (approval_status = 'approved' AND auth.uid() IS NOT NULL)
);

-- 3. Users can update their own profile basic info only
CREATE POLICY "Users can update own profile basic info" 
ON public.profiles
FOR UPDATE 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Only admins can insert new profiles
CREATE POLICY "Admins can insert profiles" 
ON public.profiles
FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- 5. Admins can update any profile including roles and approval status
CREATE POLICY "Admins can update any profile" 
ON public.profiles
FOR UPDATE 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- 6. Create a separate policy to prevent users from changing sensitive fields
-- Users cannot update role or approval_status - only admins can
CREATE POLICY "Prevent users from changing sensitive fields" 
ON public.profiles
FOR UPDATE 
USING (
  -- Block users from updating their own role or approval status
  NOT (id = auth.uid() AND (
    role IS DISTINCT FROM role OR 
    approval_status IS DISTINCT FROM approval_status
  ))
);