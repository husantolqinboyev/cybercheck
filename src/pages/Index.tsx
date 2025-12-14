import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, MapPin, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const features = [
    { icon: Lock, title: "XSS Himoyasi", desc: "Barcha kiritilgan ma'lumotlar tozalanadi" },
    { icon: MapPin, title: "GPS Tekshiruvi", desc: "Soxta joylashuv aniqlanadi" },
    { icon: Smartphone, title: "Mobil Brauzer", desc: "Faqat ruxsat berilgan qurilmalar" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg text-center fade-in">
          <div className="w-20 h-20 rounded-2xl gradient-cyber flex items-center justify-center mx-auto mb-6 cyber-glow">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            CyberCheck
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Universitetlar uchun xavfsiz web-asosidagi davomat tizimi
          </p>

          <Button
            size="lg"
            className="gradient-primary text-primary-foreground font-semibold h-14 px-8 text-lg"
            onClick={() => navigate("/login")}
          >
            Tizimga kirish
          </Button>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mt-12">
            {features.map((feature, i) => (
              <div key={i} className="text-center p-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-medium text-foreground text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>© 2024 CyberCheck. Barcha huquqlar himoyalangan.</p>
      </footer>
    </div>
  );
};

export default Index;
