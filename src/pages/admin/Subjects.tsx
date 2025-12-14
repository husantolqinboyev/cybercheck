import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { sanitizeInput } from "@/lib/auth";
import { Plus, Pencil, Trash2, BookOpen, Loader2, User } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";

interface Subject {
  id: string;
  name: string;
  teacher_id: string | null;
  created_at: string;
  teacher?: { full_name: string } | null;
}

interface Teacher {
  id: string;
  full_name: string;
}

const AdminSubjects = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    teacher_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch subjects with teacher info
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("subjects")
        .select("*")
        .order("name");

      if (subjectsError) throw subjectsError;

      // Fetch teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("role", "teacher")
        .eq("is_active", true)
        .order("full_name");

      if (teachersError) throw teachersError;

      // Map teacher names to subjects
      const teacherMap: Record<string, string> = {};
      teachersData?.forEach((t) => {
        teacherMap[t.id] = t.full_name;
      });

      const subjectsWithTeachers = (subjectsData || []).map((s) => ({
        ...s,
        teacher: s.teacher_id ? { full_name: teacherMap[s.teacher_id] || "Noma'lum" } : null,
      }));

      setSubjects(subjectsWithTeachers);
      setTeachers(teachersData || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedName = sanitizeInput(formData.name);

    if (!sanitizedName) {
      toast({
        title: "Xatolik",
        description: "Fan nomi to'ldirilishi shart",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const subjectData = {
        name: sanitizedName,
        teacher_id: formData.teacher_id || null,
      };

      if (editingSubject) {
        const { error } = await supabase
          .from("subjects")
          .update(subjectData)
          .eq("id", editingSubject.id);

        if (error) throw error;

        toast({
          title: "Muvaffaqiyat",
          description: "Fan yangilandi",
        });
      } else {
        const { error } = await supabase.from("subjects").insert(subjectData);

        if (error) throw error;

        toast({
          title: "Muvaffaqiyat",
          description: "Yangi fan yaratildi",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Saqlashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      teacher_id: subject.teacher_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (subject: Subject) => {
    if (!confirm(`"${subject.name}" fanini o'chirishni xohlaysizmi?`)) return;

    try {
      const { error } = await supabase.from("subjects").delete().eq("id", subject.id);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: "Fan o'chirildi",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "O'chirishda xatolik",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingSubject(null);
    setFormData({ name: "", teacher_id: "" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fanlar</h1>
            <p className="text-muted-foreground">O'quv fanlarini boshqaring</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Yangi fan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSubject ? "Fanni tahrirlash" : "Yangi fan"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Fan nomi</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Masalan: Informatika"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">O'qituvchi (ixtiyoriy)</Label>
                  <Select
                    value={formData.teacher_id || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, teacher_id: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="O'qituvchini tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanlanmagan</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 gradient-primary text-primary-foreground"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : editingSubject ? (
                      "Saqlash"
                    ) : (
                      "Yaratish"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="cyber-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>Fanlar topilmadi</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fan nomi</TableHead>
                  <TableHead>O'qituvchi</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>
                      {subject.teacher ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {subject.teacher.full_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(subject)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(subject)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSubjects;
