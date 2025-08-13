-- Phase 2: Update RLS Policies and Add Management Functions

-- Update grants RLS policies to enforce grant-level isolation
DROP POLICY IF EXISTS "Users can view their assigned grants" ON grants;
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
DROP POLICY IF EXISTS "Users can view tasks for their accessible grants" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks for their accessible grants" ON tasks;

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
DROP POLICY IF EXISTS "Users can view expenses for their accessible grants" ON expenses;

CREATE POLICY "Users can view expenses for their accessible grants" ON expenses
FOR SELECT USING (
  user_has_grant_access(auth.uid(), grant_id) OR
  get_user_role(auth.uid()) IN ('admin', 'manager')
);

-- Update budget_line_items RLS policies for grant isolation
DROP POLICY IF EXISTS "Users can view budget line items for their accessible grants" ON budget_line_items;
DROP POLICY IF EXISTS "Users can create budget line items for their accessible grants" ON budget_line_items;
DROP POLICY IF EXISTS "Users can update budget line items for their accessible grants" ON budget_line_items;

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

-- Update bookmarked_grants for isolation
DROP POLICY IF EXISTS "Users can view their accessible bookmarked grants" ON bookmarked_grants;

CREATE POLICY "Users can view their accessible bookmarked grants" ON bookmarked_grants
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