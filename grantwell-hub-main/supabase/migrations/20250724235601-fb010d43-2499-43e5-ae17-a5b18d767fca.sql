-- Phase 3: Workflows & Data Tracking Database Schema

-- Create workflow status enum
CREATE TYPE workflow_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

-- Create trigger type enum  
CREATE TYPE trigger_type AS ENUM ('deadline_approaching', 'task_completed', 'milestone_reached', 'status_changed', 'manual', 'scheduled');

-- Create action type enum
CREATE TYPE action_type AS ENUM ('send_notification', 'create_task', 'update_status', 'send_email', 'create_milestone', 'generate_report');

-- Workflows table - defines reusable workflow templates
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  trigger_conditions JSONB DEFAULT '{}',
  workflow_steps JSONB DEFAULT '[]'
);

-- Workflow instances - tracks specific workflow executions
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  grant_id UUID,
  entity_type TEXT, -- 'grant', 'task', 'milestone', 'deadline'
  entity_id UUID,
  status workflow_status DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  current_step INTEGER DEFAULT 0,
  context_data JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id)
);

-- Workflow execution log - tracks each step execution
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action_type action_type NOT NULL,
  action_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result_data JSONB DEFAULT '{}'
);

-- Process tracking - monitors key business processes
CREATE TABLE process_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL,
  process_name TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  total_stages INTEGER NOT NULL,
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expected_completion TIMESTAMP WITH TIME ZONE,
  actual_completion TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'in_progress', -- 'not_started', 'in_progress', 'completed', 'blocked', 'delayed'
  blocking_issues JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Data lifecycle tracking
CREATE TABLE data_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'grant', 'task', 'document', etc.
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'archived', 'deleted', 'accessed'
  event_data JSONB DEFAULT '{}',
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

-- Automation rules - defines when workflows should be triggered
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type trigger_type NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_triggered TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflows
CREATE POLICY "Admin and managers can manage workflows" ON workflows
  FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view workflows" ON workflows
  FOR SELECT USING (true);

-- RLS Policies for workflow instances
CREATE POLICY "Admin and managers can manage workflow instances" ON workflow_instances
  FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view workflow instances" ON workflow_instances
  FOR SELECT USING (true);

-- RLS Policies for workflow executions
CREATE POLICY "Admin and managers can manage workflow executions" ON workflow_executions
  FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view workflow executions" ON workflow_executions
  FOR SELECT USING (true);

-- RLS Policies for process trackers
CREATE POLICY "Admin and managers can manage process trackers" ON process_trackers
  FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view process trackers" ON process_trackers
  FOR SELECT USING (true);

-- RLS Policies for data lifecycle events
CREATE POLICY "Admin can manage data lifecycle events" ON data_lifecycle_events
  FOR ALL USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "All authenticated users can view data lifecycle events" ON data_lifecycle_events
  FOR SELECT USING (true);

-- RLS Policies for automation rules
CREATE POLICY "Admin and managers can manage automation rules" ON automation_rules
  FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view automation rules" ON automation_rules
  FOR SELECT USING (true);

-- Create updated_at triggers
CREATE TRIGGER update_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_process_trackers_updated_at
  BEFORE UPDATE ON process_trackers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to trigger workflow execution
