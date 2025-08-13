-- Fix RLS recursion in organization_members and grant_team_assignments
-- Replace problematic policies with simpler ones

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Organization members can view their organization members" ON organization_members;
DROP POLICY IF EXISTS "Grant team members can view team assignments" ON grant_team_assignments;
DROP POLICY IF EXISTS "Admin and managers can manage team assignments" ON grant_team_assignments;

-- Create simple, non-recursive policies for organization_members
CREATE POLICY "Members can view their own organization membership" 
ON organization_members FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage organization members" 
ON organization_members FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Create simple, non-recursive policies for grant_team_assignments
CREATE POLICY "Users can view team assignments for their grants" 
ON grant_team_assignments FOR SELECT 
USING (user_id = auth.uid() OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admin and managers can manage team assignments" 
ON grant_team_assignments FOR ALL 
USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can create team assignments for accessible grants" 
ON grant_team_assignments FOR INSERT 
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add missing policies for profiles table
CREATE POLICY "Admin and managers can view all profiles" 
ON profiles FOR SELECT 
USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (id = auth.uid());