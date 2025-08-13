-- Create webhook endpoints table
CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_token TEXT,
  event_types TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_triggered TIMESTAMP WITH TIME ZONE,
  description TEXT
);

-- Create webhook logs table for monitoring
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_time_ms INTEGER
);

-- Create external calendar integrations table
CREATE TABLE public.calendar_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  provider_account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  calendar_name TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, provider_account_id)
);

-- Create calendar events table for sync tracking
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_integration_id UUID REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  grant_id UUID REFERENCES public.grants(id),
  related_entity_type TEXT CHECK (related_entity_type IN ('deadline', 'task', 'milestone', 'report')),
  related_entity_id UUID,
  event_title TEXT NOT NULL,
  event_description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(calendar_integration_id, provider_event_id)
);

-- Create document storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('grant-documents', 'grant-documents', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'image/jpeg', 'image/png']),
  ('document-versions', 'document-versions', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'image/jpeg', 'image/png']);

-- Create document metadata table
CREATE TABLE public.document_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'report', 'invoice', 'correspondence', 'compliance', 'other')),
  version_number INTEGER NOT NULL DEFAULT 1,
  parent_document_id UUID REFERENCES public.document_metadata(id),
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_current_version BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on all new tables
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_metadata ENABLE ROW LEVEL SECURITY;

-- RLS policies for webhook endpoints
CREATE POLICY "Admin and managers can manage webhook endpoints"
  ON public.webhook_endpoints FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view webhook endpoints"
  ON public.webhook_endpoints FOR SELECT
  USING (true);

-- RLS policies for webhook logs
CREATE POLICY "Admin and managers can view webhook logs"
  ON public.webhook_logs FOR SELECT
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS policies for calendar integrations
CREATE POLICY "Users can manage their own calendar integrations"
  ON public.calendar_integrations FOR ALL
  USING (user_id = auth.uid());

-- RLS policies for calendar events
CREATE POLICY "Users can view calendar events for their integrations"
  ON public.calendar_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.calendar_integrations ci 
    WHERE ci.id = calendar_integration_id AND ci.user_id = auth.uid()
  ));

CREATE POLICY "Admin and managers can view all calendar events"
  ON public.calendar_events FOR SELECT
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS policies for document metadata
CREATE POLICY "Admin and managers can manage documents"
  ON public.document_metadata FOR ALL
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view documents"
  ON public.document_metadata FOR SELECT
  USING (true);

-- Storage policies for grant documents
CREATE POLICY "Admin and managers can upload grant documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'grant-documents' AND 
              get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admin and managers can view grant documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'grant-documents' AND 
         get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admin and managers can update grant documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'grant-documents' AND 
         get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admin and managers can delete grant documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'grant-documents' AND 
         get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Storage policies for document versions
CREATE POLICY "Admin and managers can manage document versions"
  ON storage.objects FOR ALL
  USING (bucket_id = 'document-versions' AND 
         get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add updated_at triggers
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON public.calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_metadata_updated_at
  BEFORE UPDATE ON public.document_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();