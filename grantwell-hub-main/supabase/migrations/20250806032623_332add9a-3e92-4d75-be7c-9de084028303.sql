-- Remove all JustGrants related tables and data
DROP TABLE IF EXISTS justgrants_crawl_logs CASCADE;
DROP TABLE IF EXISTS justgrants_crawled_opportunities CASCADE;
DROP TABLE IF EXISTS justgrants_status CASCADE;
DROP TABLE IF EXISTS justgrants_sync CASCADE;
DROP TABLE IF EXISTS justgrants_sync_history CASCADE;
DROP TABLE IF EXISTS justgrants_crawl_configs CASCADE;

-- Drop any related functions
DROP FUNCTION IF EXISTS setup_default_justgrants_monitoring() CASCADE;

-- Update invalid pipeline stages from "tracked" to "preparation"
UPDATE bookmarked_grants 
SET application_stage = 'preparation', 
    status = 'draft',
    updated_at = NOW()
WHERE application_stage = 'tracked';

-- Create missing grant records for bookmarked grants without grant_id
INSERT INTO grants (
  title,
  funder,
  amount_awarded,
  status,
  created_at,
  updated_at
)
SELECT 
  dg.title,
  dg.agency,
  dg.funding_amount_max,
  CASE bg.application_stage
    WHEN 'preparation' THEN 'draft'::grant_status
    WHEN 'in_progress' THEN 'active'::grant_status
    WHEN 'submission' THEN 'active'::grant_status
    WHEN 'awarded' THEN 'active'::grant_status
    WHEN 'rejected' THEN 'closed'::grant_status
    ELSE 'draft'::grant_status
  END,
  NOW(),
  NOW()
FROM bookmarked_grants bg
JOIN discovered_grants dg ON bg.discovered_grant_id = dg.id
WHERE bg.grant_id IS NULL;

-- Update bookmarked_grants to link to the newly created grants
UPDATE bookmarked_grants bg
SET grant_id = g.id
FROM grants g, discovered_grants dg
WHERE bg.grant_id IS NULL 
  AND bg.discovered_grant_id = dg.id
  AND g.title = dg.title
  AND g.funder = dg.agency;