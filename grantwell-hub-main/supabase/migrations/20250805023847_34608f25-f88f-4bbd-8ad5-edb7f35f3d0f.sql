-- Fix grant count issues by mapping invalid application_stage values to proper pipeline stages
UPDATE bookmarked_grants 
SET application_stage = CASE 
  WHEN application_stage = 'tracked' THEN 'preparation'
  WHEN application_stage = 'review' THEN 'in_progress'
  WHEN application_stage = 'development' THEN 'in_progress'
  WHEN application_stage NOT IN ('preparation', 'in_progress', 'submission', 'awarded', 'rejected') THEN 'preparation'
  ELSE application_stage
END
WHERE application_stage NOT IN ('preparation', 'in_progress', 'submission', 'awarded', 'rejected');