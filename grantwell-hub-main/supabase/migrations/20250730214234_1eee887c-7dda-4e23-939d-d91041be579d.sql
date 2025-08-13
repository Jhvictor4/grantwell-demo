-- Clean up duplicate budget line items by removing duplicates and keeping only the latest version
DELETE FROM budget_line_items 
WHERE id NOT IN (
  SELECT DISTINCT ON (grant_id, item_name, budgeted_amount) id
  FROM budget_line_items
  ORDER BY grant_id, item_name, budgeted_amount, created_at DESC
);