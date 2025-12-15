import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { getCurrentLocation, calculateDistance, detectSuspiciousGPS, FakeDetectionLevel } from "@/lib/geolocation";
import { getFingerprint, isMobileDevice, isAllowedBrowser } from "@/lib/auth";
import {
  Loader2,
  MapPin,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Smartphone,
} from "lucide-react";

const StudentCheckin = () => {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    success: boolean;
    message: string;
    status?: string;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const mobile = isMobileDevice();
    const allowed = isAllowedBrowser("student");
    setIsMobile(mobile && allowed);
  }, []);

  const handlePinChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setPin(cleaned);

    if (cleaned.length === 6) {
      handleCheckin(cleaned);
    }
  };

  const handleCheckin = async (pinCode: string, skipGPS: boolean = false) => {
    if (!user || pinCode.length !== 6) return;

    setIsChecking(true);
    setCheckResult(null);

    try {
      if (!isMobileDevice()) {
        setCheckResult({
          success: false,
          message: "Faqat mobil qurilmadan foydalaning!",
        });
        return;
      }

      // Find active lesson with this PIN
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, latitude, longitude, radius_meters, pin_expires_at, fake_detection_level, allow_skip_gps, pin_validity_seconds")
        .eq("pin_code", pinCode)
        .eq("is_active", true)
        .gte("pin_expires_at", new Date().toISOString())
        .maybeSingle();

      if (lessonError || !lesson) {
        setCheckResult({
          success: false,
          message: "PIN kod noto'g'ri yoki muddati o'tgan",
        });
        return;
      }

      // Get radius from lesson (teacher-configured)
      const radiusMeters = lesson.radius_meters || 120;

      // Skip GPS detection if requested
      let location, suspiciousCheck;
      if (skipGPS) {
        // Use default location or skip GPS entirely
        location = {
          latitude: 0,
          longitude: 0,
          accuracy: 9999,
          timestamp: Date.now()
        };
        suspiciousCheck = { isSuspicious: false, reasons: ["GPS tekshiruvi o'tkazib yuborildi"] };
      } else {
        // Check for suspicious GPS with lesson's detection level and teacher settings
        suspiciousCheck = await detectSuspiciousGPS(
          lesson.fake_detection_level as FakeDetectionLevel || 'medium',
          lesson.radius_meters,
          lesson.pin_validity_seconds,
          user?.role
        );

        // Get current location with better error handling
        try {
          location = await getCurrentLocation();
        } catch (error) {
          let errorMessage = "GPS xatosi";
          if (error instanceof Error) {
            errorMessage = error.message;
            // Provide specific guidance for common errors
            if (error.message.includes("ruxsat")) {
              errorMessage += "\n\nChrome/Safari sozlamalarida: \n1. Uch burchak menyuga bosing\n2. 'Joylashuv' ruxsatini 'Ruxsat berilgan' qiling\n3. Sahifani qayta yuklang";
            } else if (error.message.includes("Internet")) {
              errorMessage += "\n\nIltimos, Wi-Fi yoki mobil internet aloqasini tekshiring";
            }
          }
          setCheckResult({
            success: false,
            message: errorMessage,
          });
          return;
        }
      }

      // Calculate distance (only if GPS was used)
      let distance = 0;
      let isWithinRadius = true;
      
      if (!skipGPS && location) {
        distance = calculateDistance(
          location.latitude,
          location.longitude,
          lesson.latitude,
          lesson.longitude
        );
        isWithinRadius = distance <= radiusMeters;
      }

      const fingerprint = await getFingerprint();

      // Determine status
      let status: "present" | "suspicious" = "present";
      let suspiciousReason: string | null = null;

      if (!skipGPS && suspiciousCheck.isSuspicious) {
        status = "suspicious";
        suspiciousReason = suspiciousCheck.reasons.join(", ");
      } else if (!skipGPS && !isWithinRadius) {
        status = "suspicious";
        suspiciousReason = `Darsdan ${Math.round(distance)}m uzoqda (ruxsat: ${radiusMeters}m)`;
      } else if (skipGPS) {
        status = "present";
        suspiciousReason = "GPS tekshiruvi o'tkazib yuborildi";
      }

      // Update or create attendance record
      const { data: existingRecord } = await supabase
        .from("attendance")
        .select("id")
        .eq("lesson_id", lesson.id)
        .eq("student_id", user.id)
        .maybeSingle();

      if (existingRecord) {
        await supabase
          .from("attendance")
          .update({
            status,
            check_in_time: new Date().toISOString(),
            latitude: location.latitude,
            longitude: location.longitude,
            distance_meters: distance,
            is_fake_gps: suspiciousCheck.isSuspicious,
            suspicious_reason: suspiciousReason,
            fingerprint,
            user_agent: navigator.userAgent,
          })
          .eq("id", existingRecord.id);
      } else {
        await supabase.from("attendance").insert({
          lesson_id: lesson.id,
          student_id: user.id,
          status,
          check_in_time: new Date().toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          distance_meters: distance,
          is_fake_gps: suspiciousCheck.isSuspicious,
          suspicious_reason: suspiciousReason,
          fingerprint,
          user_agent: navigator.userAgent,
        });
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        action: "checkin",
        details: {
          lesson_id: lesson.id,
          distance,
          status,
          radius: radiusMeters,
          is_fake_gps: suspiciousCheck.isSuspicious,
        },
        user_agent: navigator.userAgent,
      });

      if (status === "present") {
        setCheckResult({
          success: true,
          message: `Davomat muvaffaqiyatli qayd etildi! (${Math.round(distance)}m)`,
          status: "present",
        });
      } else {
        setCheckResult({
          success: false,
          message: suspiciousReason || "Shubhali holat aniqlandi",
          status: "suspicious",
        });
      }

      setPin("");
    } catch (error) {
      setCheckResult({
        success: false,
        message: "Tizim xatosi yuz berdi",
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (!isMobile) {
    return (
      <StudentLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <Smartphone className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Faqat mobil brauzer!
          </h2>
          <p className="text-muted-foreground max-w-xs">
            CyberCheck talabalari faqat mobil qurilmadagi Chrome yoki Safari brauzeridan
            foydalanishlari mumkin.
          </p>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {checkResult ? (
          <div className="text-center fade-in">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 mx-auto ${
                checkResult.success
                  ? "bg-success/10"
                  : checkResult.status === "suspicious"
                  ? "bg-suspicious/10"
                  : "bg-destructive/10"
              }`}
            >
              {checkResult.success ? (
                <CheckCircle className="w-12 h-12 text-success" />
              ) : checkResult.status === "suspicious" ? (
                <AlertTriangle className="w-12 h-12 text-suspicious" />
              ) : (
                <XCircle className="w-12 h-12 text-destructive" />
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {checkResult.success ? "Muvaffaqiyat!" : "Diqqat!"}
            </h2>
            <p className="text-muted-foreground mb-6">{checkResult.message}</p>
            <Button onClick={() => setCheckResult(null)}>Qayta urinish</Button>
          </div>
        ) : (
          <div className="w-full max-w-xs text-center">
            <div className="w-16 h-16 rounded-2xl gradient-cyber flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-8 h-8 text-primary-foreground" />
            </div>

            <h2 className="text-xl font-bold text-foreground mb-2">PIN kodni kiriting</h2>
            <p className="text-muted-foreground text-sm mb-6">
              O'qituvchi bergan 6 xonali kodni kiriting
            </p>

            <div className="relative mb-6">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                className="h-16 text-center font-mono text-3xl tracking-[0.5em] pl-6"
                placeholder="______"
                maxLength={6}
                disabled={isChecking}
                autoFocus
              />
            </div>

            {/* Skip GPS Option - only show if teacher allows */}
            {checkResult?.lesson?.allow_skip_gps && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCheckin(pin, true)}
                  disabled={pin.length !== 6 || isChecking}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  GPS'siz tekshirish (Bosh)
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  GPS tekshiruvisiz davomat qilish (o'qituvchi ruxsat bergan)
                </p>
              </div>
            )}

            {isChecking && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Tekshirilmoqda...</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-6">
              <MapPin className="w-3 h-3 inline mr-1" />
              GPS joylashuvingiz tekshiriladi
            </p>
          </div>
        )}
      </div>
    </StudentLayout>
  );
};

export default StudentCheckin;
