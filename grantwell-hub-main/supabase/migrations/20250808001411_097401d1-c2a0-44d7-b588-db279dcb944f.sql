-- Fix RLS policy for contextual_documents to allow uploads for compliance
DROP POLICY IF EXISTS "Users can upload documents for accessible features" ON contextual_documents;

CREATE POLICY "Users can upload documents for accessible features" 
ON contextual_documents 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() AND (
    grant_id IS NULL OR 
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = contextual_documents.grant_id 
      AND gta.user_id = auth.uid() 
      AND gta.is_active = true
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  )
);