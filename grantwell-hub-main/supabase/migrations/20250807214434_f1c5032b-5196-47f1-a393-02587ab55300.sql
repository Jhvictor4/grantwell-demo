
-- 1) Ensure pipeline creates a workspace grant automatically
DROP TRIGGER IF EXISTS trg_auto_create_grant_for_bookmarked ON public.bookmarked_grants;

CREATE TRIGGER trg_auto_create_grant_for_bookmarked
AFTER INSERT OR UPDATE ON public.bookmarked_grants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_grant_for_bookmarked();

-- 2) Team-shared notes for grant overview
CREATE TABLE IF NOT EXISTS public.grant_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_update_grant_notes_updated_at ON public.grant_notes;
CREATE TRIGGER trg_update_grant_notes_updated_at
BEFORE UPDATE ON public.grant_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Lifecycle logging for observability/auditing
DROP TRIGGER IF EXISTS trg_track_grant_notes_lifecycle ON public.grant_notes;
CREATE TRIGGER trg_track_grant_notes_lifecycle
AFTER INSERT OR UPDATE OR DELETE ON public.grant_notes
FOR EACH ROW
EXECUTE FUNCTION public.track_data_lifecycle();

-- RLS policies
ALTER TABLE public.grant_notes ENABLE ROW LEVEL SECURITY;

-- View notes when you have access to the grant (or admin/manager)
CREATE POLICY "View notes for accessible grants"
ON public.grant_notes
FOR SELECT
USING (
  public.user_has_grant_access(auth.uid(), grant_id)
  OR public.get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
);

-- Create notes if you have access; record creator identity
CREATE POLICY "Create notes for accessible grants"
ON public.grant_notes
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.user_has_grant_access(auth.uid(), grant_id)
    OR public.get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
  )
);

-- Update notes you created or if admin/manager
CREATE POLICY "Update own notes or admin"
ON public.grant_notes
FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
);

-- Delete notes (admin/manager only)
CREATE POLICY "Delete notes (admin/manager only)"
ON public.grant_notes
FOR DELETE
USING (
  public.get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
);
