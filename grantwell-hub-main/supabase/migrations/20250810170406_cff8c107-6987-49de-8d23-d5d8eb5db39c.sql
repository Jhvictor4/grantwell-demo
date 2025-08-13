-- Fix remaining SECURITY DEFINER functions missing search_path

-- List all SECURITY DEFINER functions in public schema to identify which ones need fixing
DO $$
DECLARE
    func_record RECORD;
    has_search_path BOOLEAN;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            p.proconfig as config
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true  -- SECURITY DEFINER functions
    LOOP
        has_search_path := false;
        
        IF func_record.config IS NOT NULL THEN
            -- Check if search_path is already set
            SELECT EXISTS (
                SELECT 1 FROM unnest(func_record.config) 
                WHERE unnest LIKE 'search_path=%'
            ) INTO has_search_path;
        END IF;
        
        IF NOT has_search_path THEN
            RAISE NOTICE 'Function % needs search_path fix', func_record.function_name;
        END IF;
    END LOOP;
END $$;

-- Update common functions that likely need search_path fixes
-- Note: Only updating public schema functions we own

-- Update create_document_version if it exists
UPDATE pg_proc 
SET proconfig = COALESCE(proconfig, '{}') || ARRAY['search_path=public']
WHERE proname = 'create_document_version' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prosecdef = true
  AND (proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(proconfig) WHERE unnest LIKE 'search_path=%'
  ));

-- Update check_rls_enforcement if it exists  
UPDATE pg_proc 
SET proconfig = COALESCE(proconfig, '{}') || ARRAY['search_path=public']
WHERE proname = 'check_rls_enforcement' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND prosecdef = true
  AND (proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(proconfig) WHERE unnest LIKE 'search_path=%'
  ));