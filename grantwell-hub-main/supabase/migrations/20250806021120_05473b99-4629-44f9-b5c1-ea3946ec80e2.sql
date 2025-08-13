-- Create a function to set up default monitoring configurations
CREATE OR REPLACE FUNCTION setup_default_justgrants_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create a trigger to auto-setup monitoring for new users with appropriate roles
CREATE OR REPLACE FUNCTION auto_setup_monitoring_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only set up for admin, manager, or user roles
  IF NEW.role IN ('admin', 'manager', 'user') AND NEW.approval_status = 'approved' THEN
    PERFORM setup_default_justgrants_monitoring();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new approved users
DROP TRIGGER IF EXISTS trigger_auto_setup_monitoring ON profiles;
CREATE TRIGGER trigger_auto_setup_monitoring
  AFTER INSERT OR UPDATE OF approval_status ON profiles
  FOR EACH ROW
  WHEN (NEW.approval_status = 'approved' AND (OLD.approval_status IS NULL OR OLD.approval_status != 'approved'))
  EXECUTE FUNCTION auto_setup_monitoring_for_new_user();