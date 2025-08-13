-- Address security linter warnings
-- 1. Add RLS policies for tables that have RLS enabled but no policies

-- Check which tables have RLS enabled without policies
-- Let's add basic policies for commonly used tables

-- For ai_templates table (if it has RLS enabled)
DROP POLICY IF EXISTS "Public read access for ai_templates" ON ai_templates;
CREATE POLICY "Public read access for ai_templates" 
ON ai_templates FOR SELECT 
USING (is_public = true OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own templates" ON ai_templates;
CREATE POLICY "Users can manage their own templates" 
ON ai_templates FOR ALL 
USING (created_by = auth.uid());

-- For budget_categories table (if it has RLS enabled)  
DROP POLICY IF EXISTS "Everyone can view budget categories" ON budget_categories;
CREATE POLICY "Everyone can view budget categories" 
ON budget_categories FOR SELECT 
USING (true);