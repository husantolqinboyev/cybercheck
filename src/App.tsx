import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminGroups from "./pages/admin/Groups";
import AdminSubjects from "./pages/admin/Subjects";
import AdminStudentGroups from "./pages/admin/StudentGroups";
import AdminReports from "./pages/admin/Reports";
import AdminAttendanceControl from "./pages/admin/AttendanceControl";
import TeacherLessons from "./pages/teacher/Lessons";
import TeacherAttendance from "./pages/teacher/Attendance";
import TeacherLessonHistory from "./pages/teacher/LessonHistory";
import StudentCheckin from "./pages/student/Checkin";
import StudentHistory from "./pages/student/History";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* Admin Routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminGroups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/subjects"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminSubjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/student-groups"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminStudentGroups />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/attendance-control"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminAttendanceControl />
                </ProtectedRoute>
              }
            />
            {/* Teacher Routes */}
            <Route
              path="/teacher/lessons"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessons />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/attendance"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAttendance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/history"
              element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessonHistory />
                </ProtectedRoute>
              }
            />
            {/* Student Routes */}
            <Route
              path="/student/checkin"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentCheckin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/history"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentHistory />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
