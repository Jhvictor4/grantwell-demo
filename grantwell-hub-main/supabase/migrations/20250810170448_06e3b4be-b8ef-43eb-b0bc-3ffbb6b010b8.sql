-- Recreate remaining functions with proper search_path to fix security warnings

-- Recreate create_document_version with explicit search_path
CREATE OR REPLACE FUNCTION create_document_version(
  p_parent_document_id UUID,
  p_file_name TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_grant_id UUID,
  p_change_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
  version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM document_versions
  WHERE parent_document_id = p_parent_document_id;
  
  -- Mark all previous versions as not current
  UPDATE document_versions
  SET is_current_version = false
  WHERE parent_document_id = p_parent_document_id;
  
  -- Create new version
  INSERT INTO document_versions (
    parent_document_id,
    version_number,
    file_name,
    file_path,
    file_size,
    mime_type,
    uploaded_by,
    is_current_version,
    change_notes,
    grant_id
  ) VALUES (
    p_parent_document_id,
    next_version,
    p_file_name,
    p_file_path,
    p_file_size,
    p_mime_type,
    auth.uid(),
    true,
    p_change_notes,
    p_grant_id
  ) RETURNING id INTO version_id;
  
  RETURN version_id;
END;
$$;

-- Recreate check_rls_enforcement with explicit search_path
CREATE OR REPLACE FUNCTION check_rls_enforcement()
RETURNS TABLE(table_name TEXT, rls_enabled BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    schemaname||'.'||tablename as table_name,
    rowsecurity as rls_enabled
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;