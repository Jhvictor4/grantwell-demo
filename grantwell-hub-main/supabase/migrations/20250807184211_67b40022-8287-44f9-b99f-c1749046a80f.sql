-- Add discovered_grant_id column to grants table to link back to opportunities
ALTER TABLE public.grants 
ADD COLUMN discovered_grant_id UUID REFERENCES public.discovered_grants(id);

-- Add index for better performance
CREATE INDEX idx_grants_discovered_grant_id ON public.grants(discovered_grant_id);

-- Create function to promote bookmarked grant to workspace
CREATE OR REPLACE FUNCTION public.promote_to_workspace(
  p_bookmark_id UUID,
  p_award_amount NUMERIC DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_grant_id UUID;
  v_bookmark_record bookmarked_grants%ROWTYPE;
  v_discovered_record discovered_grants%ROWTYPE;
BEGIN
  -- Get bookmark record
  SELECT * INTO v_bookmark_record
  FROM bookmarked_grants 
  WHERE id = p_bookmark_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bookmark not found';
  END IF;
  
  -- Get discovered grant details
  SELECT * INTO v_discovered_record
  FROM discovered_grants 
  WHERE id = v_bookmark_record.discovered_grant_id;
  
  -- Create or update grants record
  IF v_bookmark_record.grant_id IS NULL THEN
    -- Create new grant record
    INSERT INTO grants (
      title,
      funder,
      amount_awarded,
      status,
      start_date,
      end_date,
      discovered_grant_id,
      owner_id,
      created_at,
      updated_at
    ) VALUES (
      v_discovered_record.title,
      v_discovered_record.agency,
      COALESCE(p_award_amount, v_discovered_record.funding_amount_max),
      'active'::grant_status,
      p_start_date,
      p_end_date,
      v_bookmark_record.discovered_grant_id,
      v_bookmark_record.user_id,
      NOW(),
      NOW()
    ) RETURNING id INTO v_grant_id;
    
    -- Update bookmarked grant with grant_id
    UPDATE bookmarked_grants 
    SET grant_id = v_grant_id,
        application_stage = 'awarded',
        status = 'awarded',
        updated_at = NOW()
    WHERE id = p_bookmark_id;
    
  ELSE
    -- Update existing grant record
    v_grant_id := v_bookmark_record.grant_id;
    
    UPDATE grants 
    SET amount_awarded = COALESCE(p_award_amount, amount_awarded),
        start_date = COALESCE(p_start_date, start_date),
        end_date = COALESCE(p_end_date, end_date),
        status = 'active'::grant_status,
        updated_at = NOW()
    WHERE id = v_grant_id;
  END IF;
  
  -- Auto-assign user to grant team if not already assigned
  INSERT INTO grant_team_assignments (
    user_id,
    grant_id,
    role,
    permissions,
    assigned_by,
    assigned_at,
    is_active
  ) VALUES (
    v_bookmark_record.user_id,
    v_grant_id,
    'coordinator',
    ARRAY['view', 'edit', 'manage'],
    v_bookmark_record.user_id,
    NOW(),
    true
  ) ON CONFLICT (user_id, grant_id) DO UPDATE SET
    is_active = true,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions;
  
  RETURN v_grant_id;
END;
$$;