import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Shield,
  ClipboardCheck,
  History,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: ClipboardCheck, label: "Davomat", href: "/student/checkin" },
  { icon: History, label: "Tarix", href: "/student/history" },
];

export function StudentLayout({ children }: StudentLayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-cyber flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-sm">CyberCheck</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {user?.full_name}
            </span>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-4 max-w-md">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-border sticky bottom-0 safe-area-inset-bottom">
        <div className="flex justify-around py-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors",
                location.pathname === item.href
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
