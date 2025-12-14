import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full fade-in">
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;
