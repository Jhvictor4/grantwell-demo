-- Security & Compliance Enhancements for Law Enforcement Pilot

-- 1. Create file audit logging table
CREATE TABLE IF NOT EXISTS file_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT,
  action TEXT NOT NULL CHECK (action IN ('upload', 'download', 'delete', 'view')),
  ip_address INET,
  user_agent TEXT,
  file_size BIGINT,
  mime_type TEXT,
  linked_feature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create IP whitelist settings table for departments
CREATE TABLE IF NOT EXISTS department_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_name TEXT NOT NULL,
  ip_address INET NOT NULL,
  ip_range CIDR,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(department_name, ip_address)
);

-- 3. Create document version control table
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_document_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_current_version BOOLEAN DEFAULT false,
  change_notes TEXT,
  grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
  UNIQUE(parent_document_id, version_number)
);

-- 4. Create security settings table
CREATE TABLE IF NOT EXISTS security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enhanced compliance files table (if not exists)
CREATE TABLE IF NOT EXISTS compliance_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  compliance_section TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  version_number INTEGER DEFAULT 1,
  audit_trail JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE file_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for file_audit_logs
CREATE POLICY "Users can view their own file audit logs" ON file_audit_logs
  FOR SELECT USING (user_id = auth.uid() OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "System can insert file audit logs" ON file_audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for department_ip_whitelist
CREATE POLICY "Admin can manage IP whitelist" ON department_ip_whitelist
  FOR ALL USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Managers can view IP whitelist" ON department_ip_whitelist
  FOR SELECT USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS Policies for document_versions
CREATE POLICY "Users can view document versions for accessible grants" ON document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = document_versions.grant_id
      AND gta.user_id = auth.uid()
      AND gta.is_active = true
    ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  );

CREATE POLICY "Users can create document versions for accessible grants" ON document_versions
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = document_versions.grant_id
        AND gta.user_id = auth.uid()
        AND gta.is_active = true
        AND 'edit' = ANY(gta.permissions)
      ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

-- RLS Policies for security_settings
CREATE POLICY "Admin can manage security settings" ON security_settings
  FOR ALL USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "Managers can view security settings" ON security_settings
  FOR SELECT USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS Policies for compliance_files
CREATE POLICY "Users can view compliance files for accessible grants" ON compliance_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = compliance_files.grant_id
      AND gta.user_id = auth.uid()
      AND gta.is_active = true
    ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  );

CREATE POLICY "Users can create compliance files for accessible grants" ON compliance_files
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = compliance_files.grant_id
        AND gta.user_id = auth.uid()
        AND gta.is_active = true
        AND 'edit' = ANY(gta.permissions)
      ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

CREATE POLICY "Users can update compliance files for accessible grants" ON compliance_files
  FOR UPDATE USING (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = compliance_files.grant_id
        AND gta.user_id = auth.uid()
        AND gta.is_active = true
        AND 'edit' = ANY(gta.permissions)
      ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
    )
  );

-- Function to log file actions
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
    current_setting('request.headers')::json->>'user-agent'
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Function to check RLS enforcement across all tables
CREATE OR REPLACE FUNCTION check_rls_enforcement()
RETURNS TABLE(table_name TEXT, rls_enabled BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    schemaname||'.'||tablename as table_name,
    rowsecurity as rls_enabled
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;

-- Function to create document version
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

-- Insert default security settings
INSERT INTO security_settings (setting_name, setting_value, description) VALUES
('session_timeout_minutes', '15', 'Session timeout in minutes for inactivity'),
('ip_whitelist_enabled', 'false', 'Enable IP address whitelisting'),
('file_audit_enabled', 'true', 'Enable comprehensive file audit logging'),
('max_file_size_mb', '100', 'Maximum file upload size in MB'),
('allowed_file_types', '["pdf","doc","docx","xls","xlsx","jpg","jpeg","png","txt"]', 'Allowed file upload types')
ON CONFLICT (setting_name) DO NOTHING;

-- Trigger to automatically log document uploads to contextual_documents
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

-- Create triggers for automatic file audit logging
DROP TRIGGER IF EXISTS contextual_documents_audit_trigger ON contextual_documents;
CREATE TRIGGER contextual_documents_audit_trigger
  AFTER INSERT OR DELETE ON contextual_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_file_audit_log();

DROP TRIGGER IF EXISTS document_storage_audit_trigger ON document_storage;
CREATE TRIGGER document_storage_audit_trigger
  AFTER INSERT OR DELETE ON document_storage
  FOR EACH ROW EXECUTE FUNCTION trigger_file_audit_log();