import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Redirect based on role
      switch (user.role) {
        case "admin":
          navigate("/admin/users", { replace: true });
          break;
        case "teacher":
          navigate("/teacher/lessons", { replace: true });
          break;
        case "student":
          navigate("/student/checkin", { replace: true });
          break;
        default:
          navigate("/login", { replace: true });
      }
    }
  }, [user, navigate]);

  return null;
};

export default Dashboard;
