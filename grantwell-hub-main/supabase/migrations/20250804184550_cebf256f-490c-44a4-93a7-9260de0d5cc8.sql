-- Add sector column to discovered_grants table
ALTER TABLE public.discovered_grants 
ADD COLUMN sector text DEFAULT 'Other';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_discovered_grants_sector ON discovered_grants(sector);

-- Update existing grants to set sector to 'Law Enforcement' based on agency and keywords
UPDATE public.discovered_grants 
SET sector = 'Law Enforcement'
WHERE 
  -- Government law enforcement agencies
  agency ILIKE ANY(ARRAY['%DOJ%', '%Department of Justice%', '%COPS%', '%Office of Community Oriented Policing%', '%NIJ%', '%National Institute of Justice%', '%BJA%', '%Bureau of Justice Assistance%', '%OJP%', '%Office of Justice Programs%', '%DEA%', '%FBI%', '%ATF%', '%U.S. Marshals%', '%DHS%', '%Department of Homeland Security%']) 
  OR
  -- Law enforcement keywords in title or summary
  (title ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%']) 
   OR 
   COALESCE(summary, '') ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%']));

-- Create function to auto-categorize new grants
CREATE OR REPLACE FUNCTION auto_categorize_grant_sector()
RETURNS TRIGGER AS $$
BEGIN
  -- Default to 'Other'
  NEW.sector := 'Other';
  
  -- Check for law enforcement indicators
  IF (
    NEW.agency ILIKE ANY(ARRAY['%DOJ%', '%Department of Justice%', '%COPS%', '%Office of Community Oriented Policing%', '%NIJ%', '%National Institute of Justice%', '%BJA%', '%Bureau of Justice Assistance%', '%OJP%', '%Office of Justice Programs%', '%DEA%', '%FBI%', '%ATF%', '%U.S. Marshals%', '%DHS%', '%Department of Homeland Security%']) 
    OR
    NEW.title ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%'])
    OR
    COALESCE(NEW.summary, '') ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%corrections%', '%sheriff%', '%deputy%', '%criminal justice%', '%public safety%', '%homeland security%', '%emergency response%', '%first responder%', '%crime prevention%', '%community policing%', '%gang%', '%drug%', '%violence prevention%', '%victim services%', '%court%', '%prosecutor%', '%probation%', '%parole%'])
  ) THEN
    NEW.sector := 'Law Enforcement';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-categorize grants on insert/update
DROP TRIGGER IF EXISTS trigger_auto_categorize_grant_sector ON discovered_grants;
CREATE TRIGGER trigger_auto_categorize_grant_sector
  BEFORE INSERT OR UPDATE ON discovered_grants
  FOR EACH ROW
  EXECUTE FUNCTION auto_categorize_grant_sector();

-- Create justgrants_status table for sync status tracking
CREATE TABLE IF NOT EXISTS public.justgrants_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.discovered_grants(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  last_sync_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_successful_sync TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  sync_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on justgrants_status
ALTER TABLE public.justgrants_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for justgrants_status
CREATE POLICY "Admin and managers can manage justgrants status" ON public.justgrants_status
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "All authenticated users can view justgrants status" ON public.justgrants_status
  FOR SELECT USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_justgrants_status_grant_id ON justgrants_status(grant_id);
CREATE INDEX IF NOT EXISTS idx_justgrants_status_sync_status ON justgrants_status(sync_status);

-- Create function to update justgrants_status updated_at
CREATE TRIGGER update_justgrants_status_updated_at
  BEFORE UPDATE ON public.justgrants_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();