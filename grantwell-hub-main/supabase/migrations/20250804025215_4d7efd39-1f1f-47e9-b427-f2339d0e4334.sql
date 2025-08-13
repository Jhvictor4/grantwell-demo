-- Create notification triggers for grants

-- Function to create new grant notifications
CREATE OR REPLACE FUNCTION notify_new_grant()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Function to create deadline reminder notifications
CREATE OR REPLACE FUNCTION notify_deadline_reminder()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Function to create quarterly report reminders
CREATE OR REPLACE FUNCTION notify_quarterly_report()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_new_grant_notification ON discovered_grants;
CREATE TRIGGER trigger_new_grant_notification
  AFTER INSERT ON discovered_grants
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_grant();

DROP TRIGGER IF EXISTS trigger_deadline_reminder ON discovered_grants;  
CREATE TRIGGER trigger_deadline_reminder
  AFTER INSERT OR UPDATE OF deadline ON discovered_grants
  FOR EACH ROW
  EXECUTE FUNCTION notify_deadline_reminder();

-- Create notification preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  new_grant_alerts BOOLEAN DEFAULT true,
  deadline_reminders BOOLEAN DEFAULT true,
  quarterly_reports BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on notification preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own notification preferences
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());