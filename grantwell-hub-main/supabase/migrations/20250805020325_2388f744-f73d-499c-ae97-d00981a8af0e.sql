-- Fix security issues by adding search_path to functions
DROP FUNCTION IF EXISTS calculate_grant_readiness_score(UUID);
DROP FUNCTION IF EXISTS get_performance_metrics(UUID);

-- Create function to calculate grant readiness score with proper security
CREATE OR REPLACE FUNCTION calculate_grant_readiness_score(p_grant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  narrative_complete BOOLEAN := false;
  budget_complete BOOLEAN := false;
  documents_complete BOOLEAN := false;
  approval_complete BOOLEAN := false;
  score INTEGER := 0;
BEGIN
  -- Check if narrative task is complete
  SELECT EXISTS(
    SELECT 1 FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) LIKE '%narrative%' 
    AND status = 'completed'
  ) INTO narrative_complete;
  
  -- Check if budget task is complete
  SELECT EXISTS(
    SELECT 1 FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) LIKE '%budget%' 
    AND status = 'completed'
  ) INTO budget_complete;
  
  -- Check if document upload task is complete
  SELECT EXISTS(
    SELECT 1 FROM tasks 
    WHERE grant_id = p_grant_id 
    AND (LOWER(title) LIKE '%document%' OR LOWER(title) LIKE '%upload%')
    AND status = 'completed'
  ) INTO documents_complete;
  
  -- Check if approval task is complete
  SELECT EXISTS(
    SELECT 1 FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) LIKE '%approval%' 
    AND status = 'completed'
  ) INTO approval_complete;
  
  -- Calculate score (25% each)
  IF narrative_complete THEN score := score + 25; END IF;
  IF budget_complete THEN score := score + 25; END IF;
  IF documents_complete THEN score := score + 25; END IF;
  IF approval_complete THEN score := score + 25; END IF;
  
  RETURN score;
END;
$$;

-- Create function to get performance metrics with proper security
CREATE OR REPLACE FUNCTION get_performance_metrics(p_user_id UUID)
RETURNS TABLE(
  total_submitted INTEGER,
  total_awarded INTEGER,
  award_rate NUMERIC,
  avg_grant_size NUMERIC,
  avg_time_to_submission NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH grant_stats AS (
    SELECT 
      bg.id,
      bg.status,
      bg.created_at,
      bg.updated_at,
      dg.funding_amount_max,
      CASE 
        WHEN bg.status IN ('submission', 'awarded', 'rejected') THEN 1 
        ELSE 0 
      END as is_submitted,
      CASE 
        WHEN bg.status = 'awarded' THEN 1 
        ELSE 0 
      END as is_awarded,
      CASE 
        WHEN bg.status IN ('submission', 'awarded', 'rejected') 
        THEN EXTRACT(DAYS FROM bg.updated_at - bg.created_at)
        ELSE NULL 
      END as days_to_submission
    FROM bookmarked_grants bg
    JOIN discovered_grants dg ON bg.discovered_grant_id = dg.id
    WHERE bg.user_id = p_user_id
  )
  SELECT 
    SUM(is_submitted)::INTEGER as total_submitted,
    SUM(is_awarded)::INTEGER as total_awarded,
    CASE 
      WHEN SUM(is_submitted) > 0 
      THEN ROUND((SUM(is_awarded)::NUMERIC / SUM(is_submitted)::NUMERIC) * 100, 1)
      ELSE 0 
    END as award_rate,
    COALESCE(AVG(funding_amount_max) FILTER (WHERE is_awarded = 1), 0) as avg_grant_size,
    COALESCE(AVG(days_to_submission) FILTER (WHERE days_to_submission IS NOT NULL), 0) as avg_time_to_submission
  FROM grant_stats;
END;
$$;