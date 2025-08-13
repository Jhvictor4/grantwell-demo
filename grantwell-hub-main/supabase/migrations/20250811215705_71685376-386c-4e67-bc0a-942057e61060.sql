-- Idempotent enable realtime for drawdowns and matches
BEGIN;
  -- Ensure full row data is captured on updates
  ALTER TABLE public.grant_drawdowns REPLICA IDENTITY FULL;
  ALTER TABLE public.grant_matches REPLICA IDENTITY FULL;

  -- Add the tables to the realtime publication if not already present
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grant_drawdowns'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.grant_drawdowns';
    END IF;
  END$$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'grant_matches'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.grant_matches';
    END IF;
  END$$;
COMMIT;