-- Add oppId column to store the numeric opportunity ID from Grants.gov
ALTER TABLE discovered_grants ADD COLUMN IF NOT EXISTS opp_id TEXT;

-- Create index for better performance on oppId lookups
CREATE INDEX IF NOT EXISTS idx_discovered_grants_opp_id ON discovered_grants(opp_id);