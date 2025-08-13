-- Create grant_drawdowns table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.grant_drawdowns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  purpose TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS on grant_drawdowns
ALTER TABLE public.grant_drawdowns ENABLE ROW LEVEL SECURITY;

-- Create policies for grant_drawdowns
CREATE POLICY "Admin and managers can manage grant drawdowns" ON public.grant_drawdowns
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view drawdowns for accessible grants" ON public.grant_drawdowns
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = grant_drawdowns.grant_id 
      AND gta.user_id = auth.uid()
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can create drawdowns for accessible grants" ON public.grant_drawdowns
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND (
      (EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = grant_drawdowns.grant_id 
        AND gta.user_id = auth.uid() 
        AND 'edit'::text = ANY (gta.permissions)
      )) OR 
      (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

CREATE POLICY "Users can update their own drawdowns for accessible grants" ON public.grant_drawdowns
  FOR UPDATE USING (
    created_by = auth.uid() AND (
      (EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = grant_drawdowns.grant_id 
        AND gta.user_id = auth.uid() 
        AND 'edit'::text = ANY (gta.permissions)
      )) OR 
      (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

CREATE POLICY "Users can delete their own drawdowns for accessible grants" ON public.grant_drawdowns
  FOR DELETE USING (
    created_by = auth.uid() AND (
      (EXISTS (
        SELECT 1 FROM grant_team_assignments gta
        WHERE gta.grant_id = grant_drawdowns.grant_id 
        AND gta.user_id = auth.uid() 
        AND 'edit'::text = ANY (gta.permissions)
      )) OR 
      (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
    )
  );

-- Add trigger for updating updated_at column
CREATE TRIGGER update_grant_drawdowns_updated_at
  BEFORE UPDATE ON public.grant_drawdowns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better query performance
CREATE INDEX idx_grant_drawdowns_grant_id ON public.grant_drawdowns(grant_id);
CREATE INDEX idx_grant_drawdowns_date ON public.grant_drawdowns(date);
CREATE INDEX idx_grant_drawdowns_created_by ON public.grant_drawdowns(created_by);