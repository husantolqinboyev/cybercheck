import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  status: "present" | "absent" | "excused" | "unexcused" | "suspicious";
  check_in_time: string | null;
  created_at: string;
  lesson: {
    subject: string;
    started_at: string;
  };
}

const StudentHistory = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    excused: 0,
    suspicious: 0,
  });

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("id, status, check_in_time, created_at, lesson_id")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (attendanceData) {
        // Get lesson info
        const lessonIds = attendanceData.map(a => a.lesson_id);
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, subject_id, started_at")
          .in("id", lessonIds);

        const { data: subjects } = await supabase.from("subjects").select("id, name");

        const lessonMap: Record<string, { subject: string; started_at: string }> = {};
        const subjectMap: Record<string, string> = {};
        
        subjects?.forEach(s => subjectMap[s.id] = s.name);
        lessons?.forEach(l => {
          lessonMap[l.id] = {
            subject: subjectMap[l.subject_id] || "Noma'lum",
            started_at: l.started_at,
          };
        });

        const recordsWithLessons = attendanceData.map(a => ({
          ...a,
          lesson: lessonMap[a.lesson_id] || { subject: "Noma'lum", started_at: a.created_at },
        })) as AttendanceRecord[];

        setRecords(recordsWithLessons);

        // Calculate stats
        setStats({
          total: recordsWithLessons.length,
          present: recordsWithLessons.filter(r => r.status === "present").length,
          absent: recordsWithLessons.filter(r => r.status === "absent").length,
          excused: recordsWithLessons.filter(r => r.status === "excused").length,
          suspicious: recordsWithLessons.filter(r => r.status === "suspicious").length,
        });
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
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

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "present": return "bg-success/15 text-success";
      case "absent": return "bg-destructive/15 text-destructive";
      case "excused": return "bg-primary/15 text-primary";
      case "unexcused": return "bg-warning/15 text-warning";
      case "suspicious": return "bg-suspicious/15 text-suspicious";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Davomat tarixi</h1>
          <p className="text-sm text-muted-foreground">Oxirgi 50 ta yozuv</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="cyber-card p-3 text-center">
            <p className="text-lg font-bold text-success">{stats.present}</p>
            <p className="text-xs text-muted-foreground">Keldi</p>
          </div>
          <div className="cyber-card p-3 text-center">
            <p className="text-lg font-bold text-destructive">{stats.absent}</p>
            <p className="text-xs text-muted-foreground">Kelmadi</p>
          </div>
          <div className="cyber-card p-3 text-center">
            <p className="text-lg font-bold text-primary">{stats.excused}</p>
            <p className="text-xs text-muted-foreground">Sababli</p>
          </div>
          <div className="cyber-card p-3 text-center">
            <p className="text-lg font-bold text-suspicious">{stats.suspicious}</p>
            <p className="text-xs text-muted-foreground">Shubhali</p>
          </div>
        </div>

        {/* Attendance Rate */}
        {stats.total > 0 && (
          <div className="cyber-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Davomat foizi</span>
              <span className="font-bold text-foreground">
                {Math.round((stats.present / stats.total) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${(stats.present / stats.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* History List */}
        <div className="space-y-2">
          {records.length === 0 ? (
            <div className="cyber-card p-8 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Davomat tarixi topilmadi</p>
            </div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="cyber-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(record.status)}
                    <div>
                      <p className="font-medium text-foreground">{record.lesson.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.lesson.started_at).toLocaleDateString("uz-UZ")} •{" "}
                        {new Date(record.lesson.started_at).toLocaleTimeString("uz-UZ", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                      record.status
                    )}`}
                  >
                    {getStatusLabel(record.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </StudentLayout>
  );
};

export default StudentHistory;
