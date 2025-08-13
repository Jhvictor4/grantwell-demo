-- Create tables for Grant Discovery System

-- Table for discovered grant opportunities from external APIs
CREATE TABLE public.discovered_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT NOT NULL UNIQUE, -- External ID from Grants.gov
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  funding_amount_min NUMERIC,
  funding_amount_max NUMERIC,
  deadline DATE,
  category TEXT,
  summary TEXT,
  eligibility TEXT,
  external_url TEXT,
  cfda_numbers TEXT[],
  funding_activity TEXT,
  posted_date DATE,
  last_updated DATE,
  status TEXT DEFAULT 'open', -- open, closing_soon, closed
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for user grant preferences and focus areas
CREATE TABLE public.grant_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  department_priorities TEXT[],
  keywords TEXT[],
  preferred_agencies TEXT[],
  min_funding_amount NUMERIC,
  max_funding_amount NUMERIC,
  focus_areas JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for saved searches and alerts
CREATE TABLE public.saved_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  search_name TEXT NOT NULL,
  search_criteria JSONB NOT NULL DEFAULT '{}',
  alert_frequency TEXT DEFAULT 'weekly', -- daily, weekly, manual
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for bookmarked grants
CREATE TABLE public.bookmarked_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discovered_grant_id UUID NOT NULL,
  assigned_to UUID,
  internal_deadline DATE,
  notes TEXT,
  status TEXT DEFAULT 'discovery', -- discovery, reviewing, applying, submitted
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, discovered_grant_id)
);

-- Table for AI matching scores (for grant recommendations)
CREATE TABLE public.grant_match_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discovered_grant_id UUID NOT NULL,
  match_score NUMERIC DEFAULT 0, -- 0-100 score
  match_reasons JSONB DEFAULT '[]',
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, discovered_grant_id)
);

-- Create foreign key relationships
ALTER TABLE public.grant_preferences 
  ADD CONSTRAINT fk_grant_preferences_user 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.saved_searches 
  ADD CONSTRAINT fk_saved_searches_user 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.bookmarked_grants 
  ADD CONSTRAINT fk_bookmarked_grants_user 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.bookmarked_grants 
  ADD CONSTRAINT fk_bookmarked_grants_discovered 
  FOREIGN KEY (discovered_grant_id) REFERENCES public.discovered_grants(id) ON DELETE CASCADE;

ALTER TABLE public.grant_match_scores 
  ADD CONSTRAINT fk_grant_match_scores_user 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.grant_match_scores 
  ADD CONSTRAINT fk_grant_match_scores_discovered 
  FOREIGN KEY (discovered_grant_id) REFERENCES public.discovered_grants(id) ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.discovered_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarked_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grant_match_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discovered_grants (public read access)
CREATE POLICY "Everyone can view discovered grants" 
ON public.discovered_grants 
FOR SELECT 
USING (true);

CREATE POLICY "Admin and managers can manage discovered grants" 
ON public.discovered_grants 
FOR ALL 
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- RLS Policies for grant_preferences
CREATE POLICY "Users can manage their own grant preferences" 
ON public.grant_preferences 
FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for saved_searches
CREATE POLICY "Users can manage their own saved searches" 
ON public.saved_searches 
FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for bookmarked_grants
CREATE POLICY "Users can manage their own bookmarked grants" 
ON public.bookmarked_grants 
FOR ALL 
USING (user_id = auth.uid());

-- RLS Policies for grant_match_scores
CREATE POLICY "Users can view their own match scores" 
ON public.grant_match_scores 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can manage match scores" 
ON public.grant_match_scores 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_discovered_grants_agency ON public.discovered_grants(agency);
CREATE INDEX idx_discovered_grants_deadline ON public.discovered_grants(deadline);
CREATE INDEX idx_discovered_grants_status ON public.discovered_grants(status);
CREATE INDEX idx_discovered_grants_opportunity_id ON public.discovered_grants(opportunity_id);
CREATE INDEX idx_bookmarked_grants_user_id ON public.bookmarked_grants(user_id);
CREATE INDEX idx_grant_match_scores_user_score ON public.grant_match_scores(user_id, match_score DESC);

-- Add updated_at triggers
CREATE TRIGGER update_discovered_grants_updated_at
  BEFORE UPDATE ON public.discovered_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grant_preferences_updated_at
  BEFORE UPDATE ON public.grant_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookmarked_grants_updated_at
  BEFORE UPDATE ON public.bookmarked_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data for law enforcement grants
INSERT INTO public.discovered_grants (
  opportunity_id, title, agency, funding_amount_min, funding_amount_max, 
  deadline, category, summary, eligibility, external_url, cfda_numbers, 
  funding_activity, posted_date, status
) VALUES 
  (
    'DOJ-2024-COPS-001',
    'COPS Office Community Policing Development Grant',
    'Department of Justice - COPS Office',
    50000,
    750000,
    '2024-12-15'::date,
    'Community Policing',
    'Funding for innovative community policing strategies, officer training, and community engagement initiatives.',
    'State, local, and tribal law enforcement agencies',
    'https://www.grants.gov/web/grants/view-opportunity.html?oppId=DOJ-2024-COPS-001',
    ARRAY['16.710'],
    'Law, Justice, Crime',
    '2024-01-15'::date,
    'open'
  ),
  (
    'BJA-2024-BYRNE-002',
    'Edward Byrne Memorial Justice Assistance Grant',
    'Bureau of Justice Assistance',
    25000,
    500000,
    '2024-11-30'::date,
    'Justice Assistance',
    'Support for law enforcement equipment, training, personnel, and crime prevention programs.',
    'State and local governments',
    'https://www.grants.gov/web/grants/view-opportunity.html?oppId=BJA-2024-BYRNE-002',
    ARRAY['16.738'],
    'Law, Justice, Crime',
    '2024-02-01'::date,
    'open'
  ),
  (
    'FEMA-2024-SAFER-003',
    'Staffing for Adequate Fire and Emergency Response',
    'Federal Emergency Management Agency',
    100000,
    2000000,
    '2024-10-31'::date,
    'Emergency Response',
    'Funding to increase staffing levels and deploy first responders to enhance public safety.',
    'Fire departments and emergency services',
    'https://www.grants.gov/web/grants/view-opportunity.html?oppId=FEMA-2024-SAFER-003',
    ARRAY['97.083'],
    'Emergency Management',
    '2024-01-20'::date,
    'closing_soon'
  ),
  (
    'NIJ-2024-TECH-004',
    'Criminal Justice Technology Innovation Grant',
    'National Institute of Justice',
    75000,
    1000000,
    '2025-01-31'::date,
    'Technology Innovation',
    'Support for research and development of innovative technologies for law enforcement and criminal justice.',
    'Research institutions and law enforcement agencies',
    'https://www.grants.gov/web/grants/view-opportunity.html?oppId=NIJ-2024-TECH-004',
    ARRAY['16.560'],
    'Law, Justice, Crime',
    '2024-03-01'::date,
    'open'
  ),
  (
    'OJP-2024-VOCA-005',
    'Victims of Crime Act Formula Grant',
    'Office for Victims of Crime',
    30000,
    800000,
    '2024-12-01'::date,
    'Victim Services',
    'Funding for victim services, training, and support programs in partnership with law enforcement.',
    'State and local victim service organizations',
    'https://www.grants.gov/web/grants/view-opportunity.html?oppId=OJP-2024-VOCA-005',
    ARRAY['16.575'],
    'Law, Justice, Crime',
    '2024-02-15'::date,
    'open'
  );