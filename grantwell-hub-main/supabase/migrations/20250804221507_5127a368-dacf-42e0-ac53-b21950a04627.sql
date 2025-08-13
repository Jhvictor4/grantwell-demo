-- HIGH PRIORITY SECURITY FIX 1: Add RLS policies for tables without them

-- 1. Add RLS policies for State_Grant_Portals table
CREATE POLICY "Public read access for state grant portals" ON "State_Grant_Portals"
  FOR SELECT USING (true);

-- 2. Add RLS policies for state_grant_portals table (if different from above)
CREATE POLICY "Public read access for state grant portals lowercase" ON state_grant_portals
  FOR SELECT USING (true);

-- 3. Add RLS policies for grant_documents table
CREATE POLICY "Admin and managers can manage grant documents" ON grant_documents
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view grant documents" ON grant_documents
  FOR SELECT USING (true);

-- HIGH PRIORITY SECURITY FIX 2: Add search_path to critical functions
-- Fix the most critical functions first

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Remove potential XSS characters and limit length
  RETURN LEFT(REGEXP_REPLACE(COALESCE(input_text, ''), '[<>\"'']', '', 'g'), 1000);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_user_permissions(user_id uuid, required_role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN get_user_role(user_id) = required_role OR get_user_role(user_id) = 'admin'::app_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user has been pre-invited or has approved domain
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = NEW.email 
    AND approval_status = 'pending'
  ) THEN
    -- Allow .gov and .org domains to auto-register, plus fosternewman@gmail.com
    IF NEW.email LIKE '%.gov' OR NEW.email LIKE '%.org' OR NEW.email = 'fosternewman@gmail.com' THEN
      INSERT INTO public.profiles (
        id, 
        email, 
        role, 
        approval_status, 
        invited_at, 
        approved_at
      ) VALUES (
        NEW.id, 
        NEW.email, 
        CASE 
          WHEN NEW.email = 'fosternewman@gmail.com' THEN 'admin'::app_role
          ELSE 'viewer'::app_role 
        END,
        'approved', 
        NOW(), 
        NOW()
      );
    ELSE
      RAISE EXCEPTION 'Registration is by invitation only. Please contact an administrator.';
    END IF;
  ELSE
    -- Update the existing profile instead of creating a new one
    UPDATE public.profiles 
    SET id = NEW.id,
        updated_at = NOW()
    WHERE email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$function$;