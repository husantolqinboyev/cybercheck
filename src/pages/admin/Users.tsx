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
import {
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Search,
  Loader2,
  Shield,
  GraduationCap,
  Users,
  Smartphone,
  RotateCcw,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";

interface User {
  id: string;
  login: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
  created_at: string;
  device_fingerprint: string | null;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    login: "",
    password: "",
    full_name: "",
    role: "student" as "admin" | "teacher" | "student",
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers((data as User[]) || []);
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Foydalanuvchilarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedLogin = sanitizeInput(formData.login);
    const sanitizedName = sanitizeInput(formData.full_name);
    const sanitizedPassword = sanitizeInput(formData.password);

    if (!sanitizedLogin || !sanitizedName) {
      toast({
        title: "Xatolik",
        description: "Login va ism to'ldirilishi shart",
        variant: "destructive",
      });
      return;
    }

    if (!editingUser && !sanitizedPassword) {
      toast({
        title: "Xatolik",
        description: "Parol to'ldirilishi shart",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingUser) {
        const updateData: Record<string, string> = {
          login: sanitizedLogin,
          full_name: sanitizedName,
          role: formData.role,
        };

        if (sanitizedPassword) {
          updateData.password_hash = sanitizedPassword;
        }

        const { error } = await supabase
          .from("users")
          .update(updateData)
          .eq("id", editingUser.id);

        if (error) throw error;

        toast({
          title: "Muvaffaqiyat",
          description: "Foydalanuvchi yangilandi",
        });
      } else {
        const { error } = await supabase.from("users").insert({
          login: sanitizedLogin,
          password_hash: sanitizedPassword,
          full_name: sanitizedName,
          role: formData.role,
        });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Xatolik",
              description: "Bu login allaqachon mavjud",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Muvaffaqiyat",
          description: "Yangi foydalanuvchi yaratildi",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchUsers();
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

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      login: user.login,
      password: "",
      full_name: user.full_name,
      role: user.role,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (user: User) => {
    if (user.role === "admin") {
      toast({
        title: "Xatolik",
        description: "Admin foydalanuvchini o'chirib bo'lmaydi",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`${user.full_name} ni o'chirishni xohlaysizmi?`)) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: "Foydalanuvchi o'chirildi",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "O'chirishda xatolik",
        variant: "destructive",
      });
    }
  };

  const resetDeviceBinding = async (user: User) => {
    if (!confirm(`${user.full_name} ning qurilma bog'lanishini bekor qilishni xohlaysizmi?`)) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({ device_fingerprint: null })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Muvaffaqiyat",
        description: "Qurilma bog'lanishi bekor qilindi",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Qurilma bog'lanishini bekor qilishda xatolik",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      login: "",
      password: "",
      full_name: "",
      role: "student",
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "teacher":
        return <Users className="w-4 h-4" />;
      default:
        return <GraduationCap className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "teacher":
        return "O'qituvchi";
      default:
        return "Talaba";
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-primary/15 text-primary";
      case "teacher":
        return "bg-accent/15 text-accent";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.login.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole && user.is_active;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Foydalanuvchilar</h1>
            <p className="text-muted-foreground">
              O'qituvchi va talabalarni boshqaring
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <UserPlus className="w-4 h-4 mr-2" />
                Yangi foydalanuvchi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">To'liq ism</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    placeholder="Ism familiya"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login">Login</Label>
                  <Input
                    id="login"
                    value={formData.login}
                    onChange={(e) =>
                      setFormData({ ...formData, login: e.target.value })
                    }
                    placeholder="login_kiriting"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Parol {editingUser && "(bo'sh qoldirsa o'zgarmaydi)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="********"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "admin" | "teacher" | "student") =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Talaba</SelectItem>
                      <SelectItem value="teacher">O'qituvchi</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
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
                    ) : editingUser ? (
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barchasi</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="teacher">O'qituvchi</SelectItem>
              <SelectItem value="student">Talaba</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="cyber-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p>Foydalanuvchilar topilmadi</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ism</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {user.login}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {getRoleIcon(user.role)}
                        {getRoleLabel(user.role)}
                      </span>
                      {user.role === "student" && user.device_fingerprint && (
                        <span className="ml-2 text-xs text-muted-foreground" title="Qurilma bog'langan">
                          <Smartphone className="w-3 h-3 inline" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {user.role === "student" && user.device_fingerprint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => resetDeviceBinding(user)}
                            title="Qurilma bog'lanishini bekor qilish"
                          >
                            <RotateCcw className="w-4 h-4 text-warning" />
                          </Button>
                        )}
                        {user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="cyber-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.is_active).length}
              </p>
              <p className="text-sm text-muted-foreground">Jami</p>
            </div>
          </div>
          <div className="cyber-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role === "teacher" && u.is_active).length}
              </p>
              <p className="text-sm text-muted-foreground">O'qituvchilar</p>
            </div>
          </div>
          <div className="cyber-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter((u) => u.role === "student" && u.is_active).length}
              </p>
              <p className="text-sm text-muted-foreground">Talabalar</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
