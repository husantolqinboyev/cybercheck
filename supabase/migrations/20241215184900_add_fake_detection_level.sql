-- Add fake detection level enum and column to lessons table
CREATE TYPE public.fake_detection_level AS ENUM ('minimal', 'medium', 'maximal');

ALTER TABLE public.lessons 
ADD COLUMN fake_detection_level fake_detection_level DEFAULT 'medium';

-- Update existing lessons to have medium detection level
UPDATE public.lessons 
SET fake_detection_level = 'medium' 
WHERE fake_detection_level IS NULL;
