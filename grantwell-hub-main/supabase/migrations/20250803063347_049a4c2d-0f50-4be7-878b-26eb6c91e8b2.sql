-- Add state column to profiles table
ALTER TABLE public.profiles ADD COLUMN state TEXT;

-- Create state_grants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.state_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  agency TEXT NOT NULL,
  state TEXT NOT NULL,
  funding_amount_min NUMERIC,
  funding_amount_max NUMERIC,
  deadline DATE,
  opportunity_id TEXT NOT NULL,
  external_url TEXT,
  eligibility TEXT,
  category TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on state_grants table
ALTER TABLE public.state_grants ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view state grants
CREATE POLICY "All authenticated users can view state grants" ON public.state_grants
  FOR SELECT USING (true);

-- Policy: Admin and managers can manage state grants
CREATE POLICY "Admin and managers can manage state grants" ON public.state_grants
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add some sample data for testing
INSERT INTO public.state_grants (title, description, agency, state, funding_amount_min, funding_amount_max, deadline, opportunity_id, external_url, category) VALUES
('California Environmental Protection Grant', 'Funding for environmental protection projects in California', 'EPA', 'California', 50000, 500000, '2025-12-31', 'CA-ENV-2025-001', 'https://example.com/ca-env', 'Environment'),
('Texas Education Innovation Fund', 'Supporting educational innovation in Texas schools', 'Texas Department of Education', 'Texas', 25000, 250000, '2025-11-30', 'TX-EDU-2025-001', 'https://example.com/tx-edu', 'Education'),
('New York Community Development Grant', 'Community development projects in New York', 'HUD', 'New York', 75000, 750000, '2025-10-15', 'NY-CD-2025-001', 'https://example.com/ny-community', 'Community Development'),
('Florida Healthcare Access Grant', 'Improving healthcare access in rural Florida', 'HRSA', 'Florida', 100000, 1000000, '2025-09-30', 'FL-HEALTH-2025-001', 'https://example.com/fl-health', 'Healthcare');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_state_grants_state ON public.state_grants(state);
CREATE INDEX IF NOT EXISTS idx_state_grants_deadline ON public.state_grants(deadline);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);