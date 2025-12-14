import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { TeacherLayout } from "@/components/layouts/TeacherLayout";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  MapPin,
} from "lucide-react";
import { AttendanceMap } from "@/components/AttendanceMap";

interface AttendanceRecord {
  id: string;
  status: "present" | "absent" | "excused" | "unexcused" | "suspicious";
  distance_meters: number | null;
  is_fake_gps: boolean;
  suspicious_reason: string | null;
  check_in_time: string | null;
  student: {
    id: string;
    full_name: string;
  };
}

interface Lesson {
  id: string;
  subject: { name: string };
  group: { name: string };
  started_at: string;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
}

const TeacherAttendance = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const { toast } = useToast();

  const currentLesson = lessons.find((l) => l.id === selectedLesson);

  useEffect(() => {
    fetchLessons();
  }, [user]);

  useEffect(() => {
    if (selectedLesson) {
      fetchAttendance();

      // Subscribe to realtime attendance updates
      const channel = supabase
        .channel(`attendance-${selectedLesson}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
            filter: `lesson_id=eq.${selectedLesson}`,
          },
          (payload) => {
            console.log("Realtime update:", payload);
            fetchAttendance(); // Refetch to get updated data with student names
            toast({
              title: "Yangilanish",
              description: "Davomat yangilandi",
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedLesson]);

  const fetchLessons = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, started_at, is_active, subject_id, group_id, latitude, longitude, radius_meters")
        .eq("teacher_id", user.id)
        .order("started_at", { ascending: false })
        .limit(20);

      if (lessonsData) {
        // Get subject and group names
        const { data: subjects } = await supabase.from("subjects").select("id, name");
        const { data: groups } = await supabase.from("groups").select("id, name");

        const subjectMap: Record<string, string> = {};
        const groupMap: Record<string, string> = {};
        subjects?.forEach(s => subjectMap[s.id] = s.name);
        groups?.forEach(g => groupMap[g.id] = g.name);

        const lessonsWithNames = lessonsData.map(l => ({
          ...l,
          subject: { name: subjectMap[l.subject_id] || "" },
          group: { name: groupMap[l.group_id] || "" },
          radius_meters: l.radius_meters || 150,
        }));

        setLessons(lessonsWithNames);

        // Auto-select active lesson
        const activeLesson = lessonsWithNames.find(l => l.is_active);
        if (activeLesson) {
          setSelectedLesson(activeLesson.id);
        }
      }
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Darslarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data } = await supabase
        .from("attendance")
        .select("id, status, distance_meters, is_fake_gps, suspicious_reason, check_in_time, student_id, latitude, longitude")
        .eq("lesson_id", selectedLesson);

      if (data) {
        // Get student names
        const studentIds = data.map(a => a.student_id);
        const { data: students } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", studentIds);

        const studentMap: Record<string, string> = {};
        students?.forEach(s => studentMap[s.id] = s.full_name);

        const attendanceWithNames = data.map(a => ({
          ...a,
          student: { id: a.student_id, full_name: studentMap[a.student_id] || "Noma'lum" },
        })) as AttendanceRecord[];

        setAttendance(attendanceWithNames);
      }
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Davomatni yuklashda xatolik",
        variant: "destructive",
      });
    }
  };

  const getStatusLabelForNotification = (status: string) => {
    switch (status) {
      case "present": return "Keldi";
      case "absent": return "Kelmadi";
      case "excused": return "Sababli";
      case "unexcused": return "Sababsiz";
      case "suspicious": return "Shubhali";
      default: return status;
    }
  };

  const updateStatus = async (recordId: string, status: AttendanceRecord["status"]) => {
    if (!user) return;
    setIsUpdating(recordId);

    const record = attendance.find(a => a.id === recordId);

    try {
      await supabase
        .from("attendance")
        .update({ status, marked_by: user.id })
        .eq("id", recordId);

      // Send notification to student about status change
      if (record) {
        await supabase.from("notifications").insert({
          user_id: record.student.id,
          title: "Davomat yangilandi",
          body: `Sizning davomatingiz "${getStatusLabelForNotification(status)}" deb belgilandi.`,
          type: "attendance_update",
        });
      }

      setAttendance(prev =>
        prev.map(a => (a.id === recordId ? { ...a, status } : a))
      );

      toast({
        title: "Saqlandi",
        description: "Davomat yangilandi",
      });
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Yangilashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-5 h-5 text-success" />;
      case "absent":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "excused":
        return <FileText className="w-5 h-5 text-primary" />;
      case "unexcused":
        return <Clock className="w-5 h-5 text-warning" />;
      case "suspicious":
        return <AlertTriangle className="w-5 h-5 text-suspicious" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "present":
        return "status-present";
      case "absent":
        return "status-absent";
      case "excused":
        return "bg-primary/15 text-primary";
      case "unexcused":
        return "status-excused";
      case "suspicious":
        return "status-suspicious";
      default:
        return "";
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
          <h1 className="text-2xl font-bold text-foreground">Davomat</h1>
          <p className="text-muted-foreground">Talabalar davomatini belgilang</p>
        </div>

        {/* Lesson Selector */}
        <div className="cyber-card p-4">
          <Select value={selectedLesson} onValueChange={setSelectedLesson}>
            <SelectTrigger>
              <SelectValue placeholder="Darsni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {lessons.map((lesson) => (
                <SelectItem key={lesson.id} value={lesson.id}>
                  <span className="flex items-center gap-2">
                    {lesson.is_active && (
                      <span className="w-2 h-2 bg-success rounded-full" />
                    )}
                    {lesson.subject.name} - {lesson.group.name} (
                    {new Date(lesson.started_at).toLocaleDateString("uz-UZ")})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Map Toggle and Map */}
        {selectedLesson && currentLesson?.latitude && currentLesson?.longitude && (
          <div className="cyber-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <span className="font-medium">Xarita</span>
              </div>
              <Button
                variant={showMap ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMap(!showMap)}
              >
                {showMap ? "Yopish" : "Ko'rsatish"}
              </Button>
            </div>
            {showMap && (
              <AttendanceMap
                lessonLat={currentLesson.latitude}
                lessonLng={currentLesson.longitude}
                radiusMeters={currentLesson.radius_meters}
                attendance={attendance.map((a) => ({
                  id: a.id,
                  student_name: a.student.full_name,
                  status: a.status,
                  latitude: (a as any).latitude,
                  longitude: (a as any).longitude,
                  distance_meters: a.distance_meters,
                  check_in_time: a.check_in_time,
                }))}
              />
            )}
          </div>
        )}

        {/* Attendance Table */}
        {selectedLesson && (
          <div className="cyber-card overflow-hidden">
            {attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p>Talabalar topilmadi</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Talaba</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Masofa</TableHead>
                    <TableHead className="text-right">Belgilash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.student.full_name}</p>
                          {record.check_in_time && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(record.check_in_time).toLocaleTimeString("uz-UZ")}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge ${getStatusBadgeClass(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span className="ml-1">{getStatusLabel(record.status)}</span>
                        </span>
                        {record.is_fake_gps && (
                          <p className="text-xs text-destructive mt-1">Fake GPS!</p>
                        )}
                        {record.suspicious_reason && (
                          <p className="text-xs text-suspicious mt-1">{record.suspicious_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.distance_meters !== null ? (
                          <span className={record.distance_meters > 120 ? "text-destructive" : "text-success"}>
                            {Math.round(record.distance_meters)}m
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant={record.status === "present" ? "default" : "ghost"}
                            size="icon"
                            onClick={() => updateStatus(record.id, "present")}
                            disabled={isUpdating === record.id}
                            className="h-8 w-8"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={record.status === "absent" ? "destructive" : "ghost"}
                            size="icon"
                            onClick={() => updateStatus(record.id, "absent")}
                            disabled={isUpdating === record.id}
                            className="h-8 w-8"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={record.status === "excused" ? "default" : "ghost"}
                            size="icon"
                            onClick={() => updateStatus(record.id, "excused")}
                            disabled={isUpdating === record.id}
                            className="h-8 w-8"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={record.status === "suspicious" ? "default" : "ghost"}
                            size="icon"
                            onClick={() => updateStatus(record.id, "suspicious")}
                            disabled={isUpdating === record.id}
                            className="h-8 w-8 text-suspicious"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        {/* Summary */}
        {selectedLesson && attendance.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {["present", "absent", "excused", "unexcused", "suspicious"].map((status) => (
              <div key={status} className="cyber-card p-3 text-center">
                <p className="text-xl font-bold text-foreground">
                  {attendance.filter((a) => a.status === status).length}
                </p>
                <p className="text-xs text-muted-foreground">{getStatusLabel(status)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
};

export default TeacherAttendance;
