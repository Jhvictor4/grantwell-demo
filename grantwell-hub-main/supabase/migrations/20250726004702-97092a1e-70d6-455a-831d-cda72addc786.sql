-- Create AI template vault table (skip if exists)
CREATE TABLE IF NOT EXISTS public.ai_templates (
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

-- Create enhanced document metadata table
CREATE TABLE IF NOT EXISTS public.grant_documents (
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