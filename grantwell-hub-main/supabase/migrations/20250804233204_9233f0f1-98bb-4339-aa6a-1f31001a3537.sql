-- Add law enforcement-specific budget categories
INSERT INTO budget_categories (name, description) VALUES
('Sworn Personnel', 'Police officers salaries, overtime, and benefits'),
('Civilian Personnel', 'Non-sworn staff salaries and benefits'),
('Vehicles', 'Police cruisers, motorcycles, specialized vehicles'),
('Weapons & Protective Gear', 'Firearms, body armor, tactical equipment'),
('Technology & Communications', 'Radios, computers, body cameras, software'),
('Specialized Training', 'Law enforcement specific training and certifications'),
('Facilities & Operations', 'Station maintenance, utilities, fuel');

-- Create equipment cost database table
CREATE TABLE equipment_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  item_name TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  current_price DECIMAL(12,2) NOT NULL,
  price_date DATE DEFAULT CURRENT_DATE,
  specifications JSONB DEFAULT '{}',
  description TEXT,
  typical_lifespan_years INTEGER,
  maintenance_cost_annual DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on equipment_costs
ALTER TABLE equipment_costs ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view equipment costs
CREATE POLICY "All authenticated users can view equipment costs" ON equipment_costs
  FOR SELECT USING (true);

-- Policy: Admin and managers can manage equipment costs
CREATE POLICY "Admin and managers can manage equipment costs" ON equipment_costs
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Create equipment templates table
CREATE TABLE equipment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  category TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'vehicle_acquisition', 'technology_upgrade', 'personnel_hiring', etc.
  template_data JSONB NOT NULL,
  budget_items JSONB DEFAULT '[]', -- Array of budget line items
  narrative_sections JSONB DEFAULT '{}', -- Pre-filled narrative content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on equipment_templates
ALTER TABLE equipment_templates ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view equipment templates
CREATE POLICY "All authenticated users can view equipment templates" ON equipment_templates
  FOR SELECT USING (true);

-- Policy: Admin and managers can manage equipment templates
CREATE POLICY "Admin and managers can manage equipment templates" ON equipment_templates
  FOR ALL USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::app_role, 'manager'::app_role]));

-- Update discovered_grants to categorize law enforcement grants
UPDATE discovered_grants 
SET sector = 'Law Enforcement' 
WHERE (
  agency ILIKE ANY(ARRAY['%DOJ%', '%Department of Justice%', '%COPS%', '%BJA%', '%OJP%', '%DHS%']) 
  OR 
  title ILIKE ANY(ARRAY['%police%', '%officer%', '%law enforcement%', '%justice%', '%public safety%'])
);

-- Insert sample equipment cost data
INSERT INTO equipment_costs (category, subcategory, item_name, manufacturer, model, current_price, description, typical_lifespan_years, maintenance_cost_annual) VALUES
-- Vehicles
('Vehicles', 'Patrol Cars', 'Police Interceptor Utility', 'Ford', 'Explorer', 45000.00, 'Standard police patrol vehicle with emergency equipment', 8, 3500.00),
('Vehicles', 'Patrol Cars', 'Police Pursuit Sedan', 'Dodge', 'Charger Pursuit', 42000.00, 'High-performance police pursuit vehicle', 7, 4000.00),
('Vehicles', 'Motorcycles', 'Police Motorcycle', 'Harley-Davidson', 'FLHP Road King', 25000.00, 'Police motorcycle for traffic enforcement', 10, 2000.00),

-- Communications
('Technology & Communications', 'Radios', 'Portable Radio', 'Motorola', 'APX 6000', 4500.00, 'Digital portable radio with encryption', 8, 200.00),
('Technology & Communications', 'Body Cameras', 'Body-Worn Camera', 'Axon', 'Body 3', 699.00, 'Body-worn camera with auto-activation', 5, 100.00),
('Technology & Communications', 'Mobile Data', 'Mobile Data Terminal', 'Getac', 'F110', 3200.00, 'Rugged laptop for police vehicles', 5, 300.00),

-- Weapons & Protective Gear
('Weapons & Protective Gear', 'Firearms', 'Service Pistol', 'Glock', 'G22', 525.00, 'Standard issue service pistol .40 caliber', 15, 50.00),
('Weapons & Protective Gear', 'Body Armor', 'Ballistic Vest', 'Safariland', 'Concealable Vest', 850.00, 'Level IIIA ballistic protection vest', 5, 0.00),
('Weapons & Protective Gear', 'Less Lethal', 'TASER', 'Axon', 'TASER 7', 1799.00, 'Conducted electrical weapon', 8, 150.00),

-- Technology
('Technology & Communications', 'Surveillance', 'License Plate Reader', 'Vigilant Solutions', 'LEARN-NVLS', 15000.00, 'Automatic license plate recognition system', 7, 1200.00),
('Technology & Communications', 'Software', 'Records Management System', 'Tyler Technologies', 'Odyssey', 25000.00, 'Police records management software (annual license)', 1, 25000.00);

-- Insert sample equipment templates
INSERT INTO equipment_templates (template_name, category, template_type, template_data, budget_items, narrative_sections) VALUES
('Vehicle Fleet Replacement', 'Vehicles', 'vehicle_acquisition', 
'{"vehicle_count": 5, "vehicle_type": "patrol_cars", "replacement_schedule": "immediate", "current_fleet_age": 8}',
'[{"category": "Vehicles", "item": "Police Interceptor Utility", "quantity": 5, "unit_cost": 45000, "total": 225000}]',
'{"statement_of_need": "Our current patrol fleet averages 8 years old with over 150,000 miles per vehicle, resulting in increased maintenance costs and reduced reliability.", "project_description": "Replace aging patrol vehicles to improve officer safety and reduce operational costs."}'
),

('Body Camera Program', 'Technology & Communications', 'technology_upgrade',
'{"camera_count": 50, "storage_years": 5, "training_hours": 40}',
'[{"category": "Technology & Communications", "item": "Body-Worn Camera", "quantity": 50, "unit_cost": 699, "total": 34950}, {"category": "Technology & Communications", "item": "Cloud Storage", "quantity": 1, "unit_cost": 15000, "total": 15000}]',
'{"statement_of_need": "Implementation of body-worn cameras to enhance transparency, accountability, and evidence collection.", "project_description": "Deploy comprehensive body camera program with secure cloud storage and officer training."}'
),

('Officer Hiring Initiative', 'Personnel', 'personnel_hiring',
'{"officer_count": 10, "salary_grade": "entry_level", "training_weeks": 24}',
'[{"category": "Sworn Personnel", "item": "Officer Salary", "quantity": 10, "unit_cost": 55000, "total": 550000}, {"category": "Specialized Training", "item": "Academy Training", "quantity": 10, "unit_cost": 15000, "total": 150000}]',
'{"statement_of_need": "Critical staffing shortage requires immediate hiring of additional officers to maintain community safety standards.", "project_description": "Recruit, train, and deploy 10 new police officers to address community policing needs."}'
);