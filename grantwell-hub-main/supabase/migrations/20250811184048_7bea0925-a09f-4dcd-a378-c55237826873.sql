-- Create subrecipients table
CREATE TABLE IF NOT EXISTS public.subrecipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  risk_level TEXT CHECK (risk_level IN ('Low','Medium','High')) DEFAULT 'Low',
  mou_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subrecipient_monitoring table
CREATE TABLE IF NOT EXISTS public.subrecipient_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subrecipient_id UUID NOT NULL REFERENCES public.subrecipients(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  notes TEXT,
  file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create grant_users table
CREATE TABLE IF NOT EXISTS public.grant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT CHECK (role IN ('Viewer','Editor','Admin')) NOT NULL DEFAULT 'Viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grant_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.subrecipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subrecipient_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_users ENABLE ROW LEVEL SECURITY;

-- RLS policies for subrecipients
CREATE POLICY "Users can view subrecipients for accessible grants"
ON public.subrecipients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta
    WHERE gta.grant_id = subrecipients.grant_id 
    AND gta.user_id = auth.uid()
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can manage subrecipients for accessible grants"
ON public.subrecipients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta
    WHERE gta.grant_id = subrecipients.grant_id 
    AND gta.user_id = auth.uid()
    AND 'edit'::text = ANY (gta.permissions)
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta
    WHERE gta.grant_id = subrecipients.grant_id 
    AND gta.user_id = auth.uid()
    AND 'edit'::text = ANY (gta.permissions)
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- RLS policies for subrecipient_monitoring
CREATE POLICY "Users can view subrecipient monitoring for accessible grants"
ON public.subrecipient_monitoring FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM subrecipients s 
    JOIN grant_team_assignments gta ON gta.grant_id = s.grant_id
    WHERE s.id = subrecipient_monitoring.subrecipient_id 
    AND gta.user_id = auth.uid()
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can manage subrecipient monitoring for accessible grants"
ON public.subrecipient_monitoring FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM subrecipients s 
    JOIN grant_team_assignments gta ON gta.grant_id = s.grant_id
    WHERE s.id = subrecipient_monitoring.subrecipient_id 
    AND gta.user_id = auth.uid()
    AND 'edit'::text = ANY (gta.permissions)
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subrecipients s 
    JOIN grant_team_assignments gta ON gta.grant_id = s.grant_id
    WHERE s.id = subrecipient_monitoring.subrecipient_id 
    AND gta.user_id = auth.uid()
    AND 'edit'::text = ANY (gta.permissions)
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- RLS policies for grant_users
CREATE POLICY "Users can view grant users for accessible grants"
ON public.grant_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta
    WHERE gta.grant_id = grant_users.grant_id 
    AND gta.user_id = auth.uid()
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Grant admins can manage grant users"
ON public.grant_users FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM grant_users gu
    WHERE gu.grant_id = grant_users.grant_id 
    AND gu.user_id = auth.uid() 
    AND gu.role = 'Admin'
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grant_users gu
    WHERE gu.grant_id = grant_users.grant_id 
    AND gu.user_id = auth.uid() 
    AND gu.role = 'Admin'
  ) 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);