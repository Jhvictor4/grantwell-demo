-- Create missing task templates for grants that don't have any tasks
INSERT INTO tasks (
  grant_id,
  title,
  description,
  status,
  priority,
  created_at,
  updated_at
)
SELECT 
  bg.grant_id,
  task_templates.title,
  task_templates.description,
  'pending'::task_status,
  task_templates.priority::task_priority,
  NOW(),
  NOW()
FROM bookmarked_grants bg
CROSS JOIN (
  VALUES 
    ('Project Narrative Draft', 'Create the main project narrative document', 'high'),
    ('Budget Planning', 'Create detailed budget breakdown', 'high'),
    ('Document Collection', 'Gather required supporting documents', 'medium'),
    ('Final Review', 'Complete final review and compliance check', 'high'),
    ('Authorization Approval', 'Obtain necessary approvals for submission', 'high'),
    ('Quarterly Report Planning', 'Plan quarterly reporting structure and timeline', 'medium'),
    ('Vendor Proposals', 'Collect vendor quotes and proposals', 'medium'),
    ('File Upload Preparation', 'Prepare final document uploads', 'low')
) AS task_templates(title, description, priority)
WHERE bg.grant_id IS NOT NULL
  AND bg.application_stage IN ('preparation', 'in_progress', 'submission', 'awarded', 'rejected')
  AND NOT EXISTS (
    SELECT 1 FROM tasks t WHERE t.grant_id = bg.grant_id
  );

-- Create closeout logs for awarded grants using correct log_type values
INSERT INTO closeout_logs (
  grant_id,
  log_type,
  description,
  completed,
  created_at,
  updated_at
)
SELECT 
  bg.grant_id,
  closeout_templates.log_type,
  closeout_templates.description,
  false,
  NOW(),
  NOW()
FROM bookmarked_grants bg
CROSS JOIN (
  VALUES 
    ('Financial Report', 'Submit final SF-425 Federal Financial Report'),
    ('Project Report', 'Submit final project narrative report'),
    ('Equipment Inventory', 'Provide equipment disposition documentation'),
    ('Fund Return', 'Return any unspent federal funds')
) AS closeout_templates(log_type, description)
WHERE bg.grant_id IS NOT NULL
  AND bg.application_stage = 'awarded'
  AND NOT EXISTS (
    SELECT 1 FROM closeout_logs cl WHERE cl.grant_id = bg.grant_id
  );