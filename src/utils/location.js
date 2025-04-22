/**
 * Location utility functions for calculating distances and handling coordinates
 */

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Converts degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const radLat1 = degreesToRadians(lat1);
  const radLat2 = degreesToRadians(lat2);

  // Haversine formula
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Calculate distance
  return EARTH_RADIUS_KM * c;
}

/**
 * Checks if a point is within a given radius of another point
 * @param {Object} point1 - First point with latitude and longitude
 * @param {Object} point2 - Second point with latitude and longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if point2 is within radius of point1
 */
function isWithinRadius(point1, point2, radiusKm) {
  if (!point1?.latitude || !point1?.longitude || !point2?.latitude || !point2?.longitude) {
    return false;
  }

  const distance = calculateDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );

  return distance <= radiusKm;
}

/**
 * Finds all points within a radius of a center point
 * @param {Object} centerPoint - Center point with latitude and longitude
 * @param {Array<Object>} points - Array of points with latitude and longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array<Object>} Array of points within the radius
 */
function findPointsWithinRadius(centerPoint, points, radiusKm) {
  return points.filter(point => isWithinRadius(centerPoint, point, radiusKm));
}

/**
 * Validates a location object
 * @param {Object} location - Location object to validate
 * @returns {boolean} True if location is valid
 */
function isValidLocation(location) {
  if (!location) return false;

  // Check for coordinate-based location
  if (typeof location.latitude === 'number' && 
      typeof location.longitude === 'number' &&
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180) {
    return true;
  }

  // Check for address-based location
  if (typeof location.address === 'string' && location.address.trim().length > 0) {
    return true;
  }

  return false;
}

/**
 * Formats a location object into a human-readable string
 * @param {Object} location - Location object with coordinates or address
 * @returns {string} Formatted location string
 */
function formatLocation(location) {
  if (!location) return 'Unknown location';

  if (location.address) {
    return location.address;
  }

  if (location.latitude && location.longitude) {
    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  return 'Invalid location format';
}

module.exports = {
  calculateDistance,
  isWithinRadius,
  findPointsWithinRadius,
  isValidLocation,
  formatLocation,
  EARTH_RADIUS_KM
}; 