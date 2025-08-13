-- Create grant_activity_log table for tracking user interactions
CREATE TABLE IF NOT EXISTS grant_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for activity log
ALTER TABLE grant_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view activity for grants they have access to
CREATE POLICY "Users can view activity for accessible grants" 
ON grant_activity_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta
    WHERE gta.grant_id = grant_activity_log.grant_id 
    AND gta.user_id = auth.uid()
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" 
ON grant_activity_log 
FOR INSERT 
WITH CHECK (true);

-- Admin and managers can manage all activity logs
CREATE POLICY "Admin and managers can manage activity logs" 
ON grant_activity_log 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_grant_id ON grant_activity_log(grant_id);
CREATE INDEX IF NOT EXISTS idx_grant_activity_log_timestamp ON grant_activity_log(timestamp DESC);

-- Create function to log grant activities
CREATE OR REPLACE FUNCTION log_grant_activity(
  p_grant_id UUID,
  p_action TEXT,
  p_description TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO grant_activity_log (
    grant_id,
    user_id,
    action,
    description,
    payload
  ) VALUES (
    p_grant_id,
    p_user_id,
    p_action,
    p_description,
    p_payload
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;