import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Switch
} from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Power,
  PowerOff,
  Users,
  Calendar,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  History,
  Clock,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface Lesson {
  id: string;
  pin_code: string;
  is_active: boolean;
  pin_expires_at: string;
  teacher: { full_name: string };
  subject: { name: string };
  group: { name: string };
  created_at: string;
}

const AdminAttendanceControl = () => {
  const [activeLessons, setActiveLessons] = useState<Lesson[]>([]);
  const [historicalLessons, setHistoricalLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('7'); // days to look back
  const { toast } = useToast();

  useEffect(() => {
    fetchLessons();
  }, [dateFilter]);

  const fetchLessons = async () => {
    try {
      // Fetch active lessons
      const { data: activeData, error: activeError } = await supabase
        .from("lessons")
        .select(`
          id,
          pin_code,
          is_active,
          pin_expires_at,
          created_at,
          teacher:users(full_name),
          subject:subjects(name),
          group:groups(name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;
      setActiveLessons(activeData || []);

      // Fetch historical lessons
      const daysBack = parseInt(dateFilter);
      const startDate = startOfDay(subDays(new Date(), daysBack));
      const endDate = endOfDay(new Date());

      const { data: historicalData, error: historicalError } = await supabase
        .from("lessons")
        .select(`
          id,
          pin_code,
          is_active,
          pin_expires_at,
          created_at,
          teacher:users(full_name),
          subject:subjects(name),
          group:groups(name)
        `)
        .or(`is_active.eq.false,pin_expires_at.lt.${new Date().toISOString()}`)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (historicalError) throw historicalError;
      setHistoricalLessons(historicalData || []);

    } catch (error) {
      console.error("Darslarni olishda xato:", error);
      toast({
        title: "Xato",
        description: "Darslarni yuklab bo'lmadi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLessonStatus = async (lessonId: string, currentStatus: boolean, isHistorical: boolean = false) => {
    setToggling(lessonId);
    
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ 
          is_active: !currentStatus,
          // If activating, set new expiry time
          ...(currentStatus ? {} : {
            pin_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
          })
        })
        .eq("id", lessonId);

      if (error) throw error;

      // Update appropriate state
      if (isHistorical) {
        setHistoricalLessons(prev => prev.map(lesson => 
          lesson.id === lessonId 
            ? { 
                ...lesson, 
                is_active: !currentStatus,
                ...(currentStatus ? {} : {
                  pin_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                })
              }
            : lesson
        ));
      } else {
        setActiveLessons(prev => prev.map(lesson => 
          lesson.id === lessonId 
            ? { 
                ...lesson, 
                is_active: !currentStatus,
                ...(currentStatus ? {} : {
                  pin_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                })
              }
            : lesson
        ));
      }

      toast({
        title: currentStatus ? "Davomat to'xtatildi" : "Davomat yoqildi",
        description: currentStatus 
          ? "Dars uchun davomat yopildi" 
          : "Dars uchun davomat yoqildi",
      });

      // Refresh data to move between active/historical if needed
      fetchLessons();
    } catch (error) {
      console.error("Status o'zgartirishda xato:", error);
      toast({
        title: "Xato",
        description: "Statusni o'zgartirib bo'lmadi",
        variant: "destructive",
      });
    } finally {
      setToggling(null);
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Davomat boshqaruvi</h1>
            <p className="text-muted-foreground">
              Faol darslarni boshqarish va davomatni yoqish/o'chirish
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Faol darslar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeLessons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Hozircha faol darslar yo'q</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>O'qituvchi</TableHead>
                    <TableHead>Fan</TableHead>
                    <TableHead>Guruh</TableHead>
                    <TableHead>PIN kod</TableHead>
                    <TableHead>Yaratilgan</TableHead>
                    <TableHead>Muddati</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Boshqaruv</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLessons.map((lesson) => (
                    <TableRow key={lesson.id}>
                      <TableCell className="font-medium">
                        {lesson.teacher?.full_name || "Noma'lum"}
                      </TableCell>
                      <TableCell>{lesson.subject?.name || "Noma'lum"}</TableCell>
                      <TableCell>{lesson.group?.name || "Noma'lum"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {lesson.pin_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(lesson.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isExpired(lesson.pin_expires_at) ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              Tugagan
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Faol
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTime(lesson.pin_expires_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {lesson.is_active ? (
                            <Badge variant="default" className="gap-1">
                              <Power className="w-3 h-3" />
                              Yoqilgan
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <PowerOff className="w-3 h-3" />
                              O'chirilgan
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant={lesson.is_active ? "destructive" : "default"}
                          size="sm"
                          onClick={() => toggleLessonStatus(lesson.id, lesson.is_active)}
                          disabled={toggling === lesson.id}
                          className="gap-2"
                        >
                          {toggling === lesson.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : lesson.is_active ? (
                            <>
                              <PowerOff className="w-4 h-4" />
                              O'chirish
                            </>
                          ) : (
                            <>
                              <Power className="w-4 h-4" />
                              Yoqish
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Tushuntirish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Power className="w-4 h-4 mt-0.5 text-green-600" />
              <div>
                <strong>Yoqilgan:</strong> Talabalar davomat qilishlari mumkin
              </div>
            </div>
            <div className="flex items-start gap-2">
              <PowerOff className="w-4 h-4 mt-0.5 text-red-600" />
              <div>
                <strong>O'chirilgan:</strong> Talabalar davomat qila olmaydi
              </div>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 text-red-600" />
              <div>
                <strong>Tugagan:</strong> PIN kod muddati tugagan, yangi PIN kerak
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminAttendanceControl;
