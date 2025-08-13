-- Enable RLS on GrantData table (it was disabled)
ALTER TABLE public."GrantData" ENABLE ROW LEVEL SECURITY;

-- Create policy for GrantData table to allow authenticated users to view all data
CREATE POLICY "Authenticated users can view grant data" 
ON public."GrantData" 
FOR SELECT 
USING (auth.role() = 'authenticated');