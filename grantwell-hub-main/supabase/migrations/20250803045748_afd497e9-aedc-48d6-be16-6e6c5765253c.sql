-- Disable RLS on GrantData table since it contains public historical data
ALTER TABLE "GrantData" DISABLE ROW LEVEL SECURITY;