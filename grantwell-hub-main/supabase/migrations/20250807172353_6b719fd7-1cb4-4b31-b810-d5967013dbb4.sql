-- Fix security warnings by adding search_path to functions
ALTER FUNCTION public.user_has_grant_access(UUID, UUID) SET search_path = 'public';
ALTER FUNCTION public.get_user_grant_ids(UUID) SET search_path = 'public';  
ALTER FUNCTION public.user_has_grant_permission(UUID, UUID, TEXT) SET search_path = 'public';