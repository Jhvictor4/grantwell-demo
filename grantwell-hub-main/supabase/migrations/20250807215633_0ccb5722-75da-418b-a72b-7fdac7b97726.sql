-- 1) Create grant_notes table for dynamic Application Notes
CREATE TABLE IF NOT EXISTS public.grant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grant_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY IF NOT EXISTS "Users can view notes for accessible grants"
ON public.grant_notes
FOR SELECT
USING (
  user_has_grant_access(auth.uid(), grant_id)
  OR get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
);

CREATE POLICY IF NOT EXISTS "Users can create notes for accessible grants"
ON public.grant_notes
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (
    user_has_grant_permission(auth.uid(), grant_id, 'edit')
    OR get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
  )
);

CREATE POLICY IF NOT EXISTS "Users can update notes for accessible grants"
ON public.grant_notes
FOR UPDATE
USING (
  user_has_grant_permission(auth.uid(), grant_id, 'edit')
  OR get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
)
WITH CHECK (
  user_has_grant_permission(auth.uid(), grant_id, 'edit')
  OR get_user_role(auth.uid()) IN ('admin'::app_role, 'manager'::app_role)
);

-- Updated_at trigger
CREATE TRIGGER update_grant_notes_updated_at
BEFORE UPDATE ON public.grant_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Auto-create workspace grant when bookmarked_grants move stages
DROP TRIGGER IF EXISTS trg_auto_create_grant_for_bookmarked ON public.bookmarked_grants;
CREATE TRIGGER trg_auto_create_grant_for_bookmarked
BEFORE UPDATE ON public.bookmarked_grants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_grant_for_bookmarked();