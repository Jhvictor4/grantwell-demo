-- Security Enhancement Migration
-- Fix critical role management vulnerability and enhance security

-- 1. Drop existing potentially unsafe policies on profiles table
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Only admins can manage user roles" ON public.profiles;

-- 2. Create secure role management policies
-- Users can update their own profile EXCEPT the role field
CREATE POLICY "Users can update own profile data" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    -- Prevent users from updating their own role
    (OLD.role = NEW.role OR get_user_role(auth.uid()) = 'admin'::app_role)
  );

-- Only admins can update user roles
CREATE POLICY "Only admins can update user roles" ON public.profiles
  FOR UPDATE 
  USING (get_user_role(auth.uid()) = 'admin'::app_role)
  WITH CHECK (get_user_role(auth.uid()) = 'admin'::app_role);

-- 3. Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON security_audit_log
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" ON security_audit_log
  FOR INSERT WITH CHECK (true);

-- 4. Create function to log role changes
CREATE OR REPLACE FUNCTION log_role_changes()
RETURNS TRIGGER AS $$
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
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for role change auditing
DROP TRIGGER IF EXISTS audit_role_changes ON public.profiles;
CREATE TRIGGER audit_role_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_role_changes();

-- 6. Enhanced function to validate user permissions
CREATE OR REPLACE FUNCTION validate_user_permissions(user_id UUID, required_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role(user_id) = required_role OR get_user_role(user_id) = 'admin'::app_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. Add rate limiting table for sensitive operations
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient rate limiting queries
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_action_time 
ON rate_limit_log (user_id, action, created_at);

-- Enable RLS
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- System can manage rate limiting
CREATE POLICY "System can manage rate limits" ON rate_limit_log
  FOR ALL USING (true);

-- 8. Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
) RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM rate_limit_log
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
  RETURN attempt_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;