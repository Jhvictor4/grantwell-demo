-- Create grant_closeouts table for tracking closeout checklist items
CREATE TABLE public.grant_closeouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id UUID NOT NULL,
  item TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on grant_closeouts
ALTER TABLE public.grant_closeouts ENABLE ROW LEVEL SECURITY;

-- Create policies for grant_closeouts
CREATE POLICY "Admin and managers can manage grant closeouts" ON public.grant_closeouts
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can view closeouts for accessible grants" ON public.grant_closeouts
  FOR SELECT USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = grant_closeouts.grant_id 
      AND gta.user_id = auth.uid()
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can create closeouts for accessible grants" ON public.grant_closeouts
  FOR INSERT WITH CHECK (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = grant_closeouts.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit'::text = ANY (gta.permissions)
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

CREATE POLICY "Users can update closeouts for accessible grants" ON public.grant_closeouts
  FOR UPDATE USING (
    (EXISTS (
      SELECT 1 FROM grant_team_assignments gta
      WHERE gta.grant_id = grant_closeouts.grant_id 
      AND gta.user_id = auth.uid() 
      AND 'edit'::text = ANY (gta.permissions)
    )) OR 
    (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]))
  );

-- Add trigger for updating updated_at column
CREATE TRIGGER update_grant_closeouts_updated_at
  BEFORE UPDATE ON public.grant_closeouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better query performance
CREATE INDEX idx_grant_closeouts_grant_id ON public.grant_closeouts(grant_id);
CREATE INDEX idx_grant_closeouts_item ON public.grant_closeouts(item);
CREATE INDEX idx_grant_closeouts_completed ON public.grant_closeouts(completed);