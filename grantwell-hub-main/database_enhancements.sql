-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily grants sync at 2 AM
SELECT cron.schedule(
  'daily-grants-sync',
  '0 2 * * *', -- Run at 2:00 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://dkdwjnigohgfierszybn.supabase.co/functions/v1/sync-grants',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZHdqbmlnb2hnZmllcnN6eWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTcxNTEsImV4cCI6MjA2ODk3MzE1MX0.FJE5Sjn0_4gRTcbRw8SpjpG4ZGYLssFT34SjfoMUNaI"}'::jsonb,
        body:='{"forceRefresh": true}'::jsonb
    ) as request_id;
  $$
);

-- Create table to track sync history
CREATE TABLE IF NOT EXISTS grant_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  grants_found INTEGER DEFAULT 0,
  grants_inserted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sync history
ALTER TABLE grant_sync_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admin and managers can view sync history
CREATE POLICY "Admin and managers can view sync history" ON grant_sync_history
  FOR SELECT USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add indexes for better query performance on discovered_grants
CREATE INDEX IF NOT EXISTS idx_discovered_grants_agency ON discovered_grants(agency);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_category ON discovered_grants(category);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_status ON discovered_grants(status);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_deadline ON discovered_grants(deadline);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_funding_max ON discovered_grants(funding_amount_max);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_posted_date ON discovered_grants(posted_date);
CREATE INDEX IF NOT EXISTS idx_discovered_grants_opportunity_id ON discovered_grants(opportunity_id);

-- Add full text search index for better search performance
CREATE INDEX IF NOT EXISTS idx_discovered_grants_search ON discovered_grants 
USING gin(to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || agency));