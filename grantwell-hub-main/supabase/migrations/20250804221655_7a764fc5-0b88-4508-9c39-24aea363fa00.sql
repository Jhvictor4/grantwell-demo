-- Fix the remaining 3 functions with search_path issues

CREATE OR REPLACE FUNCTION public.notify_deadline_reminder()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create notifications for tracked grants
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    grant_id,
    scheduled_for
  )
  SELECT 
    bg.user_id,
    'deadline_reminder'::notification_type,
    '7-Day Deadline Reminder: ' || dg.title,
    'The deadline for "' || dg.title || '" is approaching in 7 days (' || dg.deadline || '). Please ensure your application is ready.',
    dg.id,
    (dg.deadline - INTERVAL '7 days')::timestamp with time zone
  FROM bookmarked_grants bg
  JOIN discovered_grants dg ON bg.discovered_grant_id = dg.id
  WHERE dg.id = NEW.id
    AND dg.deadline IS NOT NULL
    AND dg.deadline > NOW()::date + INTERVAL '7 days'
    AND bg.status IN ('draft', 'in_progress');
    
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_quarterly_report()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_quarter integer;
  next_quarter_start date;
BEGIN
  -- Calculate current quarter and next quarter start
  current_quarter := EXTRACT(quarter FROM NOW());
  next_quarter_start := date_trunc('quarter', NOW()) + INTERVAL '3 months';
  
  -- Insert quarterly report notifications for awarded grants
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    grant_id,
    scheduled_for
  )
  SELECT 
    bg.user_id,
    'quarterly_report_due'::notification_type,
    'Quarterly Report Due: ' || dg.title,
    'Your quarterly report for "' || dg.title || '" is due soon. Please prepare and submit your progress report.',
    dg.id,
    (next_quarter_start - INTERVAL '14 days')::timestamp with time zone
  FROM bookmarked_grants bg
  JOIN discovered_grants dg ON bg.discovered_grant_id = dg.id
  WHERE bg.status = 'awarded'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = bg.user_id
        AND n.grant_id = dg.id
        AND n.type = 'quarterly_report_due'
        AND n.scheduled_for >= NOW() - INTERVAL '3 months'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_new_grant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert notification for all users interested in grants
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    grant_id,
    scheduled_for
  )
  SELECT 
    p.id,
    'new_grant_available'::notification_type,
    'New Grant Available: ' || NEW.title,
    'A new grant opportunity has been discovered: "' || NEW.title || '" from ' || NEW.agency || '. Deadline: ' || COALESCE(NEW.deadline::text, 'Not specified') || '.',
    NEW.id,
    NOW()
  FROM profiles p
  WHERE p.role IN ('admin'::app_role, 'manager'::app_role, 'user'::app_role, 'viewer'::app_role)
    AND p.approval_status = 'approved';
    
  RETURN NEW;
END;
$function$;