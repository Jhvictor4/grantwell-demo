-- Create tables for the new integrations

-- Organization settings for SAM.gov integration
CREATE TABLE public.organization_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_name TEXT NOT NULL,
  uei_number TEXT,
  duns_number TEXT,
  sam_status TEXT DEFAULT 'unknown',
  sam_expiration_date DATE,
  last_sam_check TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant opportunities from Grants.gov
CREATE TABLE public.grant_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  funding_amount_min NUMERIC,
  funding_amount_max NUMERIC,
  deadline DATE NOT NULL,
  category TEXT,
  description TEXT,
  eligibility TEXT,
  is_saved_to_pipeline BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Document management with cloud storage
CREATE TABLE public.document_storage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  storage_provider TEXT DEFAULT 'local', -- local, google_drive, dropbox, onedrive
  storage_path TEXT NOT NULL,
  file_tags TEXT[] DEFAULT '{}',
  requires_signature BOOLEAN DEFAULT false,
  signature_status TEXT DEFAULT 'not_required', -- not_required, pending, signed, rejected
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Calendar integrations
CREATE TABLE public.calendar_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  google_calendar_enabled BOOLEAN DEFAULT false,
  outlook_calendar_enabled BOOLEAN DEFAULT false,
  sync_deadlines BOOLEAN DEFAULT true,
  sync_milestones BOOLEAN DEFAULT true,
  email_reminders BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 7,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Assistant conversations
CREATE TABLE public.ai_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL, -- narrative, compliance, budget, etc.
  input_data JSONB NOT NULL DEFAULT '{}',
  ai_response TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, error
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ERP integration settings
CREATE TABLE public.erp_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_name TEXT NOT NULL, -- tyler, quickbooks, sap, oracle
  is_enabled BOOLEAN DEFAULT false,
  configuration JSONB DEFAULT '{}',
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_settings
CREATE POLICY "Admin can manage organization settings" 
ON public.organization_settings 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view organization settings" 
ON public.organization_settings 
FOR SELECT 
USING (true);

-- RLS Policies for grant_opportunities
CREATE POLICY "All authenticated users can view grant opportunities" 
ON public.grant_opportunities 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage grant opportunities" 
ON public.grant_opportunities 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS Policies for document_storage
CREATE POLICY "Users can view documents for accessible grants" 
ON public.document_storage 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = document_storage.grant_id 
    AND gta.user_id = auth.uid()
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Admin and managers can manage all documents" 
ON public.document_storage 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can upload documents to their assigned grants" 
ON public.document_storage 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = document_storage.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

-- RLS Policies for calendar_settings
CREATE POLICY "Users can manage their own calendar settings" 
ON public.calendar_settings 
FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for ai_conversations
CREATE POLICY "Users can view conversations for accessible grants" 
ON public.ai_conversations 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = ai_conversations.grant_id 
    AND gta.user_id = auth.uid()
  ) OR 
  get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can create conversations for accessible grants" 
ON public.ai_conversations 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM grant_team_assignments gta 
      WHERE gta.grant_id = ai_conversations.grant_id 
      AND gta.user_id = auth.uid()
    ) OR 
    get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

CREATE POLICY "Admin and managers can manage all conversations" 
ON public.ai_conversations 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS Policies for erp_integrations
CREATE POLICY "Admin can manage ERP integrations" 
ON public.erp_integrations 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::app_role);

CREATE POLICY "All authenticated users can view ERP integrations" 
ON public.erp_integrations 
FOR SELECT 
USING (true);

-- Add updated_at triggers
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grant_opportunities_updated_at
  BEFORE UPDATE ON public.grant_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_storage_updated_at
  BEFORE UPDATE ON public.document_storage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_settings_updated_at
  BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_erp_integrations_updated_at
  BEFORE UPDATE ON public.erp_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();