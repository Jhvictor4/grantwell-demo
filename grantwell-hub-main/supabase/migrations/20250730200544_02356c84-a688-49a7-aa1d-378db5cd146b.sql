-- Prevent public signup by creating a trigger that only allows invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only allow users who have been pre-invited (have a profile with pending status)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE email = NEW.email 
    AND approval_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Registration is by invitation only. Please contact an administrator.';
  END IF;
  
  -- Update the existing profile instead of creating a new one
  UPDATE public.profiles 
  SET id = NEW.id,
      updated_at = NOW()
  WHERE email = NEW.email;
  
  RETURN NEW;
END;
$function$;

-- Create a function for admins to invite users
CREATE OR REPLACE FUNCTION public.invite_user(
  user_email text,
  user_role app_role DEFAULT 'viewer',
  user_department text DEFAULT NULL,
  invited_by_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Add columns to profiles table for invitation tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invited_at timestamp with time zone;