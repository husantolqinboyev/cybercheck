import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield,
  BookOpen,
  ClipboardCheck,
  LogOut,
  Menu,
  X,
  History,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TeacherLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: BookOpen, label: "Darslar", href: "/teacher/lessons" },
  { icon: ClipboardCheck, label: "Davomat", href: "/teacher/attendance" },
  { icon: History, label: "Tarix", href: "/teacher/history" },
];

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-cyber flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground">CyberCheck</span>
              <p className="text-xs text-muted-foreground">O'qituvchi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.full_name}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden lg:flex">
              <LogOut className="w-4 h-4 mr-2" />
              Chiqish
            </Button>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex px-4 pb-2 gap-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden px-4 pb-4 space-y-1 border-b border-border bg-card">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full"
            >
              <LogOut className="w-5 h-5" />
              Chiqish
            </button>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
