-- Create comprehensive closeout system for DOJ compliance

-- Create closeout tasks table for tracking DOJ-mandated closeout requirements
CREATE TABLE IF NOT EXISTS grant_closeout_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('financial_report', 'programmatic_report', 'inventory_report', 'subrecipient_docs', 'records_retention', 'contact_info', 'final_verification')),
  assigned_user UUID REFERENCES profiles(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'submitted', 'accepted', 'rejected')) DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  file_url TEXT,
  notes TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create closeout status tracking table
CREATE TABLE IF NOT EXISTS grant_closeout_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL UNIQUE REFERENCES grants(id) ON DELETE CASCADE,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('not_started', 'in_progress', 'submitted', 'accepted', 'closed')) DEFAULT 'not_started',
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  internal_deadline DATE,
  assigned_compliance_officer UUID REFERENCES profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by UUID REFERENCES profiles(id),
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE grant_closeout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_closeout_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grant_closeout_tasks
CREATE POLICY "Users can view closeout tasks for accessible grants" 
ON grant_closeout_tasks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_closeout_tasks.grant_id 
    AND gta.user_id = auth.uid()
  ) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can create closeout tasks for accessible grants" 
ON grant_closeout_tasks 
FOR INSERT 
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_closeout_tasks.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit'::text = ANY (gta.permissions)
  )) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can update closeout tasks for accessible grants" 
ON grant_closeout_tasks 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_closeout_tasks.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit'::text = ANY (gta.permissions)
  )) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

-- RLS Policies for grant_closeout_status
CREATE POLICY "Users can view closeout status for accessible grants" 
ON grant_closeout_status 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_closeout_status.grant_id 
    AND gta.user_id = auth.uid()
  ) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can manage closeout status for accessible grants" 
ON grant_closeout_status 
FOR ALL 
USING (
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_closeout_status.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit'::text = ANY (gta.permissions)
  )) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
);

-- Create function to initialize closeout tasks for awarded grants
CREATE OR REPLACE FUNCTION public.initialize_closeout_tasks(p_grant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create default closeout status
  INSERT INTO grant_closeout_status (grant_id, overall_status, completion_percentage)
  VALUES (p_grant_id, 'not_started', 0)
  ON CONFLICT (grant_id) DO NOTHING;
  
  -- Create default closeout tasks based on DOJ requirements
  INSERT INTO grant_closeout_tasks (grant_id, task_name, task_type, status) VALUES
  (p_grant_id, 'Final Financial Report (SF-425)', 'financial_report', 'pending'),
  (p_grant_id, 'Final Programmatic Report', 'programmatic_report', 'pending'),
  (p_grant_id, 'Final Drawdown Complete', 'financial_report', 'pending'),
  (p_grant_id, 'Inventory Report (if applicable)', 'inventory_report', 'pending'),
  (p_grant_id, 'Subrecipient Documentation', 'subrecipient_docs', 'pending'),
  (p_grant_id, 'Records Retention Acknowledgement', 'records_retention', 'pending'),
  (p_grant_id, 'Contact Info for Audit', 'contact_info', 'pending'),
  (p_grant_id, 'No Outstanding Issues Confirmed', 'final_verification', 'pending')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Function to calculate closeout completion percentage
CREATE OR REPLACE FUNCTION public.calculate_closeout_completion(p_grant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_tasks INTEGER;
  completed_tasks INTEGER;
  completion_rate INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tasks
  FROM grant_closeout_tasks 
  WHERE grant_id = p_grant_id;
  
  SELECT COUNT(*) INTO completed_tasks
  FROM grant_closeout_tasks 
  WHERE grant_id = p_grant_id 
  AND status IN ('submitted', 'accepted');
  
  IF total_tasks = 0 THEN
    RETURN 0;
  END IF;
  
  completion_rate := ROUND((completed_tasks::DECIMAL / total_tasks::DECIMAL) * 100);
  
  -- Update the status table
  UPDATE grant_closeout_status 
  SET completion_percentage = completion_rate,
      updated_at = NOW()
  WHERE grant_id = p_grant_id;
  
  RETURN completion_rate;
END;
$$;

-- Trigger to update completion percentage when tasks change
CREATE OR REPLACE FUNCTION public.update_closeout_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM calculate_closeout_completion(COALESCE(NEW.grant_id, OLD.grant_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_closeout_completion ON grant_closeout_tasks;
CREATE TRIGGER trigger_update_closeout_completion
  AFTER INSERT OR UPDATE OR DELETE ON grant_closeout_tasks
  FOR EACH ROW EXECUTE FUNCTION update_closeout_completion();

-- Add updated_at triggers
CREATE TRIGGER update_grant_closeout_tasks_updated_at
  BEFORE UPDATE ON grant_closeout_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grant_closeout_status_updated_at
  BEFORE UPDATE ON grant_closeout_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();