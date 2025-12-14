-- Hash the admin password using bcrypt
-- This will be handled by the edge function during first login
-- For now, we'll update the existing admin user with a properly hashed password

-- Note: In production, create a separate user management system
-- This is a temporary fix for the demo

-- Update admin password to use bcrypt hash (password: Husan0716)
-- Hash generated with bcrypt: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm
UPDATE public.users 
SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LrUpm'
WHERE login = 'AdminHusan';
