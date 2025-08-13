-- Fix security warnings for function search paths

-- Update execute_workflow_step function to fix search path
CREATE OR REPLACE FUNCTION execute_workflow_step(
  p_instance_id UUID,
  p_step_number INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Update track_data_lifecycle function to fix search path
CREATE OR REPLACE FUNCTION track_data_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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