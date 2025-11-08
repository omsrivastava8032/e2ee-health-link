-- Fix incorrectly marked tampered entries
-- Reset is_tampered flag for all existing entries (they're legacy data, not tampered)
UPDATE public.vitals 
SET is_tampered = false 
WHERE is_tampered = true;

