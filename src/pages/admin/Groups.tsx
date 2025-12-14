import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Users, Loader2, FolderOpen } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  student_count?: number;
}

const AdminGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .order("name");

      if (groupsError) throw groupsError;

      // Get student counts
      const { data: studentCounts, error: countError } = await supabase
        .from("student_groups")
        .select("group_id");

      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      studentCounts?.forEach((sg) => {
        countMap[sg.group_id] = (countMap[sg.group_id] || 0) + 1;
      });

      const groupsWithCounts = (groupsData || []).map((g) => ({
        ...g,
        student_count: countMap[g.id] || 0,
      }));

      setGroups(groupsWithCounts);
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Guruhlarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedName = sanitizeInput(formData.name);
    const sanitizedDesc = sanitizeInput(formData.description);

    if (!sanitizedName) {
      toast({
        title: "Xatolik",
        description: "Guruh nomi to'ldirilishi shart",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("groups")
          .update({
            name: sanitizedName,
            description: sanitizedDesc || null,
          })
          .eq("id", editingGroup.id);

        if (error) throw error;

        toast({
          title: "Muvaffaqiyat",
          description: "Guruh yangilandi",
        });
      } else {
        const { error } = await supabase.from("groups").insert({
          name: sanitizedName,
          description: sanitizedDesc || null,
        });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Xatolik",
              description: "Bu nom bilan guruh allaqachon mavjud",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Muvaffaqiyat",
          description: "Yangi guruh yaratildi",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchGroups();
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

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (group: Group) => {
    if (group.student_count && group.student_count > 0) {
      toast({
        title: "Xatolik",
        description: "Guruhda talabalar bor, avval ularni o'chiring",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`"${group.name}" guruhini o'chirishni xohlaysizmi?`)) return;

    try {
      const { error } = await supabase.from("groups").delete().eq("id", group.id);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: "Guruh o'chirildi",
      });
      fetchGroups();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "O'chirishda xatolik",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Guruhlar</h1>
            <p className="text-muted-foreground">Talaba guruhlarini boshqaring</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Yangi guruh
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? "Guruhni tahrirlash" : "Yangi guruh"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Guruh nomi</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Masalan: 21-1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Tavsif (ixtiyoriy)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Guruh haqida qo'shimcha ma'lumot..."
                    rows={3}
                  />
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
                    ) : editingGroup ? (
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
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
              <p>Guruhlar topilmadi</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guruh nomi</TableHead>
                  <TableHead>Tavsif</TableHead>
                  <TableHead>Talabalar</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {group.description || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {group.student_count || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(group)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(group)}
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

export default AdminGroups;
