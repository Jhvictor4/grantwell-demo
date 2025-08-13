-- Add 'user' to the app_role enum if it doesn't exist
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'user';

-- Create application_tracking table as requested
CREATE TABLE IF NOT EXISTS public.application_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  due_date DATE,
  amount_min NUMERIC,
  amount_max NUMERIC,
  status TEXT DEFAULT 'not_started',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(grant_id, user_id)
);

-- Enable RLS on application_tracking
ALTER TABLE public.application_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for application_tracking
CREATE POLICY "Users can manage their own tracked applications"
ON public.application_tracking
FOR ALL
USING (user_id = auth.uid());

-- Update the notification trigger function to use correct enum values
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

-- Create updated_at trigger for application_tracking
CREATE TRIGGER update_application_tracking_updated_at
  BEFORE UPDATE ON public.application_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();