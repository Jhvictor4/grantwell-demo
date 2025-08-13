-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Add the extensions schema to the search_path
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Move the vector extension to the extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;