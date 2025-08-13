-- Fix security issues from the linter

-- Fix search_path for the functions we just created
ALTER FUNCTION public.user_has_grant_access(UUID, UUID) SET search_path = 'public';
ALTER FUNCTION public.get_user_grant_ids(UUID) SET search_path = 'public';
ALTER FUNCTION public.user_has_grant_permission(UUID, UUID, TEXT) SET search_path = 'public';