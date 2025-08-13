-- Fix the remaining functions that still need search_path

CREATE OR REPLACE FUNCTION public.log_role_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only log when role changes
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO security_audit_log (
      user_id, 
      action, 
      table_name, 
      record_id, 
      old_values, 
      new_values
    ) VALUES (
      auth.uid(),
      'role_change',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role::text),
      jsonb_build_object('role', NEW.role::text)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_categorize_grant_sector()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Default to 'Other'
  NEW.sector := 'Other';
  
  -- Check for law enforcement indicators
  IF (
    NEW.agency ILIKE ANY(ARRAY['%DOJ%', '%Department of Justice%', '%COPS%', '%Office of Community Oriented Policing%', '%NIJ%', '%National Institute of Justice%', '%BJA%', '%Bureau of Justice Assistance%', '%OJP%', '%Office of Justice Programs%', '%DEA%', '%FBI%', '%ATF%', '%U.S. Marshals%', '%DHS%', '%Department of Homeland Security%']) 
    OR
    NEW.title ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%'])
    OR
    COALESCE(NEW.summary, '') ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%'])
  ) THEN
    NEW.sector := 'Law Enforcement';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix more remaining functions
CREATE OR REPLACE FUNCTION public.generate_deadline_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;