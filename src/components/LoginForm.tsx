import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { sanitizeInput } from "@/lib/auth";

export function LoginForm() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedLogin = sanitizeInput(login);
    const sanitizedPassword = sanitizeInput(password);

    if (!sanitizedLogin || !sanitizedPassword) {
      toast({
        title: "Xatolik",
        description: "Login va parol to'ldirilishi shart",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await authLogin(sanitizedLogin, sanitizedPassword);
      
      if (result.success) {
        toast({
          title: "Xush kelibsiz!",
          description: "Tizimga muvaffaqiyatli kirdingiz",
        });
        navigate("/dashboard");
      } else {
        toast({
          title: "Xatolik",
          description: result.error || "Login yoki parol noto'g'ri",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Tizim xatosi yuz berdi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="cyber-card p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-cyber flex items-center justify-center mb-4 cyber-glow">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">CyberCheck</h1>
          <p className="text-muted-foreground text-sm mt-1">Xavfsiz davomat tizimi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="login" className="text-sm font-medium">
              Login
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="pl-10 h-12"
                placeholder="Login kiriting"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Parol
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                placeholder="Parol kiriting"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 gradient-primary text-primary-foreground font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Tekshirilmoqda...
              </>
            ) : (
              "Kirish"
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Xavfsiz ulanish</span>
          </div>
        </div>
      </div>
    </div>
  );
}
