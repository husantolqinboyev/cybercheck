-- Add pin_validity_seconds column to lessons table
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS pin_validity_seconds INTEGER DEFAULT 60;

-- Add comment for documentation
COMMENT ON COLUMN lessons.pin_validity_seconds IS 'PIN validity duration in seconds (default 60 seconds)';
