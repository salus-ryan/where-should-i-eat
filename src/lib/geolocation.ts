export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 0, message: 'Geolocation is not supported by this browser' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let message = 'Unknown error';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable location access.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out.';
            break;
        }
        reject({ code: error.code, message });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Estimate walking time in minutes (avg 5 km/h)
 */
export function estimateWalkTime(distanceKm: number): number {
  const walkSpeedKmH = 5;
  return Math.round((distanceKm / walkSpeedKmH) * 60);
}

/**
 * Estimate driving time in minutes (avg 25 km/h in urban areas)
 */
export function estimateDriveTime(distanceKm: number): number {
  const driveSpeedKmH = 25;
  return Math.round((distanceKm / driveSpeedKmH) * 60);
}

/**
 * Legacy function - returns drive time for backwards compatibility
 */
export function estimateTravelTime(distanceKm: number): number {
  return estimateDriveTime(distanceKm);
}

/**
 * Convert coordinates to a readable address string (reverse geocoding)
 * Uses Nominatim (OpenStreetMap) - free, no API key needed
 */
export async function reverseGeocode(coords: Coordinates): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
      {
        headers: {
          'User-Agent': 'WhereShoudIEat/1.0',
        },
      }
    );
    const data = await response.json();
    
    // Return neighborhood/city level location
    const parts = [];
    if (data.address?.neighbourhood) parts.push(data.address.neighbourhood);
    else if (data.address?.suburb) parts.push(data.address.suburb);
    if (data.address?.city) parts.push(data.address.city);
    else if (data.address?.town) parts.push(data.address.town);
    if (data.address?.state) parts.push(data.address.state);
    
    return parts.length > 0 ? parts.join(', ') : 'your location';
  } catch {
    return 'your location';
  }
}
