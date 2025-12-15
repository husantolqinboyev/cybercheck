// Geolocation utilities for CyberCheck

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationCheckResult {
  isWithinRadius: boolean;
  distance: number;
  isFakeGPS: boolean;
  suspiciousReasons: string[];
}

export type FakeDetectionLevel = 'minimal' | 'medium' | 'maximal';

export interface DetectionThresholds {
  accuracyThreshold: number;
  maxAccuracy: number;
  varianceThreshold: number;
  timestampThreshold: number;
}

// Get detection thresholds based on level - realistic browser GPS values
export function getDetectionThresholds(level: FakeDetectionLevel): DetectionThresholds {
  switch (level) {
    case 'minimal':
      return {
        accuracyThreshold: 1.0,      // Realistic minimum for browser GPS
        maxAccuracy: 20000,          // Allow very high accuracy
        varianceThreshold: 0.000001, // Realistic variance
        timestampThreshold: 100      // Realistic timing
      };
    case 'medium':
      return {
        accuracyThreshold: 3.0,      // Typical browser GPS accuracy
        maxAccuracy: 15000,           // Allow high accuracy
        varianceThreshold: 0.00001,   // Normal variance
        timestampThreshold: 200      // Normal timing
      };
    case 'maximal':
      return {
        accuracyThreshold: 5.0,      // Very relaxed
        maxAccuracy: 10000,          // Moderate max accuracy
        varianceThreshold: 0.0001,   // Very relaxed variance
        timestampThreshold: 500      // Very relaxed timing
      };
    default:
      return getDetectionThresholds('medium');
  }
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// GPS diagnostikasi - qanday muammo borligini aniqlash
export async function diagnoseGPSSystem(): Promise<{
  isSupported: boolean;
  hasPermission: boolean;
  isHTTPS: boolean;
  browserInfo: string;
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  
  // Brauzer va HTTPS tekshiruvi
  const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';
  const browserInfo = navigator.userAgent;
  
  if (!isHTTPS) {
    recommendations.push("HTTPS protokol talab qilinadi. Localhost yoki HTTPS ishlatishingiz kerak.");
  }
  
  // Geolocation qo'llab-quvvatlashi
  const isSupported = 'geolocation' in navigator;
  if (!isSupported) {
    recommendations.push("Brauzeringiz Geolocation API qo'llab-quvvatlamaydi. Zamonaviy brauzer ishlating.");
  }
  
  // Ruxsat holati
  let hasPermission = false;
  if ('permissions' in navigator) {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      hasPermission = permission.state === 'granted';
      
      if (permission.state === 'denied') {
        recommendations.push("GPS ruxsati rad etilgan. Brauzer sozlamalaridan ruxsat bering.");
      } else if (permission.state === 'prompt') {
        recommendations.push("GPS ruxsati so'ralmagan. Darsni boshlaganda ruxsat bering.");
      }
    } catch (e) {
      recommendations.push("Ruxsat holatini tekshirib bo'lmadi. Brauzer sozlamalarini tekshiring.");
    }
  } else {
    recommendations.push("Ruxsat API qo'llab-quvvatlanmaydi. Brauzer sozlamalaridan GPS ni yoqing.");
  }
  
  return {
    isSupported,
    hasPermission,
    isHTTPS,
    browserInfo,
    recommendations
  };
}

// Get current location
export function getCurrentLocation(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    console.log("GPS tekshirilmoqda...");
    
    if (!navigator.geolocation) {
      console.error("Geolocation qo'llab-quvvatlanmaydi");
      reject(new Error("Geolocation qo'llab-quvvatlanmaydi"));
      return;
    }

    console.log("Geolocation mavjud, ruxsatlar tekshirilmoqda...");

    // First try with high accuracy, if timeout then try with lower accuracy
    const tryHighAccuracy = () => {
      console.log("Yuqori aniqlik bilan urinish...");
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("GPS muvaffaqiyatli aniqlandi:", position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          console.error("Yuqori aniqlik xatosi:", error);
          // If high accuracy fails, try with lower accuracy
          if (error.code === error.TIMEOUT) {
            console.log("Timeout, past aniqlik bilan urinish...");
            tryLowAccuracy();
          } else {
            handleGeolocationError(error, reject);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000, // Increased from 10000
          maximumAge: 0,
        }
      );
    };

    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          handleGeolocationError(error, reject);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000, // Increased from 8000
          maximumAge: 30000, // Allow cached location
        }
      );
    };

    const handleGeolocationError = (error: GeolocationPositionError, rejectFn: (reason: Error) => void) => {
      switch (error.code) {
        case error.PERMISSION_DENIED:
          rejectFn(new Error("Joylashuv ruxsati berilmadi. Iltimos, brauzer sozlamalaridan GPS ruxsatini bering."));
          break;
        case error.POSITION_UNAVAILABLE:
          rejectFn(new Error("Joylashuvni aniqlab bo'lmadi. Internet aloqasini tekshiring."));
          break;
        case error.TIMEOUT:
          rejectFn(new Error("Joylashuvni aniqlash vaqti tugadi. Qayta urinib ko'ring."));
          break;
        default:
          rejectFn(new Error("Noma'lum xatolik: " + error.message));
      }
    };

    // Start with high accuracy attempt
    tryHighAccuracy();
  });
}

