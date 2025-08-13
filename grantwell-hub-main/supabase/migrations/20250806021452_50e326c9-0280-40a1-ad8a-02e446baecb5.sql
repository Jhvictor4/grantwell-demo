-- Fix the functions to include proper search paths for security
CREATE OR REPLACE FUNCTION setup_default_justgrants_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default monitoring configurations if none exist
  INSERT INTO justgrants_crawl_configs (
    user_id, 
    name, 
    crawl_url, 
    crawl_frequency, 
    keywords, 
    is_active
  )
  SELECT 
    auth.uid(),
    'Law Enforcement Grants Discovery',
    'https://www.grants.gov/search-grants',
    'daily',
    ARRAY['law enforcement', 'police', 'criminal justice', 'public safety', 'COPS', 'BJA', 'DOJ'],
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM justgrants_crawl_configs WHERE name = 'Law Enforcement Grants Discovery'
  );

  -- Insert BJA specific monitoring
  INSERT INTO justgrants_crawl_configs (
    user_id, 
    name, 
    crawl_url, 
    crawl_frequency, 
    keywords, 
    is_active
  )
  SELECT 
    auth.uid(),
    'BJA Grant Opportunities',
    'https://bja.ojp.gov/funding',
    'daily',
    ARRAY['Bureau of Justice Assistance', 'BJA', 'law enforcement', 'justice'],
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM justgrants_crawl_configs WHERE name = 'BJA Grant Opportunities'
  );

  -- Insert COPS Office monitoring
  INSERT INTO justgrants_crawl_configs (
    user_id, 
    name, 
    crawl_url, 
    crawl_frequency, 
    keywords, 
    is_active
  )
  SELECT 
    auth.uid(),
    'COPS Office Grants',
    'https://cops.usdoj.gov/grants',
    'daily',
    ARRAY['COPS', 'community policing', 'law enforcement', 'police'],
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM justgrants_crawl_configs WHERE name = 'COPS Office Grants'
  );
END;
$$;

-- Fix auto setup monitoring for new user function
CREATE OR REPLACE FUNCTION auto_setup_monitoring_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set up for admin, manager, or user roles
  IF NEW.role IN ('admin', 'manager', 'user') AND NEW.approval_status = 'approved' THEN
    PERFORM setup_default_justgrants_monitoring();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix auto setup monitoring on approval function
CREATE OR REPLACE FUNCTION auto_setup_monitoring_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set up for newly approved users
  IF NEW.approval_status = 'approved' AND (OLD.approval_status IS NULL OR OLD.approval_status != 'approved') AND NEW.role IN ('admin', 'manager', 'user') THEN
    PERFORM setup_default_justgrants_monitoring();
  END IF;
  RETURN NEW;
END;
$$;