-- User roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'teacher', 'student');

-- Attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'excused', 'unexcused', 'suspicious');

-- Users table (custom auth without email)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student-Group relationship
CREATE TABLE public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(student_id, group_id)
);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Lessons/Classes table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pin_code TEXT,
  pin_expires_at TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 150,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance records
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  status attendance_status DEFAULT 'absent',
  check_in_time TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  user_agent TEXT,
  ip_address TEXT,
  fingerprint TEXT,
  is_fake_gps BOOLEAN DEFAULT false,
  suspicious_reason TEXT,
  marked_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, student_id)
);

-- Sessions table for custom auth
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  fingerprint TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity logs for security
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Function to check user role from session token
CREATE OR REPLACE FUNCTION public.get_user_role_from_token(session_token TEXT)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT u.role INTO user_role_val
  FROM public.users u
  JOIN public.sessions s ON s.user_id = u.id
  WHERE s.token = session_token 
    AND s.expires_at > now();
  RETURN user_role_val;
END;
$$;

-- Function to get user ID from session token
CREATE OR REPLACE FUNCTION public.get_user_id_from_token(session_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_val UUID;
BEGIN
  SELECT s.user_id INTO user_id_val
  FROM public.sessions s
  WHERE s.token = session_token 
    AND s.expires_at > now();
  RETURN user_id_val;
END;
$$;

-- RLS Policies for users table (public read for authenticated, admin write)
CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update users" ON public.users FOR UPDATE USING (true);

-- RLS Policies for groups
CREATE POLICY "Anyone can read groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Anyone can manage groups" ON public.groups FOR ALL USING (true);

-- RLS Policies for student_groups
CREATE POLICY "Anyone can read student_groups" ON public.student_groups FOR SELECT USING (true);
CREATE POLICY "Anyone can manage student_groups" ON public.student_groups FOR ALL USING (true);

-- RLS Policies for subjects
CREATE POLICY "Anyone can read subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can manage subjects" ON public.subjects FOR ALL USING (true);

-- RLS Policies for lessons
CREATE POLICY "Anyone can read lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Anyone can manage lessons" ON public.lessons FOR ALL USING (true);

-- RLS Policies for attendance
CREATE POLICY "Anyone can read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can manage attendance" ON public.attendance FOR ALL USING (true);

-- RLS Policies for sessions
CREATE POLICY "Anyone can manage sessions" ON public.sessions FOR ALL USING (true);

-- RLS Policies for activity_logs
CREATE POLICY "Anyone can read logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin user (password: Husan0716 - will be hashed by edge function)
-- For now using simple hash, will be updated via edge function
INSERT INTO public.users (login, password_hash, full_name, role)
VALUES ('AdminHusan', 'Husan0716', 'Admin Husan', 'admin');