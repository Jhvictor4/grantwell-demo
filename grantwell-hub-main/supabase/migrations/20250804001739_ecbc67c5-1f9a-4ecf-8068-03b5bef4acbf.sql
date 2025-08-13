-- Add email provider configuration table
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'resend',
  api_key_name TEXT NOT NULL DEFAULT 'RESEND_API_KEY',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on email settings
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage email settings
CREATE POLICY "Admin can manage email settings" ON email_settings
  FOR ALL USING (get_user_role(auth.uid()) = 'admin'::app_role);

-- Add grant sync log table to track automatic grants sync
CREATE TABLE IF NOT EXISTS grant_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'federal' or 'state' or 'justgrants'
  grants_found INTEGER DEFAULT 0,
  grants_imported INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success', -- 'success', 'error', 'partial'
  error_message TEXT,
  sync_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on grant sync logs
ALTER TABLE grant_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admin and managers can view sync logs
CREATE POLICY "Admin and managers can view sync logs" ON grant_sync_logs
  FOR SELECT USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Insert default email settings
INSERT INTO email_settings (provider, api_key_name, is_enabled) VALUES ('resend', 'RESEND_API_KEY', true) ON CONFLICT DO NOTHING;

-- Enable realtime for discovered_grants and state_grants tables
ALTER TABLE discovered_grants REPLICA IDENTITY FULL;
ALTER TABLE state_grants REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE discovered_grants;
ALTER PUBLICATION supabase_realtime ADD TABLE state_grants;