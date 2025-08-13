-- Create documents table for contextual uploads
CREATE TABLE public.contextual_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  linked_feature TEXT NOT NULL, -- 'narrative', 'report', etc.
  linked_entity_id UUID, -- ID of the draft, report, etc.
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  description TEXT,
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  department TEXT,
  grant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contextual_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for contextual documents
CREATE POLICY "Users can view documents for their features" 
ON public.contextual_documents 
FOR SELECT 
USING (
  -- Users can view documents they uploaded
  uploaded_by = auth.uid() OR
  -- Admins and managers can view all documents
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]) OR
  -- Users can view documents for grants they have access to
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = contextual_documents.grant_id 
    AND gta.user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload documents for accessible features" 
ON public.contextual_documents 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() AND (
    -- Allow if user has access to the related grant
    grant_id IS NULL OR 
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = contextual_documents.grant_id 
      AND gta.user_id = auth.uid()
      AND 'edit' = ANY(gta.permissions)
    ) OR
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Users can update their own documents" 
ON public.contextual_documents 
FOR UPDATE 
USING (
  uploaded_by = auth.uid() OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can delete their own documents" 
ON public.contextual_documents 
FOR DELETE 
USING (
  uploaded_by = auth.uid() OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- Create storage bucket for contextual documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contextual-documents', 'contextual-documents', false);

-- Create storage policies
CREATE POLICY "Users can upload contextual documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'contextual-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view contextual documents" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'contextual-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Users can update their contextual documents" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'contextual-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their contextual documents" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'contextual-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_contextual_documents_updated_at
  BEFORE UPDATE ON public.contextual_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();