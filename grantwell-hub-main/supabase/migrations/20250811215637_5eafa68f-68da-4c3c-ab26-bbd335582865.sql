-- Enable realtime for drawdowns and matches
BEGIN;
  -- Ensure full row data is captured on updates
  ALTER TABLE public.grant_drawdowns REPLICA IDENTITY FULL;
  ALTER TABLE public.grant_matches REPLICA IDENTITY FULL;

  -- Add the tables to the realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.grant_drawdowns;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.grant_matches;
COMMIT;