// Detect suspicious GPS indicators - only for students, teachers are exempt
export async function detectSuspiciousGPS(
  level: FakeDetectionLevel = 'medium',
  teacherRadius?: number,
  pinValiditySeconds?: number,
  userRole?: 'student' | 'teacher' | 'admin'
): Promise<{ isSuspicious: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  let isSuspicious = false;
  
  // Teachers and admins are exempt from GPS checks
  if (userRole === 'teacher' || userRole === 'admin') {
    return { isSuspicious: false, reasons: [] };
  }
  
  // Only apply detection to students
  const thresholds = getDetectionThresholds(level);
  
  // Adjust thresholds based on teacher settings
  const adjustedThresholds = {
    ...thresholds,
    // If teacher set large radius, be more lenient with GPS
    varianceThreshold: teacherRadius && teacherRadius > 200 
      ? thresholds.varianceThreshold * 10 
      : thresholds.varianceThreshold,
    // If PIN validity is short, be more lenient with timing
    timestampThreshold: pinValiditySeconds && pinValiditySeconds < 60
      ? thresholds.timestampThreshold / 2
      : thresholds.timestampThreshold
  };

  try {
    // Check if running in emulator (basic check)
    const userAgent = navigator.userAgent.toLowerCase();
    if (
      userAgent.includes("sdk") ||
      userAgent.includes("emulator") ||
      userAgent.includes("simulator")
    ) {
      isSuspicious = true;
      reasons.push("Emulator/Simulator aniqlandi");
    }

    // Get location reading for each lesson check-in
    const location = await getCurrentLocation();
    
    // Only check for OBVIOUS fake indicators, not browser quirks
    
    // Check for impossible GPS values (not browser quirks)
    if (location.accuracy === 0) {
      // Perfect 0 accuracy is impossible in real GPS
      isSuspicious = true;
      reasons.push("Mumkin bo'lmagan GPS aniqligi (0 metr)");
    }
    
    // Check for extremely high accuracy that suggests mock location
    if (location.accuracy < 0.1) {
      // Less than 10cm accuracy is impossible for browser GPS
      isSuspicious = true;
      reasons.push("Mumkin bo'lmagan yuqori aniqlik");
    }
    
    // Check for location spoofing apps behavior
    // Mock locations often have exactly the same coordinates
    const readings = await Promise.all([
      getCurrentLocation(),
      getCurrentLocation()
    ]);
    
    // If coordinates are EXACTLY the same to many decimal places, it's likely fake
    const latDiff = Math.abs(readings[0].latitude - readings[1].latitude);
    const lonDiff = Math.abs(readings[0].longitude - readings[1].longitude);
    
    if (latDiff < 0.0000001 && lonDiff < 0.0000001) {
      // Real GPS has some variation, exact same coordinates suggest mock location
      isSuspicious = true;
      reasons.push("GPS ko'rsatkichlari sun'iy ravishda bir xil");
    }
    
    // Require MULTIPLE indicators before marking as suspicious
    if (reasons.length < 2) {
      // Single indicator is not enough for suspicious flag
      isSuspicious = false;
      reasons = [];
    }

  } catch (error) {
    reasons.push("GPS tekshiruvida xatolik");
  }

  return { isSuspicious, reasons };
}

// Check if location is within radius with configurable fake detection
export async function checkLocationWithinRadius(
  targetLat: number,
  targetLon: number,
  radiusMeters: number,
  detectionLevel: FakeDetectionLevel = 'medium'
): Promise<LocationCheckResult> {
  const suspiciousReasons: string[] = [];
  
  try {
    // Get current location
    const location = await getCurrentLocation();
    
    // Check for suspicious GPS with specified level
    const suspiciousCheck = await detectSuspiciousGPS(detectionLevel);
    
    // Calculate distance
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      targetLat,
      targetLon
    );

    const isWithinRadius = distance <= radiusMeters;

    if (!isWithinRadius) {
      suspiciousReasons.push(`Darsdan ${Math.round(distance)}m uzoqda`);
    }

    return {
      isWithinRadius,
      distance,
      isFakeGPS: suspiciousCheck.isSuspicious,
      suspiciousReasons: [...suspiciousReasons, ...suspiciousCheck.reasons],
    };
  } catch (error) {
    return {
      isWithinRadius: false,
      distance: -1,
      isFakeGPS: false,
      suspiciousReasons: [error instanceof Error ? error.message : "Noma'lum xatolik"],
    };
  }
}
