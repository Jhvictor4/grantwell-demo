-- Add user approval system to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'denied'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Update handle_new_user function to set pending status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, approval_status)
  VALUES (NEW.id, NEW.email, 'viewer', 'pending');
  RETURN NEW;
END;
$function$;

-- Create function to approve users
CREATE OR REPLACE FUNCTION public.approve_user(user_id_param UUID, approver_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET approval_status = 'approved',
      approved_by = approver_id,
      approved_at = NOW()
  WHERE id = user_id_param;
END;
$function$;

-- Create function to track login activity  
CREATE OR REPLACE FUNCTION public.update_last_login(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE profiles 
  SET last_login = NOW()
  WHERE id = user_id_param;
END;
$function$;