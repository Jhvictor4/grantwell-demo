-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization_members table for org-specific roles
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Create organization_invitations table
CREATE TABLE public.organization_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all organization tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_invitations_org_id ON public.organization_invitations(organization_id);
CREATE INDEX idx_organization_invitations_email ON public.organization_invitations(email);

-- Add organization_id to existing tables that need org-scoping
ALTER TABLE public.grants ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.discovered_grants ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.bookmarked_grants ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tasks ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create indexes for org-scoped queries
CREATE INDEX idx_grants_organization_id ON public.grants(organization_id);
CREATE INDEX idx_discovered_grants_organization_id ON public.discovered_grants(organization_id);
CREATE INDEX idx_bookmarked_grants_organization_id ON public.bookmarked_grants(organization_id);
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);

-- Function to get user's organization memberships
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
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  WHERE om.user_id = $1;
$$;

-- Function to check organization membership
CREATE OR REPLACE FUNCTION public.is_organization_member(user_id UUID, org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM organization_members 
    WHERE user_id = $1 AND organization_id = $2
  );
$$;

-- Function to get user's organization role
CREATE OR REPLACE FUNCTION public.get_organization_role(user_id UUID, org_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM organization_members 
  WHERE user_id = $1 AND organization_id = $2;
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() AND organization_id = organizations.id
    )
  );

CREATE POLICY "Organization admins can manage their organization" ON public.organizations
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organizations.id 
      AND role = 'admin'
    )
  );

-- RLS Policies for organization_members
CREATE POLICY "Users can view members of their organizations" ON public.organization_members
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM organization_members om2 
      WHERE om2.user_id = auth.uid() AND om2.organization_id = organization_members.organization_id
    )
  );

CREATE POLICY "Organization admins can manage members" ON public.organization_members
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM organization_members om2 
      WHERE om2.user_id = auth.uid() 
      AND om2.organization_id = organization_members.organization_id 
      AND om2.role = 'admin'
    )
  );

-- RLS Policies for organization_invitations
CREATE POLICY "Organization admins can manage invitations" ON public.organization_invitations
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND organization_id = organization_invitations.organization_id 
      AND role = 'admin'
    )
  );

-- Update existing RLS policies to consider organization membership
DROP POLICY IF EXISTS "Users can view tasks for accessible grants" ON public.tasks;
CREATE POLICY "Users can view tasks for accessible grants" ON public.tasks
  FOR SELECT USING (
    (organization_id IS NULL) OR
    (EXISTS(
      SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() AND organization_id = tasks.organization_id
    )) OR
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_organization_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_updated_at();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_updated_at();