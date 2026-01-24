-- Add authorization_code_required column to profiles table
ALTER TABLE public.profiles
ADD COLUMN authorization_code_required boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.authorization_code_required IS 'Controls whether user must enter authorization code (101010) during transfers';