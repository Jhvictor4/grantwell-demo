-- Create ERP export history table
CREATE TABLE IF NOT EXISTS erp_export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type TEXT NOT NULL CHECK (export_type IN ('budget', 'expenses', 'combined')),
  format TEXT NOT NULL CHECK (format IN ('munis', 'tyler', 'quickbooks', 'generic')),
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  file_size BIGINT,
  parameters JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  exported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE erp_export_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin and managers can manage export history" ON erp_export_history
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view their own exports" ON erp_export_history
  FOR SELECT USING (exported_by = auth.uid());

-- Add indexes for better performance
CREATE INDEX idx_erp_export_history_type ON erp_export_history(export_type);
CREATE INDEX idx_erp_export_history_format ON erp_export_history(format);
CREATE INDEX idx_erp_export_history_status ON erp_export_history(status);
CREATE INDEX idx_erp_export_history_created_at ON erp_export_history(created_at);

-- Create scheduled export jobs table
CREATE TABLE IF NOT EXISTS scheduled_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('budget', 'expenses', 'combined')),
  format TEXT NOT NULL CHECK (format IN ('munis', 'tyler', 'quickbooks', 'generic')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  schedule_config JSONB NOT NULL DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scheduled_export_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled jobs
CREATE POLICY "Admin and managers can manage scheduled jobs" ON scheduled_export_jobs
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view scheduled jobs" ON scheduled_export_jobs
  FOR SELECT USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_scheduled_export_jobs_updated_at
  BEFORE UPDATE ON scheduled_export_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();