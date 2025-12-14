-- Fix users table issues
-- Add password field for backward compatibility with auth function
-- Keep password_hash for future bcrypt implementation

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;

-- Update existing records to have plain password for demo
-- In production, this should be handled properly
UPDATE public.users 
SET password = 'Husan0716' 
WHERE login = 'AdminHusan' AND password IS NULL;
