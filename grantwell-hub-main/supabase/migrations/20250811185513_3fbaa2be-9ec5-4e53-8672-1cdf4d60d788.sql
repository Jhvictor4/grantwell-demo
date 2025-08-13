-- Deduplicate default auto-generated tasks and prevent future duplicates
-- 1) Mark known default tasks as auto_generated=true
UPDATE public.tasks
SET auto_generated = true
WHERE title IN (
  'Project Narrative Draft',
  'Quarterly Report Planning',
  'Budget Planning',
  'Vendor Proposals',
  'Document Collection',
  'File Upload Preparation',
  'Final Review',
  'Authorization Approval'
) AND (auto_generated IS DISTINCT FROM true);

-- 2) Remove duplicate auto-generated tasks per grant by title (keep earliest)
WITH ranked AS (
  SELECT ctid, ROW_NUMBER() OVER (
    PARTITION BY grant_id, title, COALESCE(auto_generated,false)
    ORDER BY created_at ASC
  ) AS rn
  FROM public.tasks
  WHERE COALESCE(auto_generated, false) = true
)
DELETE FROM public.tasks t
USING ranked r
WHERE t.ctid = r.ctid AND r.rn > 1;

-- 3) Add a unique constraint to prevent future duplicates of auto-generated tasks per title per grant
--    We include auto_generated in the key so user-created tasks with same title remain allowed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tasks_unique_grant_title_auto_generated'
  ) THEN
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_unique_grant_title_auto_generated
    UNIQUE (grant_id, title, auto_generated);
  END IF;
END $$;

-- 4) Update function to create closeout tasks using upsert semantics
CREATE OR REPLACE FUNCTION public.create_closeout_tasks_for_grant(p_grant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create closeout tasks for awarded grants (idempotent)
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
  (p_grant_id, 'Closeout Certification', 'Complete and submit closeout certification to funding agency', 'pending', 'high', 'closeout', true, NOW(), NOW())
  ON CONFLICT (grant_id, title, auto_generated) DO NOTHING;
END;
$$;

-- 5) Update auto_create_grant_for_bookmarked to mark default tasks as auto_generated and avoid duplicates
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
        WHEN 'preparation' THEN 'draft'::grant_status
        WHEN 'in_progress' THEN 'active'::grant_status
        WHEN 'submission' THEN 'active'::grant_status
        WHEN 'awarded' THEN 'active'::grant_status
        WHEN 'rejected' THEN 'closed'::grant_status
        ELSE 'draft'::grant_status
      END,
      NOW(),
      NOW()
    ) RETURNING id INTO new_grant_id;
    
    -- Update the bookmarked_grants record with the new grant_id
    NEW.grant_id := new_grant_id;
    
    -- Create default task templates for the new grant (idempotent)
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
    -- Narrative tasks
    (new_grant_id, 'Project Narrative Draft', 'Create the main project narrative document', 'pending', 'high', 'narrative', true, NOW(), NOW()),
    (new_grant_id, 'Quarterly Report Planning', 'Plan quarterly reporting structure and timeline', 'pending', 'medium', 'narrative', true, NOW(), NOW()),
    
    -- Budget tasks  
    (new_grant_id, 'Budget Planning', 'Create detailed budget breakdown', 'pending', 'high', 'budget', true, NOW(), NOW()),
    (new_grant_id, 'Vendor Proposals', 'Collect vendor quotes and proposals', 'pending', 'medium', 'budget', true, NOW(), NOW()),
    
    -- Document tasks
    (new_grant_id, 'Document Collection', 'Gather required supporting documents', 'pending', 'medium', 'documents', true, NOW(), NOW()),
    (new_grant_id, 'File Upload Preparation', 'Prepare final document uploads', 'pending', 'low', 'documents', true, NOW(), NOW()),
    
    -- Administrative tasks
    (new_grant_id, 'Final Review', 'Complete final review and compliance check', 'pending', 'high', 'admin', true, NOW(), NOW()),
    (new_grant_id, 'Authorization Approval', 'Obtain necessary approvals for submission', 'pending', 'high', 'admin', true, NOW(), NOW())
    ON CONFLICT (grant_id, title, auto_generated) DO NOTHING;
    
  END IF;
  
  RETURN NEW;
END;
$$;