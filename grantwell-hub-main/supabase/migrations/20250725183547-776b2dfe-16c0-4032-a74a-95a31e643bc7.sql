-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION calculate_budget_summary(p_grant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION check_task_deadlines()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION trigger_budget_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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