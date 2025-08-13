-- Enhanced Grant Readiness Score Calculation
CREATE OR REPLACE FUNCTION public.calculate_grant_readiness_score_enhanced(p_grant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  task_count INTEGER := 0;
  completed_count INTEGER := 0;
  in_progress_count INTEGER := 0;
  pending_count INTEGER := 0;
  base_score INTEGER := 0;
  category_bonus INTEGER := 0;
  total_score INTEGER := 0;
  narrative_tasks INTEGER := 0;
  budget_tasks INTEGER := 0;
  document_tasks INTEGER := 0;
  approval_tasks INTEGER := 0;
BEGIN
  -- Count all tasks for this grant
  SELECT COUNT(*) INTO task_count
  FROM tasks 
  WHERE grant_id = p_grant_id;
  
  -- If no tasks, return 0
  IF task_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Count tasks by status
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO completed_count, in_progress_count, pending_count
  FROM tasks 
  WHERE grant_id = p_grant_id;
  
  -- Calculate base progress score (60% of total)
  base_score := ROUND(
    ((completed_count * 1.0) + (in_progress_count * 0.6) + (pending_count * 0.2)) / task_count * 60
  );
  
  -- Count tasks by category for bonuses (10% each)
  SELECT 
    COUNT(*) FILTER (WHERE LOWER(title) ~ '(narrative|report|documentation|quarterly|proposal|story)'),
    COUNT(*) FILTER (WHERE LOWER(title) ~ '(budget|financial|vendor|cost|expense|funding)'),
    COUNT(*) FILTER (WHERE LOWER(title) ~ '(document|upload|file|attachment|form)'),
    COUNT(*) FILTER (WHERE LOWER(title) ~ '(approval|review|compliance|audit|sign|authorize)')
  INTO narrative_tasks, budget_tasks, document_tasks, approval_tasks
  FROM tasks 
  WHERE grant_id = p_grant_id;
  
  -- Add category bonuses (10% each if category has any progress)
  IF narrative_tasks > 0 THEN
    SELECT COUNT(*) INTO narrative_tasks
    FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) ~ '(narrative|report|documentation|quarterly|proposal|story)'
    AND status IN ('completed', 'in_progress');
    
    IF narrative_tasks > 0 THEN
      category_bonus := category_bonus + 10;
    END IF;
  END IF;
  
  IF budget_tasks > 0 THEN
    SELECT COUNT(*) INTO budget_tasks
    FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) ~ '(budget|financial|vendor|cost|expense|funding)'
    AND status IN ('completed', 'in_progress');
    
    IF budget_tasks > 0 THEN
      category_bonus := category_bonus + 10;
    END IF;
  END IF;
  
  IF document_tasks > 0 THEN
    SELECT COUNT(*) INTO document_tasks
    FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) ~ '(document|upload|file|attachment|form)'
    AND status IN ('completed', 'in_progress');
    
    IF document_tasks > 0 THEN
      category_bonus := category_bonus + 10;
    END IF;
  END IF;
  
  IF approval_tasks > 0 THEN
    SELECT COUNT(*) INTO approval_tasks
    FROM tasks 
    WHERE grant_id = p_grant_id 
    AND LOWER(title) ~ '(approval|review|compliance|audit|sign|authorize)'
    AND status IN ('completed', 'in_progress');
    
    IF approval_tasks > 0 THEN
      category_bonus := category_bonus + 10;
    END IF;
  END IF;
  
  -- Calculate total score (capped at 100)
  total_score := LEAST(100, base_score + category_bonus);
  
  RETURN total_score;
END;
$$;