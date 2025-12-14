-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Anyone can update users" ON public.users;

DROP POLICY IF EXISTS "Anyone can read groups" ON public.groups;
DROP POLICY IF EXISTS "Anyone can manage groups" ON public.groups;

DROP POLICY IF EXISTS "Anyone can read student_groups" ON public.student_groups;
DROP POLICY IF EXISTS "Anyone can manage student_groups" ON public.student_groups;

DROP POLICY IF EXISTS "Anyone can read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Anyone can manage subjects" ON public.subjects;

DROP POLICY IF EXISTS "Anyone can read lessons" ON public.lessons;
DROP POLICY IF EXISTS "Anyone can manage lessons" ON public.lessons;

DROP POLICY IF EXISTS "Anyone can read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Anyone can manage attendance" ON public.attendance;

DROP POLICY IF EXISTS "Anyone can manage sessions" ON public.sessions;

DROP POLICY IF EXISTS "Anyone can read logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.activity_logs;

-- Create secure RLS policies

-- Users table policies
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON public.users FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

-- Groups table policies  
CREATE POLICY "Authenticated users can read groups" ON public.groups FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

-- Student groups policies
CREATE POLICY "Users can read own student groups" ON public.student_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.user_id = student_id
    AND s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND s.expires_at > now()
  )
);

CREATE POLICY "Admins can manage student groups" ON public.student_groups FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

-- Subjects policies
CREATE POLICY "Authenticated users can read subjects" ON public.subjects FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and teachers can manage subjects" ON public.subjects FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role IN ('admin', 'teacher')
    AND s.expires_at > now()
  )
);

-- Lessons policies
CREATE POLICY "Users can read relevant lessons" ON public.lessons FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_groups sg
    WHERE sg.group_id = lessons.group_id
    AND sg.student_id = auth.uid()
  )
  OR teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

CREATE POLICY "Teachers and admins can manage lessons" ON public.lessons FOR ALL
USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

-- Attendance policies
CREATE POLICY "Students can read own attendance" ON public.attendance FOR SELECT
USING (student_id = auth.uid());

CREATE POLICY "Teachers can read lesson attendance" ON public.attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = lesson_id
    AND l.teacher_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all attendance" ON public.attendance FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

-- Sessions policies (only through edge functions)
CREATE POLICY "Sessions are managed by edge functions" ON public.sessions FOR ALL
USING (false);

-- Activity logs policies
CREATE POLICY "Users can read own logs" ON public.activity_logs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all logs" ON public.activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token = current_setting('request.jwt.claims', true)::json->>'session_token'
    AND u.role = 'admin'
    AND s.expires_at > now()
  )
);

CREATE POLICY "System can insert logs" ON public.activity_logs FOR INSERT
WITH CHECK (true);
