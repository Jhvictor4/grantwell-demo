-- Add missing notification types to the enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_grant_available';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'quarterly_report_due';

-- Update the trigger function to use correct enum values
CREATE OR REPLACE FUNCTION public.notify_new_grant()
RETURNS trigger
LANGUAGE plpgsql
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
  WHERE p.role IN ('admin', 'manager', 'user')
    AND p.approval_status = 'approved';
    
  RETURN NEW;
END;
$function$;