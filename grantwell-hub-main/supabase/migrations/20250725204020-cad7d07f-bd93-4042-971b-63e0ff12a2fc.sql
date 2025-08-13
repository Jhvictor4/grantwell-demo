-- Fix function search path security warnings
SET search_path = public;

-- Update functions to include proper search_path settings
CREATE OR REPLACE FUNCTION validate_user_permissions(user_id UUID, required_role app_role)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN get_user_role(user_id) = required_role OR get_user_role(user_id) = 'admin'::app_role;
END;
$$;

CREATE OR REPLACE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT 
LANGUAGE plpgsql 
IMMUTABLE 
STRICT
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove potential XSS characters and limit length
  RETURN LEFT(REGEXP_REPLACE(COALESCE(input_text, ''), '[<>\"'']', '', 'g'), 1000);
END;
$$;

CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log when role changes
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO security_audit_log (
      user_id, 
      action, 
      table_name, 
      record_id, 
      old_values, 
      new_values
    ) VALUES (
      auth.uid(),
      'role_change',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role::text),
      jsonb_build_object('role', NEW.role::text)
    );
  END IF;
  RETURN NEW;
END;
$$;