-- Add tamper detection column to vitals table
ALTER TABLE public.vitals 
ADD COLUMN IF NOT EXISTS is_tampered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_hash TEXT;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_vitals_tampered ON public.vitals(is_tampered);

