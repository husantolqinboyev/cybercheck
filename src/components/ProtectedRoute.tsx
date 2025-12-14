import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "teacher" | "student")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }

    if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, isLoading, navigate, allowedRoles]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-cyber flex items-center justify-center animate-pulse-soft">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Yuklanmoqda...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
