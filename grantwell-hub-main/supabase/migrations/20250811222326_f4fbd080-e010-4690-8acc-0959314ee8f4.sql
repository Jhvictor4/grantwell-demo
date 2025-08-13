-- Deduplicate and enforce uniqueness for grant_closeout_tasks to stop duplicate closeout items

-- 1) Remove existing duplicates, keep the earliest created_at per (grant_id, task_name)
WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY grant_id, task_name 
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.grant_closeout_tasks
)
DELETE FROM public.grant_closeout_tasks t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 2) Add a unique index to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'grant_closeout_tasks' 
      AND indexname = 'ux_grant_closeout_tasks_unique'
  ) THEN
    CREATE UNIQUE INDEX ux_grant_closeout_tasks_unique 
      ON public.grant_closeout_tasks(grant_id, task_name);
  END IF;
END$$;

-- 3) Optional: also guard at the tasks table for auto_generated closeout tasks
--    (only if the unique index is missing; otherwise this is a no-op)
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'tasks' 
        AND indexname = 'ux_tasks_grant_title_auto_generated'
    ) THEN
      -- This matches the ON CONFLICT (grant_id, title, auto_generated) used in create_closeout_tasks_for_grant()
      CREATE UNIQUE INDEX ux_tasks_grant_title_auto_generated 
        ON public.tasks(grant_id, title, auto_generated);
    END IF;
  END IF;
END$$;