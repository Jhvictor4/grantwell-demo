-- Set up daily cron job for JustGrants sync at 3 AM
SELECT cron.schedule(
  'daily-justgrants-sync',
  '0 3 * * *', -- Run at 3:00 AM every day
  $$
  SELECT
    net.http_post(
        url:='https://dkdwjnigohgfierszybn.supabase.co/functions/v1/sync-justgrants',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZHdqbmlnb2hnZmllcnN6eWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTcxNTEsImV4cCI6MjA2ODk3MzE1MX0.FJE5Sjn0_4gRTcbRw8SpjpG4ZGYLssFT34SjfoMUNaI"}'::jsonb,
        body:='{"scheduledSync": true}'::jsonb
    ) as request_id;
  $$
);