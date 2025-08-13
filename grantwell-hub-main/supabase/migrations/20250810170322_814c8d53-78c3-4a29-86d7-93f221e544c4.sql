-- Fix function search path security issue
-- Update all custom functions to have explicit search_path

-- Update log_file_action function
CREATE OR REPLACE FUNCTION log_file_action(
  p_grant_id UUID,
  p_file_id UUID,
  p_file_name TEXT,
  p_action TEXT,
  p_file_path TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_linked_feature TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO file_audit_logs (
    grant_id,
    user_id,
    file_id,
    file_name,
    file_path,
    action,
    file_size,
    mime_type,
    linked_feature,
    ip_address,
    user_agent
  ) VALUES (
    p_grant_id,
    auth.uid(),
    p_file_id,
    p_file_name,
    p_file_path,
    p_action,
    p_file_size,
    p_mime_type,
    p_linked_feature,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Update trigger_file_audit_log function  
CREATE OR REPLACE FUNCTION trigger_file_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_file_action(
      NEW.grant_id,
      NEW.id,
      NEW.file_name,
      'upload',
      NEW.file_path,
      NEW.file_size,
      NEW.mime_type,
      NEW.linked_feature
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_file_action(
      OLD.grant_id,
      OLD.id,
      OLD.file_name,
      'delete',
      OLD.file_path,
      OLD.file_size,
      OLD.mime_type,
      OLD.linked_feature
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;