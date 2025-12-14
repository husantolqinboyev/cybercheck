import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Users,
  AlertTriangle,
  TrendingDown,
  Calendar,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  excused: number;
  suspicious: number;
}

interface GroupStats {
  id: string;
  name: string;
  totalLessons: number;
  totalAttendance: number;
  presentRate: number;
}

interface SuspiciousRecord {
  id: string;
  student_name: string;
  lesson_date: string;
  subject_name: string;
  group_name: string;
  reason: string;
}

interface AbsentStudent {
  id: string;
  full_name: string;
  total_lessons: number;
  absent_count: number;
  absent_rate: number;
}

const AdminReports = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [dailyStats, setDailyStats] = useState<AttendanceStats>({
    total: 0,
    present: 0,
    absent: 0,
    excused: 0,
    suspicious: 0,
  });
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [suspiciousRecords, setSuspiciousRecords] = useState<SuspiciousRecord[]>([]);
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: subDays(now, 30), end: now };
      default:
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDailyStats(),
        fetchGroupStats(),
        fetchSuspiciousRecords(),
        fetchAbsentStudents(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDailyStats = async () => {
    const { start, end } = getDateRange();

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString());

    if (!lessons || lessons.length === 0) {
      setDailyStats({ total: 0, present: 0, absent: 0, excused: 0, suspicious: 0 });
      return;
    }

    const lessonIds = lessons.map((l) => l.id);

    const { data: attendance } = await supabase
      .from("attendance")
      .select("status")
      .in("lesson_id", lessonIds);

    if (!attendance) {
      setDailyStats({ total: 0, present: 0, absent: 0, excused: 0, suspicious: 0 });
      return;
    }

    const stats: AttendanceStats = {
      total: attendance.length,
      present: attendance.filter((a) => a.status === "present").length,
      absent: attendance.filter((a) => a.status === "absent" || a.status === "unexcused").length,
      excused: attendance.filter((a) => a.status === "excused").length,
      suspicious: attendance.filter((a) => a.status === "suspicious").length,
    };

    setDailyStats(stats);
  };

  const fetchGroupStats = async () => {
    const { start, end } = getDateRange();

    const { data: groups } = await supabase.from("groups").select("id, name");

    if (!groups) return;

    const groupStatsData: GroupStats[] = [];

    for (const group of groups) {
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id")
        .eq("group_id", group.id)
        .gte("started_at", start.toISOString())
        .lte("started_at", end.toISOString());

      if (!lessons || lessons.length === 0) {
        groupStatsData.push({
          id: group.id,
          name: group.name,
          totalLessons: 0,
          totalAttendance: 0,
          presentRate: 0,
        });
        continue;
      }

      const lessonIds = lessons.map((l) => l.id);

      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .in("lesson_id", lessonIds);

      const total = attendance?.length || 0;
      const present = attendance?.filter((a) => a.status === "present").length || 0;

      groupStatsData.push({
        id: group.id,
        name: group.name,
        totalLessons: lessons.length,
        totalAttendance: total,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
      });
    }

    setGroupStats(groupStatsData.sort((a, b) => b.presentRate - a.presentRate));
  };

  const fetchSuspiciousRecords = async () => {
    const { start, end } = getDateRange();

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString());

    if (!lessons || lessons.length === 0) {
      setSuspiciousRecords([]);
      return;
    }

    const lessonIds = lessons.map((l) => l.id);

    const { data: suspicious } = await supabase
      .from("attendance")
      .select(`
        id,
        suspicious_reason,
        created_at,
        student_id,
        lesson_id
      `)
      .in("lesson_id", lessonIds)
      .eq("status", "suspicious")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!suspicious || suspicious.length === 0) {
      setSuspiciousRecords([]);
      return;
    }

    // Get student names
    const studentIds = [...new Set(suspicious.map((s) => s.student_id))];
    const { data: students } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", studentIds);

    // Get lesson details
    const { data: lessonDetails } = await supabase
      .from("lessons")
      .select(`
        id,
        started_at,
        subject_id,
        group_id
      `)
      .in("id", lessonIds);

    // Get subjects and groups
    const subjectIds = [...new Set(lessonDetails?.map((l) => l.subject_id) || [])];
    const groupIds = [...new Set(lessonDetails?.map((l) => l.group_id) || [])];

    const { data: subjects } = await supabase.from("subjects").select("id, name").in("id", subjectIds);
    const { data: groups } = await supabase.from("groups").select("id, name").in("id", groupIds);

    const studentMap = new Map(students?.map((s) => [s.id, s.full_name]));
    const lessonMap = new Map(lessonDetails?.map((l) => [l.id, l]));
    const subjectMap = new Map(subjects?.map((s) => [s.id, s.name]));
    const groupMap = new Map(groups?.map((g) => [g.id, g.name]));

    const records: SuspiciousRecord[] = suspicious.map((s) => {
      const lesson = lessonMap.get(s.lesson_id);
      return {
        id: s.id,
        student_name: studentMap.get(s.student_id) || "Noma'lum",
        lesson_date: lesson ? format(new Date(lesson.started_at), "dd.MM.yyyy HH:mm") : "",
        subject_name: lesson ? subjectMap.get(lesson.subject_id) || "Noma'lum" : "",
        group_name: lesson ? groupMap.get(lesson.group_id) || "Noma'lum" : "",
        reason: s.suspicious_reason || "Aniqlanmagan",
      };
    });

    setSuspiciousRecords(records);
  };

  const fetchAbsentStudents = async () => {
    const { start, end } = getDateRange();

    // Get all students
    const { data: students } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("role", "student")
      .eq("is_active", true);

    if (!students || students.length === 0) {
      setAbsentStudents([]);
      return;
    }

    // Get lessons in period
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, group_id")
      .gte("started_at", start.toISOString())
      .lte("started_at", end.toISOString());

    if (!lessons || lessons.length === 0) {
      setAbsentStudents([]);
      return;
    }

    // Get student-group assignments
    const { data: studentGroups } = await supabase.from("student_groups").select("student_id, group_id");

    const studentGroupMap = new Map<string, string[]>();
    studentGroups?.forEach((sg) => {
      const groups = studentGroupMap.get(sg.student_id) || [];
      groups.push(sg.group_id);
      studentGroupMap.set(sg.student_id, groups);
    });

    // Get all attendance
    const lessonIds = lessons.map((l) => l.id);
    const { data: attendance } = await supabase
      .from("attendance")
      .select("student_id, lesson_id, status")
      .in("lesson_id", lessonIds);

    const absentData: AbsentStudent[] = [];

    for (const student of students) {
      const studentGroupIds = studentGroupMap.get(student.id) || [];
      const relevantLessons = lessons.filter((l) => studentGroupIds.includes(l.group_id));
      const totalLessons = relevantLessons.length;

      if (totalLessons === 0) continue;

      const studentAttendance = attendance?.filter((a) => a.student_id === student.id) || [];
      const absentCount = studentAttendance.filter(
        (a) => a.status === "absent" || a.status === "unexcused"
      ).length;

      // Also count lessons where student has no attendance record
      const attendedLessonIds = new Set(studentAttendance.map((a) => a.lesson_id));
      const missedLessons = relevantLessons.filter((l) => !attendedLessonIds.has(l.id)).length;
      const totalAbsent = absentCount + missedLessons;

      if (totalAbsent > 0) {
        absentData.push({
          id: student.id,
          full_name: student.full_name,
          total_lessons: totalLessons,
          absent_count: totalAbsent,
          absent_rate: Math.round((totalAbsent / totalLessons) * 100),
        });
      }
    }

    setAbsentStudents(absentData.sort((a, b) => b.absent_rate - a.absent_rate).slice(0, 20));
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today":
        return "Bugun";
      case "week":
        return "Bu hafta";
      case "month":
        return "Oxirgi 30 kun";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hisobotlar</h1>
            <p className="text-muted-foreground">Davomat statistikasi va tahlil</p>
          </div>
          <Select value={period} onValueChange={(v: "today" | "week" | "month") => setPeriod(v)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Bugun</SelectItem>
              <SelectItem value="week">Bu hafta</SelectItem>
              <SelectItem value="month">Oxirgi 30 kun</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Jami</p>
                  <p className="text-2xl font-bold">{dailyStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Keldi</p>
                  <p className="text-2xl font-bold text-green-600">{dailyStats.present}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kelmadi</p>
                  <p className="text-2xl font-bold text-red-600">{dailyStats.absent}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sababli</p>
                  <p className="text-2xl font-bold text-blue-600">{dailyStats.excused}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shubhali</p>
                  <p className="text-2xl font-bold text-amber-600">{dailyStats.suspicious}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="groups" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="groups">Guruhlar</TabsTrigger>
            <TabsTrigger value="suspicious">Shubhali holatlar</TabsTrigger>
            <TabsTrigger value="absents">Ko'p qoldirganlar</TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Guruh bo'yicha davomat ({getPeriodLabel()})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groupStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Bu davr uchun ma'lumot yo'q
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guruh</TableHead>
                        <TableHead className="text-center">Darslar</TableHead>
                        <TableHead className="text-center">Davomat</TableHead>
                        <TableHead className="text-right">Kelish %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupStats.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell className="text-center">{group.totalLessons}</TableCell>
                          <TableCell className="text-center">{group.totalAttendance}</TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                group.presentRate >= 80
                                  ? "default"
                                  : group.presentRate >= 60
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {group.presentRate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suspicious Tab */}
          <TabsContent value="suspicious" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Shubhali holatlar ({getPeriodLabel()})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {suspiciousRecords.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Shubhali holatlar topilmadi
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Talaba</TableHead>
                        <TableHead>Sana</TableHead>
                        <TableHead>Fan</TableHead>
                        <TableHead>Guruh</TableHead>
                        <TableHead>Sabab</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suspiciousRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.student_name}</TableCell>
                          <TableCell>{record.lesson_date}</TableCell>
                          <TableCell>{record.subject_name}</TableCell>
                          <TableCell>{record.group_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              {record.reason}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Absents Tab */}
          <TabsContent value="absents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-red-500" />
                  Ko'p dars qoldirganlar reytingi ({getPeriodLabel()})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {absentStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Bu davr uchun ma'lumot yo'q
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Talaba</TableHead>
                        <TableHead className="text-center">Jami darslar</TableHead>
                        <TableHead className="text-center">Qoldirilgan</TableHead>
                        <TableHead className="text-right">Qoldirish %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {absentStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-bold text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell className="text-center">{student.total_lessons}</TableCell>
                          <TableCell className="text-center text-red-600 font-semibold">
                            {student.absent_count}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                student.absent_rate >= 50
                                  ? "destructive"
                                  : student.absent_rate >= 30
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {student.absent_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminReports;
