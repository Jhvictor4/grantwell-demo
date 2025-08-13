-- Fix policies idempotently by dropping and recreating them if they exist

-- file_mappings policies
DROP POLICY IF EXISTS org_crud_file_mappings ON public.file_mappings;
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

-- subrecipients policies
DROP POLICY IF EXISTS org_crud_subrecipients ON public.subrecipients;
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

-- subrecipient_monitoring policies
DROP POLICY IF EXISTS org_crud_subrecipient_monitoring ON public.subrecipient_monitoring;
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
