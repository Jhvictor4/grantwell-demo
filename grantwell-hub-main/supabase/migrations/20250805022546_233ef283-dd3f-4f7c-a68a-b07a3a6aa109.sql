-- Step 1: Add grant_id column to bookmarked_grants to link to grants table
ALTER TABLE bookmarked_grants 
ADD COLUMN grant_id uuid REFERENCES grants(id);

-- Step 2: Create function to auto-create grants record when moving to preparation stage
CREATE OR REPLACE FUNCTION public.auto_create_grant_for_bookmarked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_grant_id UUID;
  discovered_grant_record discovered_grants%ROWTYPE;
BEGIN
  -- Only process if moving to preparation or later stages and no grant_id exists
  IF NEW.application_stage IN ('preparation', 'in_progress', 'submission', 'awarded', 'rejected') 
     AND NEW.grant_id IS NULL 
     AND (OLD.application_stage IS NULL OR OLD.application_stage = 'discovery') THEN
    
    -- Get the discovered grant details
    SELECT * INTO discovered_grant_record
    FROM discovered_grants 
    WHERE id = NEW.discovered_grant_id;
    
    -- Create a new grants record
    INSERT INTO grants (
      title,
      funder,
      amount_awarded,
      status,
      created_at,
      updated_at
    ) VALUES (
      discovered_grant_record.title,
      discovered_grant_record.agency,
      discovered_grant_record.funding_amount_max,
      CASE NEW.application_stage
        WHEN 'preparation' THEN 'draft'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'submission' THEN 'submitted'
        WHEN 'awarded' THEN 'awarded'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'draft'
      END,
      NOW(),
      NOW()
    ) RETURNING id INTO new_grant_id;
    
    -- Update the bookmarked_grants record with the new grant_id
    NEW.grant_id := new_grant_id;
    
    -- Create default task templates for the new grant
    INSERT INTO tasks (
      grant_id,
      title,
      description,
      status,
      priority,
      created_at,
      updated_at
    ) VALUES 
    -- Narrative tasks
    (new_grant_id, 'Project Narrative Draft', 'Create the main project narrative document', 'pending', 'high', NOW(), NOW()),
    (new_grant_id, 'Quarterly Report Planning', 'Plan quarterly reporting structure and timeline', 'pending', 'medium', NOW(), NOW()),
    
    -- Budget tasks  
    (new_grant_id, 'Budget Planning', 'Create detailed budget breakdown', 'pending', 'high', NOW(), NOW()),
    (new_grant_id, 'Vendor Proposals', 'Collect vendor quotes and proposals', 'pending', 'medium', NOW(), NOW()),
    
    -- Document tasks
    (new_grant_id, 'Document Collection', 'Gather required supporting documents', 'pending', 'medium', NOW(), NOW()),
    (new_grant_id, 'File Upload Preparation', 'Prepare final document uploads', 'pending', 'low', NOW(), NOW()),
    
    -- Administrative tasks
    (new_grant_id, 'Final Review', 'Complete final review and compliance check', 'pending', 'high', NOW(), NOW()),
    (new_grant_id, 'Authorization Approval', 'Obtain necessary approvals for submission', 'pending', 'high', NOW(), NOW());
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger for auto-creation
CREATE TRIGGER auto_create_grant_trigger
  BEFORE UPDATE ON bookmarked_grants
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_grant_for_bookmarked();

-- Step 4: Data migration for existing bookmarked grants in advanced stages
DO $$
DECLARE
  bookmark_record bookmarked_grants%ROWTYPE;
  discovered_grant_record discovered_grants%ROWTYPE;
  new_grant_id UUID;
BEGIN
  -- Loop through existing bookmarked grants that should have grants records
  FOR bookmark_record IN 
    SELECT * FROM bookmarked_grants 
    WHERE application_stage IN ('preparation', 'in_progress', 'submission', 'awarded', 'rejected')
    AND grant_id IS NULL
  LOOP
    -- Get the discovered grant details
    SELECT * INTO discovered_grant_record
    FROM discovered_grants 
    WHERE id = bookmark_record.discovered_grant_id;
    
    -- Create grants record
    INSERT INTO grants (
      title,
      funder,
      amount_awarded,
      status,
      created_at,
      updated_at
    ) VALUES (
      discovered_grant_record.title,
      discovered_grant_record.agency,
      discovered_grant_record.funding_amount_max,
      CASE bookmark_record.application_stage
        WHEN 'preparation' THEN 'draft'
        WHEN 'in_progress' THEN 'in_progress'
        WHEN 'submission' THEN 'submitted'
        WHEN 'awarded' THEN 'awarded'
        WHEN 'rejected' THEN 'rejected'
        ELSE 'draft'
      END,
      bookmark_record.created_at,
      NOW()
    ) RETURNING id INTO new_grant_id;
    
    -- Update bookmarked_grants with grant_id
    UPDATE bookmarked_grants 
    SET grant_id = new_grant_id
    WHERE id = bookmark_record.id;
    
    -- Create default tasks for migrated grants
    INSERT INTO tasks (
      grant_id,
      title,
      description,
      status,
      priority,
      created_at,
      updated_at
    ) VALUES 
    (new_grant_id, 'Project Narrative Draft', 'Create the main project narrative document', 'pending', 'high', NOW(), NOW()),
    (new_grant_id, 'Budget Planning', 'Create detailed budget breakdown', 'pending', 'high', NOW(), NOW()),
    (new_grant_id, 'Document Collection', 'Gather required supporting documents', 'pending', 'medium', NOW(), NOW()),
    (new_grant_id, 'Final Review', 'Complete final review and compliance check', 'pending', 'high', NOW(), NOW());
    
  END LOOP;
END $$;