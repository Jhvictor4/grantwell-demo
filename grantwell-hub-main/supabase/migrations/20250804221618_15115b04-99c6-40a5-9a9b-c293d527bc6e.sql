-- Continue fixing ALL remaining functions with search_path security issues

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_grant_application_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO grant_activity_logs (
      grant_application_id,
      action_type,
      description,
      old_values,
      new_values,
      performed_by
    ) VALUES (
      NEW.id,
      'status_update',
      CASE 
        WHEN OLD.status != NEW.status THEN 'Status changed from ' || OLD.status || ' to ' || NEW.status
        WHEN OLD.notes != NEW.notes OR (OLD.notes IS NULL AND NEW.notes IS NOT NULL) THEN 'Notes updated'
        WHEN OLD.assigned_to != NEW.assigned_to OR (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) THEN 'Assignment changed'
        ELSE 'Grant application updated'
      END,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_task_deadlines()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Mark tasks for 7-day reminders
    UPDATE tasks 
    SET reminder_date = due_date - INTERVAL '7 days'
    WHERE due_date IS NOT NULL 
    AND due_date BETWEEN NOW()::date + INTERVAL '7 days' AND NOW()::date + INTERVAL '8 days'
    AND reminder_date IS NULL;
    
    -- Mark tasks for 1-day reminders  
    UPDATE tasks 
    SET reminder_date = due_date - INTERVAL '1 day'
    WHERE due_date IS NOT NULL 
    AND due_date BETWEEN NOW()::date + INTERVAL '1 day' AND NOW()::date + INTERVAL '2 days'
    AND reminder_date IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_budget_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM calculate_budget_summary(NEW.grant_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM calculate_budget_summary(OLD.grant_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;