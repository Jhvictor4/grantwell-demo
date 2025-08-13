-- Continue fixing remaining functions with search_path security issue

CREATE OR REPLACE FUNCTION public.approve_user(user_id_param uuid, approver_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET approval_status = 'approved',
      approved_by = approver_id,
      approved_at = NOW()
  WHERE id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_last_login(user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET last_login = NOW()
  WHERE id = user_id_param;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_user(user_email text, user_role app_role DEFAULT 'viewer'::app_role, user_department text DEFAULT NULL::text, invited_by_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_profile_id uuid;
BEGIN
  -- Check if the inviting user is an admin
  IF get_user_role(invited_by_id) != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can invite users';
  END IF;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = user_email) THEN
    RAISE EXCEPTION 'User with email % already exists', user_email;
  END IF;
  
  -- Create a pending profile
  INSERT INTO public.profiles (
    email,
    role,
    department,
    approval_status,
    invited_by,
    invited_at
  ) VALUES (
    user_email,
    user_role,
    user_department,
    'pending',
    invited_by_id,
    NOW()
  ) RETURNING id INTO new_profile_id;
  
  RETURN new_profile_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_budget_summary(p_grant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total_awarded DECIMAL(15,2);
    v_total_spent DECIMAL(15,2);
    v_remaining DECIMAL(15,2);
BEGIN
    -- Get total awarded from grants table
    SELECT COALESCE(amount_awarded, 0) INTO v_total_awarded
    FROM grants WHERE id = p_grant_id;
    
    -- Calculate total spent from expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_spent
    FROM expenses WHERE grant_id = p_grant_id;
    
    v_remaining := v_total_awarded - v_total_spent;
    
    -- Insert or update budget summary
    INSERT INTO budget_summaries (grant_id, total_awarded, total_spent, remaining_funds)
    VALUES (p_grant_id, v_total_awarded, v_total_spent, v_remaining)
    ON CONFLICT (grant_id) 
    DO UPDATE SET 
        total_awarded = v_total_awarded,
        total_spent = v_total_spent,
        remaining_funds = v_remaining,
        last_updated = NOW();
END;
$function$;