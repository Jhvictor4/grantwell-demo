-- Retry: finalize pending DB items with corrected EXECUTE quoting

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- file_mappings table and RLS/policies
CREATE TABLE IF NOT EXISTS public.file_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  template_type text NOT NULL,
  period_start date NULL,
  period_end date NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.file_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'file_mappings' AND policyname = 'Users can view file mappings for accessible grants'
  ) THEN
    DROP POLICY "Users can view file mappings for accessible grants" ON public.file_mappings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'file_mappings' AND policyname = 'Users can insert file mappings for accessible grants'
  ) THEN
    DROP POLICY "Users can insert file mappings for accessible grants" ON public.file_mappings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'file_mappings' AND policyname = 'Users can update file mappings for accessible grants'
  ) THEN
    DROP POLICY "Users can update file mappings for accessible grants" ON public.file_mappings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'file_mappings' AND policyname = 'Users can delete file mappings for accessible grants'
  ) THEN
    DROP POLICY "Users can delete file mappings for accessible grants" ON public.file_mappings;
  END IF;
END$$;

CREATE POLICY "Users can view file mappings for accessible grants"
ON public.file_mappings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = file_mappings.grant_id
      AND (
        g.owner_id = auth.uid()
        OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        OR g.organization_id IN (
          SELECT organization_members.organization_id
          FROM organization_members
          WHERE organization_members.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can insert file mappings for accessible grants"
ON public.file_mappings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = file_mappings.grant_id
      AND (
        g.owner_id = auth.uid()
        OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        OR g.organization_id IN (
          SELECT organization_members.organization_id
          FROM organization_members
          WHERE organization_members.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can update file mappings for accessible grants"
ON public.file_mappings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = file_mappings.grant_id
      AND (
        g.owner_id = auth.uid()
        OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        OR g.organization_id IN (
          SELECT organization_members.organization_id
          FROM organization_members
          WHERE organization_members.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = file_mappings.grant_id
      AND (
        g.owner_id = auth.uid()
        OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        OR g.organization_id IN (
          SELECT organization_members.organization_id
          FROM organization_members
          WHERE organization_members.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can delete file mappings for accessible grants"
ON public.file_mappings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.grants g
    WHERE g.id = file_mappings.grant_id
      AND (
        g.owner_id = auth.uid()
        OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
        OR g.organization_id IN (
          SELECT organization_members.organization_id
          FROM organization_members
          WHERE organization_members.user_id = auth.uid()
        )
      )
  )
);

CREATE INDEX IF NOT EXISTS idx_file_mappings_grant_id ON public.file_mappings(grant_id);
CREATE INDEX IF NOT EXISTS idx_file_mappings_created_at ON public.file_mappings(created_at DESC);

-- subrecipient_monitoring fixes with proper quoting
DO $plpgsql$
BEGIN
  IF to_regclass('public.subrecipient_monitoring') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subrecipient_monitoring' AND column_name = 'grant_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.subrecipient_monitoring ADD COLUMN grant_id uuid';
    END IF;

    EXECUTE 'ALTER TABLE public.subrecipient_monitoring ENABLE ROW LEVEL SECURITY';

    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'subrecipient_monitoring' AND policyname = 'org_crud_subrecipient_monitoring'
    ) THEN
      EXECUTE 'DROP POLICY "org_crud_subrecipient_monitoring" ON public.subrecipient_monitoring';
    END IF;

    EXECUTE 'CREATE POLICY "org_crud_subrecipient_monitoring" ON public.subrecipient_monitoring FOR ALL USING (EXISTS ( SELECT 1 FROM public.grants g WHERE g.id = subrecipient_monitoring.grant_id AND ( g.owner_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY[''admin''::app_role, ''manager''::app_role]) OR g.organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid() ) ) )) WITH CHECK (EXISTS ( SELECT 1 FROM public.grants g WHERE g.id = subrecipient_monitoring.grant_id AND ( g.owner_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY[''admin''::app_role, ''manager''::app_role]) OR g.organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid() ) ) ))';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'subrecipient_monitoring' AND indexname = 'idx_subrecipient_monitoring_grant_id'
    ) THEN
      EXECUTE 'CREATE INDEX idx_subrecipient_monitoring_grant_id ON public.subrecipient_monitoring(grant_id)';
    END IF;
  END IF;
END
$plpgsql$;

-- subrecipients alignment if exists
DO $plpgsql$
BEGIN
  IF to_regclass('public.subrecipients') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.subrecipients ENABLE ROW LEVEL SECURITY';

    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'subrecipients' AND policyname = 'org_crud_subrecipients'
    ) THEN
      EXECUTE 'DROP POLICY "org_crud_subrecipients" ON public.subrecipients';
    END IF;

    EXECUTE 'CREATE POLICY "org_crud_subrecipients" ON public.subrecipients FOR ALL USING (EXISTS ( SELECT 1 FROM public.grants g WHERE g.id = subrecipients.grant_id AND ( g.owner_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY[''admin''::app_role, ''manager''::app_role]) OR g.organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid() ) ) )) WITH CHECK (EXISTS ( SELECT 1 FROM public.grants g WHERE g.id = subrecipients.grant_id AND ( g.owner_id = auth.uid() OR get_user_role(auth.uid()) = ANY (ARRAY[''admin''::app_role, ''manager''::app_role]) OR g.organization_id IN ( SELECT organization_members.organization_id FROM organization_members WHERE organization_members.user_id = auth.uid() ) ) ))';

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'subrecipients' AND indexname = 'idx_subrecipients_grant_id'
    ) THEN
      EXECUTE 'CREATE INDEX idx_subrecipients_grant_id ON public.subrecipients(grant_id)';
    END IF;
  END IF;
END
$plpgsql$;