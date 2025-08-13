-- Fix the profiles table constraint issue and set up admin access
-- First, let's fix the constraint issue by using 'id' instead of 'email' as the conflict target
INSERT INTO profiles (id, email, role, approval_status, invited_at, approved_at)
SELECT 
  gen_random_uuid(), 
  'fosternewman@gmail.com', 
  'admin'::app_role, 
  'approved', 
  now(), 
  now()
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'fosternewman@gmail.com');

-- Update existing record if it exists
UPDATE profiles 
SET role = 'admin'::app_role, 
    approval_status = 'approved',
    approved_at = now()
WHERE email = 'fosternewman@gmail.com';

-- Update the handle_new_user function to allow domain-based signups
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