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

    // Check for suspicious accuracy (too perfect = likely fake)
    const location = await getCurrentLocation();
    if (location.accuracy < 1) {
      isFake = true;
      reasons.push("GPS aniqlik darajasi shubhali (juda aniq)");
    }

    // Check for location spoofing apps behavior
    // Mock locations often have exactly 0 accuracy or very high accuracy
    if (location.accuracy === 0 || location.accuracy > 1000) {
      isFake = true;
      reasons.push("GPS aniqlik darajasi noto'g'ri");
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
