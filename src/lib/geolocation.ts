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

// Get current location
export function getCurrentLocation(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation qo'llab-quvvatlanmaydi"));
      return;
    }

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
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("Joylashuv ruxsati berilmadi"));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("Joylashuvni aniqlab bo'lmadi"));
            break;
          case error.TIMEOUT:
            reject(new Error("Joylashuvni aniqlash vaqti tugadi"));
            break;
          default:
            reject(new Error("Noma'lum xatolik"));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

// Detect fake GPS indicators
export async function detectFakeGPS(): Promise<{ isFake: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  let isFake = false;

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
    if (avgAccuracy < 1) {
      isFake = true;
      reasons.push("GPS aniqlik darajasi shubhali (juda aniq)");
    }

    // Check for location spoofing apps behavior
    // Mock locations often have exactly 0 accuracy or very high accuracy
    if (avgAccuracy === 0 || avgAccuracy > 1000) {
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

    if (latVariance < 0.000001 && lonVariance < 0.000001) {
      isFake = true;
      reasons.push("GPS ko'rsatkichlari sun'iy ravishda barqaror");
    }

    // Check timestamp consistency
    const timestampGaps = readings.slice(1).map((reading, i) => 
      reading.timestamp - readings[i].timestamp
    );
    const avgGap = timestampGaps.reduce((sum, gap) => sum + gap, 0) / timestampGaps.length;
    
    if (avgGap < 100) {
      isFake = true;
      reasons.push("GPS o'lchovlari juda tez (mumkin emas)");
    }

  } catch (error) {
    reasons.push("GPS tekshiruvida xatolik");
  }

  return { isFake, reasons };
}

// Check if location is within radius
export async function checkLocationWithinRadius(
  targetLat: number,
  targetLon: number,
  radiusMeters: number
): Promise<LocationCheckResult> {
  const suspiciousReasons: string[] = [];
  
  try {
    // Get current location
    const location = await getCurrentLocation();
    
    // Check for fake GPS
    const fakeCheck = await detectFakeGPS();
    
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
