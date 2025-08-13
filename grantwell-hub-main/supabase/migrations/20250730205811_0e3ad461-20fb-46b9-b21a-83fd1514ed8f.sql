-- Fix admin setup and enable proper user management
-- 1. First, let's check current user and set them as admin
UPDATE profiles 
SET role = 'admin', approval_status = 'approved' 
WHERE email = 'fosternewman@gmail.com';

-- 2. If the profile doesn't exist, create it
INSERT INTO profiles (email, role, approval_status, invited_at, approved_at)
VALUES ('fosternewman@gmail.com', 'admin', 'approved', now(), now())
ON CONFLICT (email) DO UPDATE SET 
  role = 'admin',
  approval_status = 'approved',
  approved_at = now();

-- 3. Enable signups for specific domains (.gov, .org)
-- Update the handle_new_user function to allow .gov and .org signups
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
    -- Allow .gov and .org domains to auto-register
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