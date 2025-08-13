-- Fix view security issue and add management functions

-- Drop the problematic view and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS user_accessible_grants;

-- Create the view with proper RLS handling  
CREATE VIEW user_accessible_grants AS
SELECT 
  g.*,
  gta.role as user_role,
  gta.permissions as user_permissions,
  gta.assigned_at
FROM grants g
LEFT JOIN grant_team_assignments gta ON g.id = gta.grant_id 
  AND gta.user_id = auth.uid() 
  AND gta.is_active = true
WHERE g.id IN (
  SELECT grant_id FROM grant_team_assignments 
  WHERE user_id = auth.uid() AND is_active = true
  UNION ALL
  SELECT id FROM grants WHERE get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Grant necessary permissions
GRANT SELECT ON user_accessible_grants TO authenticated;

-- Create management functions with proper search_path
CREATE OR REPLACE FUNCTION public.assign_user_to_grant(
  target_user_id UUID,
  target_grant_id UUID,
  grant_role TEXT DEFAULT 'contributor',
  grant_permissions TEXT[] DEFAULT ARRAY['view']
)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
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
$$;

-- Create a function to remove user from grant
CREATE OR REPLACE FUNCTION public.remove_user_from_grant(
  target_user_id UUID,
  target_grant_id UUID
)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
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
$$;

-- Create a function to get user's grant assignments (for welcome screen)
CREATE OR REPLACE FUNCTION public.get_user_grant_assignments(user_id_param UUID DEFAULT auth.uid())
RETURNS TABLE(
  grant_id UUID,
  grant_title TEXT,
  grant_status TEXT,
  user_role TEXT,
  user_permissions TEXT[],
  assigned_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE 
SET search_path = 'public'
AS $$
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
$$;