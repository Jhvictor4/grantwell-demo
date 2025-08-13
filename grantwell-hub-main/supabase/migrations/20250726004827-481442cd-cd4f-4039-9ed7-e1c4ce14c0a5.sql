-- Insert default templates without ON CONFLICT
INSERT INTO public.ai_templates (title, content, grant_type, category, description, is_public) 
SELECT * FROM (
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
) AS t(title, content, grant_type, category, description, is_public)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_templates 
  WHERE ai_templates.title = t.title AND ai_templates.grant_type = t.grant_type
);