-- Fix function search path mutable issue
-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.get_user_organizations(user_id UUID)
RETURNS TABLE(org_id UUID, org_name TEXT, role TEXT, permissions TEXT[])
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    o.id,
    o.name,
    om.role,
    om.permissions
  FROM public.organizations o
  JOIN public.organization_members om ON o.id = om.organization_id
  WHERE om.user_id = $1;
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(user_id UUID, org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members 
    WHERE user_id = $1 AND organization_id = $2
  );
$$;

CREATE OR REPLACE FUNCTION public.get_organization_role(user_id UUID, org_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.organization_members 
  WHERE user_id = $1 AND organization_id = $2;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;