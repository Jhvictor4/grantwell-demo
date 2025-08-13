-- Ensure subrecipient_monitoring has grant_id column for RLS policy
ALTER TABLE public.subrecipient_monitoring ADD COLUMN IF NOT EXISTS grant_id uuid;

-- Recreate policy now that column exists
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
