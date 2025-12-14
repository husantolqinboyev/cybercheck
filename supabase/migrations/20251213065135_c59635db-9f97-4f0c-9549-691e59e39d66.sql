-- Add device_fingerprint column to users table for device binding
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS device_fingerprint text;

-- Create notifications table for push notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for notifications
CREATE POLICY "Anyone can manage notifications" ON public.notifications FOR ALL USING (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;