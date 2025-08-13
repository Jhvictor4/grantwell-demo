-- Add category and tags columns to budget_line_items table
ALTER TABLE public.budget_line_items 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT;