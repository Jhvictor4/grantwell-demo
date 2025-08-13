-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.generate_deadline_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert notifications for upcoming deadlines
  INSERT INTO public.notifications (user_id, grant_id, type, title, message, scheduled_for, related_id)
  SELECT 
    p.id as user_id,
    d.grant_id,
    'deadline_reminder'::notification_type,
    'Upcoming Deadline: ' || d.name,
    'Deadline "' || d.name || '" is due on ' || d.due_date::text || '. Don''t forget to complete this task.',
    (d.due_date - INTERVAL '7 days')::timestamp with time zone,
    d.id
  FROM deadlines d
  CROSS JOIN profiles p
  JOIN grant_team gt ON gt.grant_id = d.grant_id AND p.email = gt.email
  LEFT JOIN notification_preferences np ON np.user_id = p.id
  WHERE d.completed = false
    AND d.due_date >= CURRENT_DATE
    AND d.due_date <= CURRENT_DATE + INTERVAL '30 days'
    AND (np.deadline_reminders IS NULL OR np.deadline_reminders = true)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n 
      WHERE n.related_id = d.id 
        AND n.type = 'deadline_reminder' 
        AND n.user_id = p.id
    );
END;
$$;