import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TeacherLayout } from "@/components/layouts/TeacherLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MapPin,
  Eye,
} from "lucide-react";
import { AttendanceMap } from "@/components/AttendanceMap";

interface LessonHistory {
  id: string;
  subject_name: string;
  group_name: string;
  started_at: string;
  ended_at: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  stats: {
    total: number;
    present: number;
    absent: number;
    excused: number;
    unexcused: number;
    suspicious: number;
  };
}

interface AttendanceDetail {
  id: string;
  student_name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  check_in_time: string | null;
  is_fake_gps: boolean;
  suspicious_reason: string | null;
}

const TeacherLessonHistory = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LessonHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<LessonHistory | null>(null);
  const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, [user]);

  const fetchLessons = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, started_at, ended_at, latitude, longitude, radius_meters, subject_id, group_id")
        .eq("teacher_id", user.id)
        .order("started_at", { ascending: false });

      if (!lessonsData) {
        setLessons([]);
        return;
      }

      // Get subject and group names
      const { data: subjects } = await supabase.from("subjects").select("id, name");
      const { data: groups } = await supabase.from("groups").select("id, name");

      const subjectMap: Record<string, string> = {};
      const groupMap: Record<string, string> = {};
      subjects?.forEach((s) => (subjectMap[s.id] = s.name));
      groups?.forEach((g) => (groupMap[g.id] = g.name));

      // Get attendance stats for each lesson
      const lessonsWithStats: LessonHistory[] = await Promise.all(
        lessonsData.map(async (lesson) => {
          const { data: attendance } = await supabase
            .from("attendance")
            .select("status")
            .eq("lesson_id", lesson.id);

          const stats = {
            total: attendance?.length || 0,
            present: attendance?.filter((a) => a.status === "present").length || 0,
            absent: attendance?.filter((a) => a.status === "absent").length || 0,
            excused: attendance?.filter((a) => a.status === "excused").length || 0,
            unexcused: attendance?.filter((a) => a.status === "unexcused").length || 0,
            suspicious: attendance?.filter((a) => a.status === "suspicious").length || 0,
          };

          return {
            id: lesson.id,
            subject_name: subjectMap[lesson.subject_id] || "Noma'lum",
            group_name: groupMap[lesson.group_id] || "Noma'lum",
            started_at: lesson.started_at,
            ended_at: lesson.ended_at,
            latitude: lesson.latitude,
            longitude: lesson.longitude,
            radius_meters: lesson.radius_meters || 150,
            stats,
          };
        })
      );

      setLessons(lessonsWithStats);
    } catch (error) {
      console.error("Error fetching lessons:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const viewDetails = async (lesson: LessonHistory) => {
    setSelectedLesson(lesson);
    setIsDialogOpen(true);

    // Fetch attendance details
    const { data } = await supabase
      .from("attendance")
      .select("id, status, latitude, longitude, distance_meters, check_in_time, is_fake_gps, suspicious_reason, student_id")
      .eq("lesson_id", lesson.id);

    if (data) {
      const studentIds = data.map((a) => a.student_id);
      const { data: students } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", studentIds);

      const studentMap: Record<string, string> = {};
      students?.forEach((s) => (studentMap[s.id] = s.full_name));

      const details: AttendanceDetail[] = data.map((a) => ({
        id: a.id,
        student_name: studentMap[a.student_id] || "Noma'lum",
        status: a.status || "absent",
        latitude: a.latitude,
        longitude: a.longitude,
        distance_meters: a.distance_meters,
        check_in_time: a.check_in_time,
        is_fake_gps: a.is_fake_gps || false,
        suspicious_reason: a.suspicious_reason,
      }));

      setAttendanceDetails(details);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "present": return "Keldi";
      case "absent": return "Kelmadi";
      case "excused": return "Sababli";
      case "unexcused": return "Sababsiz";
      case "suspicious": return "Shubhali";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present": return "text-success";
      case "absent": return "text-destructive";
      case "excused": return "text-primary";
      case "unexcused": return "text-warning";
      case "suspicious": return "text-suspicious";
      default: return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Darslar tarixi</h1>
          <p className="text-muted-foreground">O'tgan darslar va davomat statistikasi</p>
        </div>

        {lessons.length === 0 ? (
          <div className="cyber-card p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Hozircha darslar mavjud emas</p>
          </div>
        ) : (
          <div className="cyber-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fan / Guruh</TableHead>
                  <TableHead>Sana</TableHead>
                  <TableHead>Davomat</TableHead>
                  <TableHead className="text-right">Batafsil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lesson.subject_name}</p>
                        <p className="text-sm text-muted-foreground">{lesson.group_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{new Date(lesson.started_at).toLocaleDateString("uz-UZ")}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(lesson.started_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                          {lesson.ended_at && ` - ${new Date(lesson.ended_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle className="w-4 h-4" />
                          {lesson.stats.present}
                        </span>
                        <span className="flex items-center gap-1 text-destructive">
                          <XCircle className="w-4 h-4" />
                          {lesson.stats.absent}
                        </span>
                        {lesson.stats.suspicious > 0 && (
                          <span className="flex items-center gap-1 text-suspicious">
                            <AlertTriangle className="w-4 h-4" />
                            {lesson.stats.suspicious}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          / {lesson.stats.total}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewDetails(lesson)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ko'rish
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedLesson?.subject_name} - {selectedLesson?.group_name}
            </DialogTitle>
          </DialogHeader>

          {selectedLesson && (
            <div className="space-y-6">
              {/* Map */}
              {selectedLesson.latitude && selectedLesson.longitude && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>Dars joylashuvi (radius: {selectedLesson.radius_meters}m)</span>
                  </div>
                  <AttendanceMap
                    lessonLat={selectedLesson.latitude}
                    lessonLng={selectedLesson.longitude}
                    radiusMeters={selectedLesson.radius_meters}
                    attendance={attendanceDetails}
                  />
                </div>
              )}

              {/* Attendance List */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Talabalar ro'yxati ({attendanceDetails.length} ta)</span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Talaba</TableHead>
                        <TableHead>Holat</TableHead>
                        <TableHead>Masofa</TableHead>
                        <TableHead>Vaqt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceDetails.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.student_name}</TableCell>
                          <TableCell>
                            <span className={getStatusColor(record.status)}>
                              {getStatusLabel(record.status)}
                            </span>
                            {record.is_fake_gps && (
                              <span className="text-xs text-destructive block">Fake GPS!</span>
                            )}
                            {record.suspicious_reason && (
                              <span className="text-xs text-suspicious block">{record.suspicious_reason}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.distance_meters !== null ? `${Math.round(record.distance_meters)}m` : "-"}
                          </TableCell>
                          <TableCell>
                            {record.check_in_time
                              ? new Date(record.check_in_time).toLocaleTimeString("uz-UZ")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-5 gap-3">
                <div className="text-center p-3 rounded-lg bg-success/10">
                  <p className="text-xl font-bold text-success">{selectedLesson.stats.present}</p>
                  <p className="text-xs text-muted-foreground">Keldi</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <p className="text-xl font-bold text-destructive">{selectedLesson.stats.absent}</p>
                  <p className="text-xs text-muted-foreground">Kelmadi</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10">
                  <p className="text-xl font-bold text-primary">{selectedLesson.stats.excused}</p>
                  <p className="text-xs text-muted-foreground">Sababli</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-warning/10">
                  <p className="text-xl font-bold text-warning">{selectedLesson.stats.unexcused}</p>
                  <p className="text-xs text-muted-foreground">Sababsiz</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-suspicious/10">
                  <p className="text-xl font-bold text-suspicious">{selectedLesson.stats.suspicious}</p>
                  <p className="text-xs text-muted-foreground">Shubhali</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default TeacherLessonHistory;
