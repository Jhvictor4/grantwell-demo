-- Add RLS policies for AI templates
DROP POLICY IF EXISTS "Everyone can view public templates" ON public.ai_templates;
DROP POLICY IF EXISTS "Users can view their own templates" ON public.ai_templates;
DROP POLICY IF EXISTS "Admin and managers can manage all templates" ON public.ai_templates;
DROP POLICY IF EXISTS "Users can create their own templates" ON public.ai_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON public.ai_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.ai_templates;

CREATE POLICY "Everyone can view public templates" ON public.ai_templates
FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own templates" ON public.ai_templates
FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admin and managers can manage all templates" ON public.ai_templates
FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can create their own templates" ON public.ai_templates
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own templates" ON public.ai_templates
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates" ON public.ai_templates
FOR DELETE USING (created_by = auth.uid());

-- Add RLS policies for grant documents
DROP POLICY IF EXISTS "Users can view documents for accessible grants" ON public.grant_documents;
DROP POLICY IF EXISTS "Users can upload documents to their assigned grants" ON public.grant_documents;
DROP POLICY IF EXISTS "Admin and managers can manage all documents" ON public.grant_documents;
DROP POLICY IF EXISTS "Users can update documents they uploaded" ON public.grant_documents;

CREATE POLICY "Users can view documents for accessible grants" ON public.grant_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_documents.grant_id 
    AND gta.user_id = auth.uid()
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Users can upload documents to their assigned grants" ON public.grant_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM grant_team_assignments gta 
    WHERE gta.grant_id = grant_documents.grant_id 
    AND gta.user_id = auth.uid() 
    AND 'edit' = ANY(gta.permissions)
  ) OR get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role])
);

CREATE POLICY "Admin and managers can manage all documents" ON public.grant_documents
FOR ALL USING (get_user_role(auth.uid()) = ANY(ARRAY['admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can update documents they uploaded" ON public.grant_documents
FOR UPDATE USING (uploaded_by = auth.uid());

-- Insert default templates
INSERT INTO public.ai_templates (title, content, grant_type, category, description, is_public) 
VALUES
('Byrne JAG Project Description Template', 'The [Agency Name] requests funding through the Edward Byrne Memorial Justice Assistance Grant (JAG) Program to support [specific initiative]. This project will address critical public safety needs in our jurisdiction by [brief description of activities].

Key Components:
- [Component 1]: [Description]
- [Component 2]: [Description] 
- [Component 3]: [Description]

The requested funding will enable our agency to [primary goal] and directly impact [target population/geographic area]. This initiative aligns with JAG program priorities and will strengthen our capacity to [specific outcome].', 'JAG', 'Project Description', 'Standard template for Byrne JAG project descriptions', true),

('COPS Hiring Statement of Need', 'The [Agency Name] faces significant staffing challenges that directly impact our ability to provide adequate law enforcement services to our community of [population size]. Current staffing levels are [current number] sworn officers, representing a ratio of [ratio] officers per 1,000 residents, which falls below the national average of [national average].

Critical Staffing Needs:
- Current authorized strength: [number] officers
- Current actual strength: [number] officers  
- Staffing shortage: [number] positions
- Recent retirements/departures: [number] in past [timeframe]

Community Impact:
The staffing shortage has resulted in:
- Increased response times averaging [time] minutes
- Reduced community policing initiatives
- Officer overtime averaging [hours] per month
- [Additional specific impacts]

This COPS Hiring grant will enable us to hire [number] new officers to address these critical gaps and enhance public safety services.', 'COPS', 'Statement of Need', 'Template for documenting staffing needs in COPS applications', true),

('FEMA Capabilities Template', 'The [Agency/Organization Name] possesses significant experience and organizational capacity to successfully implement the proposed [grant program] project. Our agency has [years] years of experience in [relevant field] and a proven track record of managing federal grants totaling $[amount] over the past [timeframe].

Organizational Capacity:
- Staff Size: [number] full-time employees
- Annual Budget: $[amount]
- Relevant Experience: [brief description]
- Previous Grant Management: [examples]

Key Personnel:
- Project Director: [Name, Title, Experience]
- [Key Role]: [Name, Title, Experience]
- [Key Role]: [Name, Title, Experience]

Technical Capabilities:
- [Capability 1]: [Description]
- [Capability 2]: [Description]
- [Infrastructure/Equipment]: [Description]

Our organization is well-positioned to achieve the project goals through our established partnerships with [partner organizations] and proven ability to deliver results in [relevant areas].', 'FEMA', 'Capabilities', 'Template for demonstrating organizational capacity in FEMA grants', true)
ON CONFLICT (title, grant_type, category) DO NOTHING;