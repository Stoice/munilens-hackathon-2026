/**
 * Validates geographic coordinates to ensure they are safe for map rendering
 */

export interface ValidatedCoordinate {
  latitude: number;
  longitude: number;
  isValid: boolean;
  reason?: string;
}

/**
 * Check if a coordinate value is valid (not NaN, not infinite, within range)
 */
function isValidNumber(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Validate latitude (-90 to 90)
 */
export function isValidLatitude(lat: any): boolean {
  if (!isValidNumber(lat)) return false;
  const num = Number(lat);
  return num >= -90 && num <= 90;
}

/**
 * Validate longitude (-180 to 180)
 */
export function isValidLongitude(lng: any): boolean {
  if (!isValidNumber(lng)) return false;
  const num = Number(lng);
  return num >= -180 && num <= 180;
}

/**
 * Validate a complete coordinate pair
 */
export function validateCoordinates(
  latitude: any,
  longitude: any
): ValidatedCoordinate {
  // Check if values exist
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return {
      latitude: 0,
      longitude: 0,
      isValid: false,
      reason: 'Missing latitude or longitude'
    };
  }

  // Check latitude
  if (!isValidLatitude(latitude)) {
    return {
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      isValid: false,
      reason: `Invalid latitude: ${latitude} (must be between -90 and 90)`
    };
  }

  // Check longitude
  if (!isValidLongitude(longitude)) {
    return {
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      isValid: false,
      reason: `Invalid longitude: ${longitude} (must be between -180 and 180)`
    };
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
    isValid: true
  };
}

/**
 * Calculate center point and check if any valid coordinates exist
 */
export function calculateBounds(
  coordinates: Array<{ latitude: number; longitude: number }>
): {
  isValid: boolean;
  centerLat: number;
  centerLng: number;
  validCount: number;
} {
  const validCoords = coordinates.filter(coord => 
    isValidLatitude(coord.latitude) && isValidLongitude(coord.longitude)
  );

  if (validCoords.length === 0) {
    return {
      isValid: false,
      centerLat: -26.2041, // Johannesburg default
      centerLng: 28.0473,
      validCount: 0
    };
  }

  const avgLat = validCoords.reduce((sum, c) => sum + c.latitude, 0) / validCoords.length;
  const avgLng = validCoords.reduce((sum, c) => sum + c.longitude, 0) / validCoords.length;

  return {
    isValid: true,
    centerLat: avgLat,
    centerLng: avgLng,
    validCount: validCoords.length
  };
}

/**
 * Filter reports to only those with valid coordinates
 */
export function filterValidReports<T extends { latitude: any; longitude: any }>(
  reports: T[]
): { validReports: T[]; invalidReports: T[]; stats: { total: number; valid: number; invalid: number } } {
  const validReports: T[] = [];
  const invalidReports: T[] = [];

  reports.forEach(report => {
    const validation = validateCoordinates(report.latitude, report.longitude);
    if (validation.isValid) {
      validReports.push(report);
    } else {
      invalidReports.push(report);
    }
  });

  return {
    validReports,
    invalidReports,
    stats: {
      total: reports.length,
      valid: validReports.length,
      invalid: invalidReports.length
    }
  };
}
