-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document embeddings table for RAG
CREATE TABLE public.document_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.contextual_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies for document embeddings
CREATE POLICY "Users can view embeddings for their accessible documents"
  ON public.document_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contextual_documents cd
      WHERE cd.id = document_embeddings.document_id
      AND (cd.uploaded_by = auth.uid() OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

CREATE POLICY "System can manage document embeddings"
  ON public.document_embeddings
  FOR ALL
  USING (true);

-- Create index for vector similarity search
CREATE INDEX ON public.document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create index for faster document lookups
CREATE INDEX idx_document_embeddings_document_id ON public.document_embeddings(document_id);

-- Create function to trigger document processing
CREATE OR REPLACE FUNCTION public.trigger_document_processing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process if document is new or updated
  IF TG_OP = 'INSERT' THEN
    -- Schedule document for processing (will be handled by edge function)
    INSERT INTO public.ai_conversations (
      user_id,
      prompt_type,
      input_data,
      status
    ) VALUES (
      NEW.uploaded_by,
      'document_processing',
      jsonb_build_object(
        'document_id', NEW.id,
        'file_name', NEW.file_name,
        'mime_type', NEW.mime_type,
        'linked_feature', NEW.linked_feature
      ),
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic document processing
CREATE TRIGGER trigger_process_uploaded_document
  AFTER INSERT ON public.contextual_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_document_processing();