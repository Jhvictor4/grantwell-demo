-- Create justgrants_sync table for tracking new grants
CREATE TABLE IF NOT EXISTS public.justgrants_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  deadline DATE,
  funding_amount_max NUMERIC,
  summary TEXT,
  external_url TEXT,
  is_new BOOLEAN DEFAULT true,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.justgrants_sync ENABLE ROW LEVEL SECURITY;

-- Policy: Admin and managers can manage sync data
CREATE POLICY "Admin and managers can manage justgrants sync" ON public.justgrants_sync
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Policy: All authenticated users can view sync data
CREATE POLICY "All authenticated users can view justgrants sync" ON public.justgrants_sync
  FOR SELECT USING (true);

-- Create sync history table
CREATE TABLE IF NOT EXISTS public.justgrants_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  grants_found INTEGER DEFAULT 0,
  new_grants_added INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sync history
ALTER TABLE public.justgrants_sync_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admin and managers can view sync history
CREATE POLICY "Admin and managers can view justgrants sync history" ON public.justgrants_sync_history
  FOR SELECT USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_justgrants_sync_opportunity_id ON public.justgrants_sync(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_justgrants_sync_new ON public.justgrants_sync(is_new);
CREATE INDEX IF NOT EXISTS idx_justgrants_sync_created_at ON public.justgrants_sync(created_at);

-- Enable realtime for justgrants_sync table
ALTER TABLE public.justgrants_sync REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'justgrants_sync'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.justgrants_sync;
  END IF;
END $$;