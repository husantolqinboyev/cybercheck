import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Plus,
  Trash2,
  Users,
  Loader2,
  Search,
  UserPlus,
  GraduationCap,
} from "lucide-react";

interface Group {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  login: string;
}

interface StudentGroup {
  id: string;
  student_id: string;
  group_id: string;
}

const AdminStudentGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      fetchStudentGroups();
    }
  }, [selectedGroup]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [groupsRes, studentsRes] = await Promise.all([
        supabase.from("groups").select("id, name").order("name"),
        supabase
          .from("users")
          .select("id, full_name, login")
          .eq("role", "student")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      setGroups(groupsRes.data || []);
      setStudents(studentsRes.data || []);
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

  const fetchStudentGroups = async () => {
    try {
      const { data } = await supabase
        .from("student_groups")
        .select("id, student_id, group_id")
        .eq("group_id", selectedGroup);

      setStudentGroups(data || []);
    } catch (error) {
      console.error("Error fetching student groups:", error);
    }
  };

  const getGroupStudents = () => {
    const studentIds = studentGroups.map((sg) => sg.student_id);
    return students.filter((s) => studentIds.includes(s.id));
  };

  const getAvailableStudents = () => {
    const assignedIds = studentGroups.map((sg) => sg.student_id);
    return students.filter(
      (s) =>
        !assignedIds.includes(s.id) &&
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleAddStudents = async () => {
    if (!selectedGroup || selectedStudents.length === 0) return;

    setIsSaving(true);
    try {
      const records = selectedStudents.map((studentId) => ({
        student_id: studentId,
        group_id: selectedGroup,
      }));

      const { error } = await supabase.from("student_groups").insert(records);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: `${selectedStudents.length} ta talaba qo'shildi`,
      });

      setSelectedStudents([]);
      setIsDialogOpen(false);
      fetchStudentGroups();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Talabalarni qo'shishda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    const record = studentGroups.find((sg) => sg.student_id === studentId);
    if (!record) return;

    try {
      const { error } = await supabase
        .from("student_groups")
        .delete()
        .eq("id", record.id);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: "Talaba guruhdan chiqarildi",
      });

      fetchStudentGroups();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "O'chirishda xatolik",
        variant: "destructive",
      });
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const groupStudents = getGroupStudents();
  const availableStudents = getAvailableStudents();

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Guruh talabalari</h1>
          <p className="text-muted-foreground">
            Talabalarni guruhlarga biriktiring
          </p>
        </div>

        {/* Group Selector */}
        <div className="cyber-card p-4">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Guruhni tanlang
          </label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Guruh tanlang" />
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

        {selectedGroup && (
          <>
            {/* Add Students Button */}
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">
                <Users className="w-4 h-4 inline mr-1" />
                {groupStudents.length} ta talaba
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary text-primary-foreground">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Talaba qo'shish
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Talabalarni qo'shish</DialogTitle>
                  </DialogHeader>

                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Qidirish..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Student List */}
                  <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                    {availableStudents.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Mavjud talabalar topilmadi
                      </p>
                    ) : (
                      availableStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleStudent(student.id)}
                        >
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {student.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {student.login}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-border mt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setSelectedStudents([]);
                      }}
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      className="flex-1 gradient-primary text-primary-foreground"
                      onClick={handleAddStudents}
                      disabled={selectedStudents.length === 0 || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Qo'shish ({selectedStudents.length})
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Students List */}
            <div className="cyber-card overflow-hidden">
              {groupStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <GraduationCap className="w-12 h-12 mb-4 opacity-50" />
                  <p>Guruhda talabalar yo'q</p>
                  <p className="text-sm">Yuqoridagi tugmadan qo'shing</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {groupStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            {student.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {student.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {student.login}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStudent(student.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStudentGroups;
