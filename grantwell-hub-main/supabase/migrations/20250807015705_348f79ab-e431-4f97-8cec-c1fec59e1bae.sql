-- Create task checklist items table
CREATE TABLE task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task checklist items
CREATE POLICY "Users can view checklist items for accessible tasks" ON task_checklist_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND (
        t.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM grant_team_assignments gta
          WHERE gta.grant_id = t.grant_id 
          AND gta.user_id = auth.uid()
        ) OR
        get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
      )
    )
  );

CREATE POLICY "Users can manage checklist items for accessible tasks" ON task_checklist_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_checklist_items.task_id
      AND (
        t.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM grant_team_assignments gta
          WHERE gta.grant_id = t.grant_id 
          AND gta.user_id = auth.uid()
          AND 'edit' = ANY(gta.permissions)
        ) OR
        get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
      )
    )
  );

-- Create function to update task checklist updated_at
CREATE OR REPLACE FUNCTION update_task_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task checklist items
CREATE TRIGGER trigger_update_task_checklist_updated_at
  BEFORE UPDATE ON task_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_task_checklist_updated_at();

-- Enhance compliance_checklist with custom items support
ALTER TABLE compliance_checklist ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE compliance_checklist ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE compliance_checklist ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Update existing compliance_checklist items to have order_index
UPDATE compliance_checklist SET order_index = 0 WHERE order_index IS NULL;

-- Add index for better performance
CREATE INDEX idx_task_checklist_items_task_id ON task_checklist_items(task_id);
CREATE INDEX idx_task_checklist_items_order ON task_checklist_items(task_id, order_index);
CREATE INDEX idx_compliance_checklist_grant_order ON compliance_checklist(grant_id, order_index);