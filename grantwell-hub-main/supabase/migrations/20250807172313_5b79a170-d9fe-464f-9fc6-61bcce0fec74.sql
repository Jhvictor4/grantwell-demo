-- Phase 1 (Corrected): Enhanced Multi-User Permissions with Grant-Level Isolation

-- First, let's enhance the grant_team_assignments table structure
ALTER TABLE grant_team_assignments 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_grant_team_assignments_user_grant 
ON grant_team_assignments(user_id, grant_id) WHERE is_active = true;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_grant_team_assignments_grant_active 
ON grant_team_assignments(grant_id) WHERE is_active = true;

-- Create a function to check if user has access to a specific grant
CREATE OR REPLACE FUNCTION public.user_has_grant_access(user_id_param UUID, grant_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Allow admins and managers to access all grants
  IF get_user_role(user_id_param) IN ('admin', 'manager') THEN
    RETURN true;
  END IF;
  
  -- Check if user is assigned to the grant
  RETURN EXISTS (
    SELECT 1 FROM grant_team_assignments 
    WHERE user_id = user_id_param 
    AND grant_id = grant_id_param 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to get user's accessible grant IDs
CREATE OR REPLACE FUNCTION public.get_user_grant_ids(user_id_param UUID DEFAULT auth.uid())
RETURNS UUID[] AS $$
BEGIN
  -- Allow admins and managers to access all grants
  IF get_user_role(user_id_param) IN ('admin', 'manager') THEN
    RETURN ARRAY(SELECT id FROM grants);
  END IF;
  
  -- Return only grants the user is assigned to
  RETURN ARRAY(
    SELECT grant_id FROM grant_team_assignments 
    WHERE user_id = user_id_param 
    AND grant_id IS NOT NULL 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check grant-level permissions
CREATE OR REPLACE FUNCTION public.user_has_grant_permission(
  user_id_param UUID, 
  grant_id_param UUID, 
  permission_param TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Allow admins and managers full permissions
  IF get_user_role(user_id_param) IN ('admin', 'manager') THEN
    RETURN true;
  END IF;
  
  -- Check specific grant permissions
  RETURN EXISTS (
    SELECT 1 FROM grant_team_assignments 
    WHERE user_id = user_id_param 
    AND grant_id = grant_id_param 
    AND is_active = true
    AND (permissions IS NULL OR permission_param = ANY(permissions))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;