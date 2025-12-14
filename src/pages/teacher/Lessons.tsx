import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { TeacherLayout } from "@/components/layouts/TeacherLayout";
import { generatePIN } from "@/lib/auth";
import { getCurrentLocation } from "@/lib/geolocation";
import {
  Play,
  Square,
  MapPin,
  Copy,
  Loader2,
  BookOpen,
  Users,
  CheckCircle,
  AlertTriangle,
  Settings,
  RefreshCw,
} from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ActiveLesson {
  id: string;
  pin_code: string;
  pin_expires_at: string;
  pin_validity_seconds: number;
  group: { name: string };
  subject: { name: string };
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface AttendanceStats {
  total: number;
  present: number;
  suspicious: number;
}

const TeacherLessons = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(120);
  const [pinValiditySeconds, setPinValiditySeconds] = useState(60);
  const [activeLesson, setActiveLesson] = useState<ActiveLesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, suspicious: 0 });
  const [pinTimeLeft, setPinTimeLeft] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (activeLesson) {
      fetchAttendanceStats();
      const interval = setInterval(fetchAttendanceStats, 5000);
      return () => clearInterval(interval);
    }
  }, [activeLesson]);

  // PIN countdown timer
  useEffect(() => {
    if (!activeLesson) {
      setPinTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const expiresAt = new Date(activeLesson.pin_expires_at).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setPinTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeLesson?.pin_expires_at]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const [groupsRes, subjectsRes] = await Promise.all([
        supabase.from("groups").select("id, name").order("name"),
        supabase
          .from("subjects")
          .select("id, name")
          .or(`teacher_id.eq.${user.id},teacher_id.is.null`)
          .order("name"),
      ]);

      const { data: lessonData } = await supabase
        .from("lessons")
        .select("id, pin_code, pin_expires_at, latitude, longitude, radius_meters, group_id, subject_id")
        .eq("teacher_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      setGroups(groupsRes.data || []);
      setSubjects(subjectsRes.data || []);

      if (lessonData) {
        const group = groupsRes.data?.find((g) => g.id === lessonData.group_id);
        const subject = subjectsRes.data?.find((s) => s.id === lessonData.subject_id);
        
        // Calculate validity seconds from pin_expires_at
        const expiresAt = new Date(lessonData.pin_expires_at).getTime();
        const createdApprox = expiresAt - (pinValiditySeconds * 1000);

        setActiveLesson({
          ...lessonData,
          pin_validity_seconds: pinValiditySeconds,
          group: { name: group?.name || "" },
          subject: { name: subject?.name || "" },
        } as ActiveLesson);
        setRadiusMeters(lessonData.radius_meters || 120);
      }
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Ma'lumotlarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendanceStats = async () => {
    if (!activeLesson) return;

    try {
      const { data } = await supabase
        .from("attendance")
        .select("status")
        .eq("lesson_id", activeLesson.id);

      if (data) {
        setStats({
          total: data.length,
          present: data.filter((a) => a.status === "present").length,
          suspicious: data.filter((a) => a.status === "suspicious").length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const startLesson = async () => {
    if (!selectedGroup || !selectedSubject || !user) {
      toast({
        title: "Xatolik",
        description: "Guruh va fanni tanlang",
        variant: "destructive",
      });
      return;
    }

    setIsStarting(true);

    try {
      const location = await getCurrentLocation();
      const pin = generatePIN();
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + pinValiditySeconds);

      const { data: lesson, error } = await supabase
        .from("lessons")
        .insert({
          teacher_id: user.id,
          group_id: selectedGroup,
          subject_id: selectedSubject,
          pin_code: pin,
          pin_expires_at: expiresAt.toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          radius_meters: radiusMeters,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Create attendance records for all students in the group
      const { data: students } = await supabase
        .from("student_groups")
        .select("student_id")
        .eq("group_id", selectedGroup);

      if (students && students.length > 0) {
        const attendanceRecords = students.map((s) => ({
          lesson_id: lesson.id,
          student_id: s.student_id,
          status: "absent" as const,
        }));

        await supabase.from("attendance").insert(attendanceRecords);

        // Send notifications to students about lesson start (without PIN)
        const subjectName = subjects.find((s) => s.id === selectedSubject)?.name || "Fan";
        const notificationRecords = students.map((s) => ({
          user_id: s.student_id,
          title: "Dars boshlandi!",
          body: `${subjectName} darsi boshlandi. Davomatni belgilang.`,
          type: "lesson_start",
        }));

        await supabase.from("notifications").insert(notificationRecords);
      }

      const group = groups.find((g) => g.id === selectedGroup);
      const subject = subjects.find((s) => s.id === selectedSubject);

      setActiveLesson({
        id: lesson.id,
        pin_code: pin,
        pin_expires_at: expiresAt.toISOString(),
        pin_validity_seconds: pinValiditySeconds,
        latitude: location.latitude,
        longitude: location.longitude,
        radius_meters: radiusMeters,
        group: { name: group?.name || "" },
        subject: { name: subject?.name || "" },
      });

      setIsPinDialogOpen(true);

      toast({
        title: "Dars boshlandi!",
        description: `PIN kod: ${pin} (${pinValiditySeconds} soniya)`,
      });
    } catch (error) {
      toast({
        title: "Xatolik",
        description: error instanceof Error ? error.message : "Darsni boshlashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const endLesson = async () => {
    if (!activeLesson) return;

    try {
      await supabase
        .from("lessons")
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq("id", activeLesson.id);

      setActiveLesson(null);
      setStats({ total: 0, present: 0, suspicious: 0 });
      toast({
        title: "Dars yakunlandi",
        description: "Davomat saqlandi",
      });
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Darsni yakunlashda xatolik",
        variant: "destructive",
      });
    }
  };

  const copyPIN = () => {
    if (activeLesson?.pin_code) {
      navigator.clipboard.writeText(activeLesson.pin_code);
      toast({ title: "Nusxalandi", description: "PIN kod nusxalandi" });
    }
  };

  const regeneratePIN = async () => {
    if (!activeLesson) return;

    try {
      const pin = generatePIN();
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + pinValiditySeconds);

      await supabase
        .from("lessons")
        .update({ pin_code: pin, pin_expires_at: expiresAt.toISOString() })
        .eq("id", activeLesson.id);

      setActiveLesson({
        ...activeLesson,
        pin_code: pin,
        pin_expires_at: expiresAt.toISOString(),
        pin_validity_seconds: pinValiditySeconds,
      });

      toast({ title: "Yangi PIN", description: `Yangi PIN kod: ${pin} (${pinValiditySeconds} soniya)` });
    } catch (error) {
      toast({ title: "Xatolik", description: "PIN yangilashda xatolik", variant: "destructive" });
    }
  };

  const updateRadius = async (newRadius: number) => {
    if (!activeLesson) return;

    try {
      await supabase
        .from("lessons")
        .update({ radius_meters: newRadius })
        .eq("id", activeLesson.id);

      setActiveLesson({ ...activeLesson, radius_meters: newRadius });
      setRadiusMeters(newRadius);

      toast({ title: "Saqlandi", description: `Radius: ${newRadius}m` });
    } catch (error) {
      toast({ title: "Xatolik", description: "Radiusni saqlashda xatolik", variant: "destructive" });
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
          <h1 className="text-2xl font-bold text-foreground">Darslar</h1>
          <p className="text-muted-foreground">Dars boshlang va davomat oling</p>
        </div>

        {activeLesson ? (
          <div className="space-y-4">
            <div className="cyber-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                  <span className="text-success font-medium">Dars faol</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                  <Settings className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-foreground">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span>{activeLesson.subject.name}</span>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{activeLesson.group.name}</span>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Radius: {activeLesson.radius_meters}m
                  </span>
                </div>
              </div>

              {/* PIN Display */}
              <div className="bg-muted rounded-xl p-6 text-center mb-4">
                <p className="text-sm text-muted-foreground mb-2">PIN kod</p>
                <div className="flex items-center justify-center gap-4">
                  <span className="font-mono text-4xl font-bold tracking-[0.3em] text-foreground">
                    {activeLesson.pin_code}
                  </span>
                  <Button variant="ghost" size="icon" onClick={copyPIN}>
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
                <div className="mt-3">
                  {pinTimeLeft > 0 ? (
                    <span className={`text-lg font-mono font-bold ${pinTimeLeft <= 10 ? "text-destructive animate-pulse" : "text-success"}`}>
                      {Math.floor(pinTimeLeft / 60)}:{(pinTimeLeft % 60).toString().padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="text-destructive font-medium">Muddati tugadi!</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={regeneratePIN}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Yangi PIN
                </Button>
                <Button variant="destructive" className="flex-1" onClick={endLesson}>
                  <Square className="w-4 h-4 mr-2" />
                  Yakunlash
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="cyber-card p-4 text-center">
                <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.present}</p>
                <p className="text-xs text-muted-foreground">Keldi</p>
              </div>
              <div className="cyber-card p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-warning mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.suspicious}</p>
                <p className="text-xs text-muted-foreground">Shubhali</p>
              </div>
              <div className="cyber-card p-4 text-center">
                <Users className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Jami</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="cyber-card p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Guruh</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fan</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Fanni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Radius Setting */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>GPS Radius</Label>
                  <span className="text-sm font-mono text-primary">{radiusMeters}m</span>
                </div>
                <Slider
                  value={[radiusMeters]}
                  onValueChange={(v) => setRadiusMeters(v[0])}
                  min={50}
                  max={500}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Talabalar bu radiusda bo'lishi kerak (50m - 500m)
                </p>
              </div>

              {/* PIN Validity Setting */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>PIN amal qilish vaqti</Label>
                  <span className="text-sm font-mono text-primary">{pinValiditySeconds} soniya</span>
                </div>
                <Slider
                  value={[pinValiditySeconds]}
                  onValueChange={(v) => setPinValiditySeconds(v[0])}
                  min={30}
                  max={210}
                  step={10}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  PIN kod amal qilish muddati (30s - 210s)
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button
                className="w-full h-14 gradient-primary text-primary-foreground text-lg font-semibold"
                onClick={startLesson}
                disabled={isStarting || !selectedGroup || !selectedSubject}
              >
                {isStarting ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                Darsni boshlash
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                GPS joylashuvingiz avtomatik saqlanadi
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dars sozlamalari</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>GPS Radius</Label>
                <span className="text-sm font-mono text-primary">{radiusMeters}m</span>
              </div>
              <Slider
                value={[radiusMeters]}
                onValueChange={(v) => setRadiusMeters(v[0])}
                min={50}
                max={500}
                step={10}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Talabalar darsdan bu masofada bo'lishi kerak
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                updateRadius(radiusMeters);
                setIsSettingsOpen(false);
              }}
            >
              Saqlash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">PIN kod yaratildi!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <div className="bg-muted rounded-xl p-6 mb-4">
              <span className="font-mono text-5xl font-bold tracking-[0.3em] text-foreground">
                {activeLesson?.pin_code}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">Bu kodni talabalarga ayting</p>
          </div>
          <Button onClick={() => setIsPinDialogOpen(false)} className="w-full">
            Tushunarli
          </Button>
        </DialogContent>
      </Dialog>
    </TeacherLayout>
  );
};

export default TeacherLessons;
