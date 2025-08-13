-- Create storage bucket for grant documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('grant-documents', 'grant-documents', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png', 'image/gif', 'text/plain']);

-- Create RLS policies for document storage
CREATE POLICY "Users can view documents for their grants" ON storage.objects
FOR SELECT USING (
  bucket_id = 'grant-documents' AND 
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id::text = (storage.foldername(name))[1] 
    AND gta.user_id = auth.uid()
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can upload documents to their grants" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'grant-documents' AND 
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id::text = (storage.foldername(name))[1] 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can update documents in their grants" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'grant-documents' AND 
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id::text = (storage.foldername(name))[1] 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]))
);

CREATE POLICY "Users can delete documents from their grants" ON storage.objects
FOR DELETE USING (
  bucket_id = 'grant-documents' AND 
  (EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id::text = (storage.foldername(name))[1] 
    AND gta.user_id = auth.uid() 
    AND 'admin' = ANY(gta.permissions)
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]))
);

-- Create AI template vault table
CREATE TABLE public.ai_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('JAG', 'COPS', 'FEMA', 'General')),
  category TEXT NOT NULL CHECK (category IN ('Project Description', 'Statement of Need', 'Goals and Objectives', 'Project Design', 'Capabilities', 'Budget Narrative', 'Evaluation Plan', 'Other')),
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  usage_count INTEGER DEFAULT 0
);

-- Enable RLS on AI templates
ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for AI templates
CREATE POLICY "Everyone can view public templates" ON public.ai_templates
FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own templates" ON public.ai_templates
FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admin and managers can manage all templates" ON public.ai_templates
FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can create their own templates" ON public.ai_templates
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own templates" ON public.ai_templates
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates" ON public.ai_templates
FOR DELETE USING (created_by = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_ai_templates_updated_at
  BEFORE UPDATE ON public.ai_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default templates
INSERT INTO public.ai_templates (title, content, grant_type, category, description, is_public) VALUES
('Byrne JAG Project Description Template', 'The [Agency Name] requests funding through the Edward Byrne Memorial Justice Assistance Grant (JAG) Program to support [specific initiative]. This project will address critical public safety needs in our jurisdiction by [brief description of activities].

Key Components:
- [Component 1]: [Description]
- [Component 2]: [Description] 
- [Component 3]: [Description]

The requested funding will enable our agency to [primary goal] and directly impact [target population/geographic area]. This initiative aligns with JAG program priorities and will strengthen our capacity to [specific outcome].', 'JAG', 'Project Description', 'Standard template for Byrne JAG project descriptions', true),

('COPS Hiring Statement of Need', 'The [Agency Name] faces significant staffing challenges that directly impact our ability to provide adequate law enforcement services to our community of [population size]. Current staffing levels are [current number] sworn officers, representing a ratio of [ratio] officers per 1,000 residents, which falls below the national average of [national average].

Critical Staffing Needs:
- Current authorized strength: [number] officers
- Current actual strength: [number] officers  
- Staffing shortage: [number] positions
- Recent retirements/departures: [number] in past [timeframe]

Community Impact:
The staffing shortage has resulted in:
- Increased response times averaging [time] minutes
- Reduced community policing initiatives
- Officer overtime averaging [hours] per month
- [Additional specific impacts]

This COPS Hiring grant will enable us to hire [number] new officers to address these critical gaps and enhance public safety services.', 'COPS', 'Statement of Need', 'Template for documenting staffing needs in COPS applications', true),

('FEMA Capabilities and Capacity Template', 'The [Agency/Organization Name] possesses significant experience and organizational capacity to successfully implement the proposed [grant program] project. Our agency has [years] years of experience in [relevant field] and a proven track record of managing federal grants totaling $[amount] over the past [timeframe].

Organizational Capacity:
- Staff Size: [number] full-time employees
- Annual Budget: $[amount]
- Relevant Experience: [brief description]
- Previous Grant Management: [examples]

Key Personnel:
- Project Director: [Name, Title, Experience]
- [Key Role]: [Name, Title, Experience]
- [Key Role]: [Name, Title, Experience]

Technical Capabilities:
- [Capability 1]: [Description]
- [Capability 2]: [Description]
- [Infrastructure/Equipment]: [Description]

Our organization is well-positioned to achieve the project goals through our established partnerships with [partner organizations] and proven ability to deliver results in [relevant areas].', 'FEMA', 'Capabilities', 'Template for demonstrating organizational capacity in FEMA grants', true);

-- Create enhanced document metadata table
CREATE TABLE public.grant_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Budget', 'Narrative', 'Award Letter', 'Supporting Documents', 'Reports', 'Correspondence', 'Other')),
  subcategory TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  version_number INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  audit_status TEXT DEFAULT 'pending' CHECK (audit_status IN ('pending', 'approved', 'rejected', 'archived')),
  audit_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on grant documents
ALTER TABLE public.grant_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for grant documents
CREATE POLICY "Users can view documents for accessible grants" ON public.grant_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_documents.grant_id 
    AND gta.user_id = auth.uid()
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can upload documents to their assigned grants" ON public.grant_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_documents.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Admin and managers can manage all documents" ON public.grant_documents
FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can update documents they uploaded" ON public.grant_documents
FOR UPDATE USING (uploaded_by = auth.uid());

-- Add indexes for better performance
CREATE INDEX idx_grant_documents_grant_id ON public.grant_documents(grant_id);
CREATE INDEX idx_grant_documents_category ON public.grant_documents(category);
CREATE INDEX idx_grant_documents_uploaded_at ON public.grant_documents(uploaded_at);
CREATE INDEX idx_ai_templates_grant_type ON public.ai_templates(grant_type);
CREATE INDEX idx_ai_templates_category ON public.ai_templates(category);