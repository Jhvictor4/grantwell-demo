-- Create task status and priority enums
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'on_hold');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Enhance the tasks table with better structure
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_date DATE;

-- Update existing status and priority columns to use enums if they're still text
DO $$ 
BEGIN
    -- Update status column to use enum
    ALTER TABLE tasks ALTER COLUMN status TYPE task_status USING status::task_status;
    ALTER TABLE tasks ALTER COLUMN priority TYPE task_priority USING priority::task_priority;
EXCEPTION
    WHEN OTHERS THEN
        -- If conversion fails, the columns might already be the right type
        NULL;
END $$;

-- Create budget tracking tables
CREATE TABLE IF NOT EXISTS budget_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
    total_awarded DECIMAL(15,2) DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    remaining_funds DECIMAL(15,2) DEFAULT 0,
    quarterly_usage JSONB DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create calendar events table for custom events
CREATE TABLE IF NOT EXISTS calendar_custom_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    event_type TEXT DEFAULT 'custom',
    grant_id UUID REFERENCES grants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table for reminders
CREATE TABLE IF NOT EXISTS task_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- '7_days', '1_day', 'overdue'
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE budget_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_custom_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budget_summaries
CREATE POLICY "Users can view budget summaries for accessible grants" ON budget_summaries
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM grant_team_assignments gta 
        WHERE gta.grant_id = budget_summaries.grant_id 
        AND gta.user_id = auth.uid()
    ) OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Admin and managers can manage budget summaries" ON budget_summaries
FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create RLS policies for calendar_custom_events
CREATE POLICY "Users can view custom events for accessible grants" ON calendar_custom_events
FOR SELECT USING (
    grant_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM grant_team_assignments gta 
        WHERE gta.grant_id = calendar_custom_events.grant_id 
        AND gta.user_id = auth.uid()
    ) OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can create their own custom events" ON calendar_custom_events
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own custom events" ON calendar_custom_events
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Admin and managers can manage all custom events" ON calendar_custom_events
FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create RLS policies for task_reminders
CREATE POLICY "Users can view reminders for their tasks" ON task_reminders
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM tasks t 
        WHERE t.id = task_reminders.task_id 
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    ) OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "System can manage task reminders" ON task_reminders
FOR ALL USING (true);

-- Create function to calculate budget summary
CREATE OR REPLACE FUNCTION calculate_budget_summary(p_grant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_awarded DECIMAL(15,2);
    v_total_spent DECIMAL(15,2);
    v_remaining DECIMAL(15,2);
BEGIN
    -- Get total awarded from grants table
    SELECT COALESCE(amount_awarded, 0) INTO v_total_awarded
    FROM grants WHERE id = p_grant_id;
    
    -- Calculate total spent from expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_spent
    FROM expenses WHERE grant_id = p_grant_id;
    
    v_remaining := v_total_awarded - v_total_spent;
    
    -- Insert or update budget summary
    INSERT INTO budget_summaries (grant_id, total_awarded, total_spent, remaining_funds)
    VALUES (p_grant_id, v_total_awarded, v_total_spent, v_remaining)
    ON CONFLICT (grant_id) 
    DO UPDATE SET 
        total_awarded = v_total_awarded,
        total_spent = v_total_spent,
        remaining_funds = v_remaining,
        last_updated = NOW();
END;
$$;

-- Create function to check for upcoming task deadlines
CREATE OR REPLACE FUNCTION check_task_deadlines()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark tasks for 7-day reminders
    UPDATE tasks 
    SET reminder_date = due_date - INTERVAL '7 days'
    WHERE due_date IS NOT NULL 
    AND due_date BETWEEN NOW()::date + INTERVAL '7 days' AND NOW()::date + INTERVAL '8 days'
    AND reminder_date IS NULL;
    
    -- Mark tasks for 1-day reminders  
    UPDATE tasks 
    SET reminder_date = due_date - INTERVAL '1 day'
    WHERE due_date IS NOT NULL 
    AND due_date BETWEEN NOW()::date + INTERVAL '1 day' AND NOW()::date + INTERVAL '2 days'
    AND reminder_date IS NULL;
END;
$$;

-- Create trigger to update budget summary when expenses change
CREATE OR REPLACE FUNCTION trigger_budget_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM calculate_budget_summary(NEW.grant_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM calculate_budget_summary(OLD.grant_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Create trigger on expenses table
DROP TRIGGER IF EXISTS budget_update_trigger ON expenses;
CREATE TRIGGER budget_update_trigger
    AFTER INSERT OR UPDATE OR DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION trigger_budget_update();

-- Add missing constraint on budget_summaries for unique grant_id
ALTER TABLE budget_summaries 
ADD CONSTRAINT unique_grant_budget UNIQUE (grant_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_calendar_custom_events_date ON calendar_custom_events(event_date);
CREATE INDEX IF NOT EXISTS idx_budget_summaries_grant_id ON budget_summaries(grant_id);