-- Complete RLS fix and closeout task automation

-- First, fix the remaining RLS recursion issues
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization members can view their organization members" ON organization_members;

-- Create non-recursive organization policies
CREATE POLICY "Users can view their own membership" 
ON organization_members FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all memberships" 
ON organization_members FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Ensure profiles policies work without recursion
DROP POLICY IF EXISTS "Admin and managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "All authenticated users can view profiles" 
ON profiles FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create function to auto-generate closeout tasks when grant is awarded
CREATE OR REPLACE FUNCTION create_closeout_tasks_for_grant(p_grant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create closeout tasks for awarded grants
  INSERT INTO tasks (
    grant_id,
    title,
    description,
    status,
    priority,
    category,
    auto_generated,
    created_at,
    updated_at
  ) VALUES 
  (p_grant_id, 'Final Project Report', 'Prepare and submit final project report documenting outcomes and impact', 'pending', 'high', 'closeout', true, NOW(), NOW()),
  (p_grant_id, 'Financial Closeout Documentation', 'Complete all required financial reporting and documentation', 'pending', 'high', 'closeout', true, NOW(), NOW()),
  (p_grant_id, 'Equipment Disposition Report', 'Document disposition of all equipment purchased with grant funds', 'pending', 'medium', 'closeout', true, NOW(), NOW()),
  (p_grant_id, 'Unspent Funds Return', 'Process return of any unspent grant funds to awarding agency', 'pending', 'medium', 'closeout', true, NOW(), NOW()),
  (p_grant_id, 'Final SF-425 Submission', 'Submit final Federal Financial Report (SF-425)', 'pending', 'high', 'closeout', true, NOW(), NOW()),
  (p_grant_id, 'Closeout Certification', 'Complete and submit closeout certification to funding agency', 'pending', 'high', 'closeout', true, NOW(), NOW());
END;
$$;

-- Add trigger to auto-create closeout tasks when grant status changes to awarded
CREATE OR REPLACE FUNCTION trigger_closeout_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When a bookmarked grant moves to awarded status, create closeout tasks
  IF NEW.status = 'awarded' AND (OLD.status IS NULL OR OLD.status != 'awarded') AND NEW.grant_id IS NOT NULL THEN
    PERFORM create_closeout_tasks_for_grant(NEW.grant_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_create_closeout_tasks ON bookmarked_grants;
CREATE TRIGGER auto_create_closeout_tasks
  AFTER UPDATE ON bookmarked_grants
  FOR EACH ROW
  EXECUTE FUNCTION trigger_closeout_tasks();

-- Add category and auto_generated columns to tasks if they don't exist
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE tasks ADD COLUMN category text;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE tasks ADD COLUMN auto_generated boolean DEFAULT false;
  EXCEPTION
    WHEN duplicate_column THEN NULL;
  END;
END $$;