CREATE OR REPLACE FUNCTION execute_workflow_step(
  p_instance_id UUID,
  p_step_number INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workflow_step JSONB;
  v_action_type action_type;
  v_action_data JSONB;
  v_execution_id UUID;
BEGIN
  -- Get the workflow step
  SELECT 
    (workflow_steps->p_step_number::text) INTO v_workflow_step
  FROM workflows w
  JOIN workflow_instances wi ON w.id = wi.workflow_id
  WHERE wi.id = p_instance_id;

  IF v_workflow_step IS NULL THEN
    RETURN FALSE;
  END IF;

  v_action_type := (v_workflow_step->>'action_type')::action_type;
  v_action_data := v_workflow_step->'action_data';

  -- Create execution record
  INSERT INTO workflow_executions (
    workflow_instance_id,
    step_number,
    action_type,
    action_data,
    status
  ) VALUES (
    p_instance_id,
    p_step_number,
    v_action_type,
    v_action_data,
    'completed'
  ) RETURNING id INTO v_execution_id;

  -- Update workflow instance current step
  UPDATE workflow_instances 
  SET current_step = p_step_number + 1
  WHERE id = p_instance_id;

  RETURN TRUE;
END;
$$;

-- Function to track data lifecycle events automatically
CREATE OR REPLACE FUNCTION track_data_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO data_lifecycle_events (
    entity_type,
    entity_id,
    event_type,
    event_data,
    performed_by
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP
      WHEN 'INSERT' THEN 'created'
      WHEN 'UPDATE' THEN 'updated'
      WHEN 'DELETE' THEN 'deleted'
    END,
    CASE TG_OP
      WHEN 'INSERT' THEN to_jsonb(NEW)
      WHEN 'UPDATE' THEN jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      WHEN 'DELETE' THEN to_jsonb(OLD)
    END,
    auth.uid()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add lifecycle tracking triggers to key tables
CREATE TRIGGER track_grants_lifecycle
  AFTER INSERT OR UPDATE OR DELETE ON grants
  FOR EACH ROW EXECUTE FUNCTION track_data_lifecycle();

CREATE TRIGGER track_tasks_lifecycle
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION track_data_lifecycle();

CREATE TRIGGER track_documents_lifecycle
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION track_data_lifecycle();

-- Insert default workflows
INSERT INTO workflows (name, description, trigger_conditions, workflow_steps) VALUES
('Grant Deadline Reminder', 'Sends reminders for approaching grant deadlines', 
 '{"days_before": 7, "entity_type": "deadline"}',
 '[
   {"action_type": "send_notification", "action_data": {"template": "deadline_reminder"}},
   {"action_type": "create_task", "action_data": {"title": "Review upcoming deadline", "priority": "high"}}
 ]'),
('Task Completion Follow-up', 'Creates follow-up actions when tasks are completed',
 '{"entity_type": "task", "status_change": "completed"}',
 '[
   {"action_type": "send_notification", "action_data": {"template": "task_completed"}},
   {"action_type": "update_status", "action_data": {"update_progress": true}}
 ]'),
('New Grant Setup', 'Initializes standard processes for new grants',
 '{"entity_type": "grant", "event": "created"}',
 '[
   {"action_type": "create_milestone", "action_data": {"name": "Initial Review", "days_from_start": 7}},
   {"action_type": "create_task", "action_data": {"title": "Setup grant tracking", "priority": "medium"}},
   {"action_type": "send_notification", "action_data": {"template": "grant_created"}}
 ]');

-- Insert default automation rules
INSERT INTO automation_rules (name, description, trigger_type, trigger_conditions, workflow_id) 
SELECT 
  'Auto: ' || w.name,
  'Automatically triggers ' || w.name,
  'deadline_approaching'::trigger_type,
  w.trigger_conditions,
  w.id
FROM workflows w
WHERE w.name = 'Grant Deadline Reminder';

-- Insert sample process trackers for existing grants
INSERT INTO process_trackers (grant_id, process_name, current_stage, total_stages, progress_percentage)
SELECT 
  g.id,
  'Grant Lifecycle',
  CASE g.status 
    WHEN 'draft' THEN 'Planning'
    WHEN 'submitted' THEN 'Under Review'
    WHEN 'awarded' THEN 'Active Management'
    WHEN 'completed' THEN 'Closeout'
    ELSE 'Planning'
  END,
  5,
  CASE g.status 
    WHEN 'draft' THEN 20
    WHEN 'submitted' THEN 40
    WHEN 'awarded' THEN 60
    WHEN 'completed' THEN 100
    ELSE 10
  END
FROM grants g;