-- Update profiles table status constraint to allow 'blocked' status
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'blocked'));

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);