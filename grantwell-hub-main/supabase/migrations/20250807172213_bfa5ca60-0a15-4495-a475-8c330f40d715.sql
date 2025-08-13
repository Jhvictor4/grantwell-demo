-- Phase 1: Enhanced Multi-User Permissions with Grant-Level Isolation

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

-- Update grants RLS policies to enforce grant-level isolation
DROP POLICY IF EXISTS "All authenticated users can view grants" ON grants;
DROP POLICY IF EXISTS "Admin and managers can update grants" ON grants;
DROP POLICY IF EXISTS "Admin and managers can create grants" ON grants;

-- New grant isolation policies
CREATE POLICY "Users can view their assigned grants" ON grants
FOR SELECT USING (
  user_has_grant_access(auth.uid(), id) OR 
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Admin and managers can create grants" ON grants
FOR INSERT WITH CHECK (
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Admin and managers can update grants" ON grants
FOR UPDATE USING (
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Update tasks RLS policies for grant isolation
DROP POLICY IF EXISTS "All authenticated users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks for accessible grants" ON tasks;

CREATE POLICY "Users can view tasks for their accessible grants" ON tasks
FOR SELECT USING (
  grant_id IS NULL OR 
  user_has_grant_access(auth.uid(), grant_id) OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Users can update tasks for their accessible grants" ON tasks
FOR UPDATE USING (
  (grant_id IS NULL OR user_has_grant_access(auth.uid(), grant_id)) AND
  (assigned_to = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'manager'))
);

-- Update expenses RLS policies for grant isolation  
DROP POLICY IF EXISTS "All authenticated users can view expenses" ON expenses;

CREATE POLICY "Users can view expenses for their accessible grants" ON expenses
FOR SELECT USING (
  user_has_grant_access(auth.uid(), grant_id) OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Update budget_line_items RLS policies for grant isolation
DROP POLICY IF EXISTS "Users can view budget line items for accessible grants" ON budget_line_items;

CREATE POLICY "Users can view budget line items for their accessible grants" ON budget_line_items
FOR SELECT USING (
  user_has_grant_access(auth.uid(), grant_id) OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Users can create budget line items for their accessible grants" ON budget_line_items
FOR INSERT WITH CHECK (
  user_has_grant_permission(auth.uid(), grant_id, 'edit') OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

CREATE POLICY "Users can update budget line items for their accessible grants" ON budget_line_items
FOR UPDATE USING (
  user_has_grant_permission(auth.uid(), grant_id, 'edit') OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Update discovered_grants and bookmarked_grants for isolation
-- Users should only see bookmarked grants they have access to
CREATE POLICY IF NOT EXISTS "Users can view their accessible bookmarked grants" ON bookmarked_grants
FOR SELECT USING (
  user_id = auth.uid() OR
  (grant_id IS NOT NULL AND user_has_grant_access(auth.uid(), grant_id)) OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Create a view for user's accessible grants (for easier querying)
CREATE OR REPLACE VIEW user_accessible_grants AS
SELECT 
  g.*,
  gta.role as user_role,
  gta.permissions as user_permissions,
  gta.assigned_at
FROM grants g
LEFT JOIN grant_team_assignments gta ON g.id = gta.grant_id AND gta.user_id = auth.uid() AND gta.is_active = true
WHERE user_has_grant_access(auth.uid(), g.id);

-- Grant necessary permissions
GRANT SELECT ON user_accessible_grants TO authenticated;

-- Create a function to assign user to grant (for admins)
CREATE OR REPLACE FUNCTION public.assign_user_to_grant(
  target_user_id UUID,
  target_grant_id UUID,
  grant_role TEXT DEFAULT 'contributor',
  grant_permissions TEXT[] DEFAULT ARRAY['view']
)
RETURNS UUID AS $$
DECLARE
  assignment_id UUID;
BEGIN
  -- Only admins and managers can assign users
  IF get_user_role(auth.uid()) NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only administrators and managers can assign users to grants';
  END IF;
  
  -- Insert or update assignment
  INSERT INTO grant_team_assignments (
    user_id, grant_id, role, permissions, assigned_by, assigned_at, is_active
  ) VALUES (
    target_user_id, target_grant_id, grant_role, grant_permissions, auth.uid(), NOW(), true
  )
  ON CONFLICT (user_id, grant_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    is_active = EXCLUDED.is_active
  RETURNING id INTO assignment_id;
  
  RETURN assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to remove user from grant
CREATE OR REPLACE FUNCTION public.remove_user_from_grant(
  target_user_id UUID,
  target_grant_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only admins and managers can remove users
  IF get_user_role(auth.uid()) NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only administrators and managers can remove users from grants';
  END IF;
  
  UPDATE grant_team_assignments 
  SET is_active = false 
  WHERE user_id = target_user_id AND grant_id = target_grant_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user's grant assignments (for welcome screen)
CREATE OR REPLACE FUNCTION public.get_user_grant_assignments(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE(
  grant_id UUID,
  grant_title TEXT,
  grant_status TEXT,
  user_role TEXT,
  user_permissions TEXT[],
  assigned_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.title,
    g.status::TEXT,
    gta.role,
    gta.permissions,
    gta.assigned_at
  FROM grants g
  JOIN grant_team_assignments gta ON g.id = gta.grant_id
  WHERE gta.user_id = user_id_param 
    AND gta.is_active = true
  ORDER BY gta.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;