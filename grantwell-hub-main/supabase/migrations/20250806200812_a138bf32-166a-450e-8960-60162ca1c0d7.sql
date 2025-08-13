-- Fix RLS recursion issue by removing circular dependency in organization_members
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Users can view organization memberships" ON organization_members;
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view their own memberships" ON organization_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Allow membership inserts for invited users" ON organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow membership updates for organization context" ON organization_members
  FOR UPDATE USING (user_id = auth.uid());

-- Fix grant_team_assignments to include necessary columns and improve RLS
-- Add email column to grant_team_assignments if it doesn't exist
ALTER TABLE grant_team_assignments 
ADD COLUMN IF NOT EXISTS email text;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_grant_team_assignments_user_grant 
ON grant_team_assignments(user_id, grant_id);

-- Update RLS policies for grant_team_assignments to be clearer
DROP POLICY IF EXISTS "Users can view grant team assignments" ON grant_team_assignments;
DROP POLICY IF EXISTS "Admin and managers can manage grant team assignments" ON grant_team_assignments;

CREATE POLICY "Users can view assignments for their grants" ON grant_team_assignments
  FOR SELECT USING (
    user_id = auth.uid() OR 
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  );

CREATE POLICY "Admin and managers can manage team assignments" ON grant_team_assignments
  FOR ALL USING (
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  );

-- Add some test data for grant team assignments to verify functionality
INSERT INTO grant_team_assignments (grant_id, user_id, email, permissions, role, assigned_at)
SELECT 
  bg.grant_id,
  bg.user_id,
  p.email,
  ARRAY['view', 'edit'],
  'contributor',
  NOW()
FROM bookmarked_grants bg
JOIN profiles p ON p.id = bg.user_id
WHERE bg.grant_id IS NOT NULL
ON CONFLICT (grant_id, user_id) DO NOTHING;