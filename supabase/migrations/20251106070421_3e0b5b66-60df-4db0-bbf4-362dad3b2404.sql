-- Fix search path for security definer functions
ALTER FUNCTION public.update_updated_at() SET search_path = public;