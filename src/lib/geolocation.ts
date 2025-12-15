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

// Get detection thresholds based on level
export function getDetectionThresholds(level: FakeDetectionLevel): DetectionThresholds {
  switch (level) {
    case 'minimal':
      return {
        accuracyThreshold: 0.05,     // Very precise detection
        maxAccuracy: 10000,          // Allow higher accuracy
        varianceThreshold: 0.000000001, // Very stable detection
        timestampThreshold: 10       // Very fast detection
      };
    case 'medium':
      return {
        accuracyThreshold: 0.1,      // More relaxed
        maxAccuracy: 5000,           // Allow higher accuracy
        varianceThreshold: 0.00000001, // More relaxed
        timestampThreshold: 25       // More relaxed
      };
    case 'maximal':
      return {
        accuracyThreshold: 1.0,      // Much less strict
        maxAccuracy: 3000,           // Moderate max accuracy
        varianceThreshold: 0.000001,  // Much less strict
        timestampThreshold: 50       // Much more relaxed
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

// Detect fake GPS indicators with configurable sensitivity
export async function detectFakeGPS(level: FakeDetectionLevel = 'medium'): Promise<{ isFake: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  let isFake = false;
  const thresholds = getDetectionThresholds(level);

  try {
    // Check if running in emulator (basic check)
    const userAgent = navigator.userAgent.toLowerCase();
    if (
      userAgent.includes("sdk") ||
      userAgent.includes("emulator") ||
      userAgent.includes("simulator")
    ) {
      isFake = true;
      reasons.push("Emulyator aniqlandi");
    }

    // Check for mock location apps (Android)
    if ("permissions" in navigator) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (result.state === "denied") {
          reasons.push("GPS ruxsati yo'q");
        }
      } catch {
        // Permission API not fully supported
      }
    }

    // Get multiple location readings for accuracy validation
    const readings = await Promise.all([
      getCurrentLocation(),
      getCurrentLocation(),
      getCurrentLocation()
    ]);

    // Check for suspicious accuracy (too perfect = likely fake)
    const avgAccuracy = readings.reduce((sum, r) => sum + r.accuracy, 0) / readings.length;
    if (avgAccuracy < thresholds.accuracyThreshold) {
      isFake = true;
      reasons.push("GPS aniqlik darajasi shubhali (juda aniq)");
    }

    // Check for location spoofing apps behavior
    // Mock locations often have exactly 0 accuracy or very high accuracy
    if (avgAccuracy === 0 || avgAccuracy > thresholds.maxAccuracy) {
      isFake = true;
      reasons.push("GPS aniqlik darajasi noto'g'ri");
    }

    // Check for location consistency
    const latVariance = readings.reduce((sum, r) => {
      const mean = readings.reduce((s, reading) => s + reading.latitude, 0) / readings.length;
      return sum + Math.pow(r.latitude - mean, 2);
    }, 0) / readings.length;
    
    const lonVariance = readings.reduce((sum, r) => {
      const mean = readings.reduce((s, reading) => s + reading.longitude, 0) / readings.length;
      return sum + Math.pow(r.longitude - mean, 2);
    }, 0) / readings.length;

    if (latVariance < thresholds.varianceThreshold && lonVariance < thresholds.varianceThreshold) {
      isFake = true;
      reasons.push("GPS ko'rsatkichlari sun'iy ravishda barqaror");
    }

    // Check timestamp consistency - use configurable threshold
    // Real GPS readings can be very fast on modern devices, especially with cached locations
    const timestampGaps = readings.slice(1).map((reading, i) => 
      reading.timestamp - readings[i].timestamp
    );
    const avgGap = timestampGaps.reduce((sum, gap) => sum + gap, 0) / timestampGaps.length;
    
    if (avgGap < thresholds.timestampThreshold) {
      isFake = true;
      reasons.push("GPS o'lchovlari notekis (juda tez)");
    }

  } catch (error) {
    reasons.push("GPS tekshiruvida xatolik");
  }

  return { isFake, reasons };
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
    
    // Check for fake GPS with specified level
    const fakeCheck = await detectFakeGPS(detectionLevel);
    
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
      isFakeGPS: fakeCheck.isFake,
      suspiciousReasons: [...suspiciousReasons, ...fakeCheck.reasons],
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
