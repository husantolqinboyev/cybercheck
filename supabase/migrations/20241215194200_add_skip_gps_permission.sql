-- Add allow_skip_gps column to lessons table
ALTER TABLE public.lessons 
ADD COLUMN allow_skip_gps BOOLEAN DEFAULT false;

-- Update existing lessons to have skip GPS disabled by default
UPDATE public.lessons 
SET allow_skip_gps = false 
WHERE allow_skip_gps IS NULL;
