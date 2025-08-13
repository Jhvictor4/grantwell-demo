-- Create document_folders table for attachments organization
CREATE TABLE IF NOT EXISTS public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grant_id UUID NOT NULL,
  parent_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for document folders
CREATE POLICY "Users can view folders for accessible grants" 
ON public.document_folders 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = document_folders.grant_id 
    AND gta.user_id = auth.uid()
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can create folders for accessible grants" 
ON public.document_folders 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = document_folders.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit' = ANY(gta.permissions)
    ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Users can update their folders for accessible grants" 
ON public.document_folders 
FOR UPDATE 
USING (
  created_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = document_folders.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit' = ANY(gta.permissions)
    ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Users can delete their folders for accessible grants" 
ON public.document_folders 
FOR DELETE 
USING (
  created_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = document_folders.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit' = ANY(gta.permissions)
    ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- Add folder_id to contextual_documents if it doesn't exist
ALTER TABLE public.contextual_documents 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE;

-- Add trigger for updated_at
CREATE TRIGGER update_document_folders_updated_at
  BEFORE UPDATE ON public.document_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();