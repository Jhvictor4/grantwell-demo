-- Create DOJ file mappings table and Subrecipient tables with tenant-scoped RLS (idempotent on tables)

-- FILE: file_mappings
CREATE TABLE IF NOT EXISTS public.file_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL,
  storage_path text NOT NULL,
  template_type text NOT NULL CHECK (template_type IN (
    'SF-425','Drawdown Log','Match Certification','Monitoring Checklist','Narrative Report','Other'
  )),
  period_start date,
  period_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.file_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_crud_file_mappings ON public.file_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = file_mappings.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = file_mappings.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_file_mappings_grant ON public.file_mappings(grant_id);
CREATE INDEX IF NOT EXISTS idx_file_mappings_template ON public.file_mappings(template_type);

-- FILE: subrecipients
CREATE TABLE IF NOT EXISTS public.subrecipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  risk_level text NOT NULL CHECK (risk_level IN ('Low','Medium','High')),
  mou_file_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subrecipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_crud_subrecipients ON public.subrecipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = subrecipients.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = subrecipients.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_subrecipients_grant ON public.subrecipients(grant_id);
CREATE INDEX IF NOT EXISTS idx_subrecipients_risk ON public.subrecipients(risk_level);

-- FILE: subrecipient_monitoring
CREATE TABLE IF NOT EXISTS public.subrecipient_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subrecipient_id uuid NOT NULL REFERENCES public.subrecipients(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL,
  monitor_date date NOT NULL,
  notes text,
  file_id text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subrecipient_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_crud_subrecipient_monitoring ON public.subrecipient_monitoring
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = subrecipient_monitoring.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.grants g
      WHERE g.id = subrecipient_monitoring.grant_id
        AND (
          g.organization_id IN (
            SELECT organization_members.organization_id FROM public.organization_members
            WHERE organization_members.user_id = auth.uid()
          )
          OR g.owner_id = auth.uid()
          OR public.get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        )
    )
  );

CREATE INDEX IF NOT EXISTS idx_subrecipient_monitoring_grant ON public.subrecipient_monitoring(grant_id);
CREATE INDEX IF NOT EXISTS idx_subrecipient_monitoring_date ON public.subrecipient_monitoring(monitor_date);
