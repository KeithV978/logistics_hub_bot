const NodeGeocoder = require('node-geocoder');
const config = require('../config/config');
const { logger } = require('../utils/logger');

const geocoder = NodeGeocoder({
  provider: config.GEOCODER_PROVIDER,
  apiKey: config.GEOCODER_API_KEY,
  formatter: null
});

class GeolocationService {
  /**
   * Calculate distance between two points in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  static toRad(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * Validate and geocode a location string
   */
  static async geocodeLocation(locationString) {
    try {
      const results = await geocoder.geocode(locationString);
      if (!results || results.length === 0) {
        throw new Error('Location not found');
      }
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
        formattedAddress: results[0].formattedAddress
      };
    } catch (error) {
      logger.error('Geocoding error:', { locationString, error: error.message });
      throw new Error('Failed to geocode location');
    }
  }

  /**
   * Find workers within radius
   */
  static async findWorkersInRadius(centerLocation, userLocations, radius) {
    const workersInRange = [];
    
    for (const worker of userLocations) {
      const distance = this.calculateDistance(
        centerLocation.latitude,
        centerLocation.longitude,
        worker.latitude,
        worker.longitude
      );
      
      if (distance <= radius) {
        workersInRange.push({
          ...worker,
          distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
        });
      }
    }
    
    return workersInRange.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Validate coordinates
   */
  static validateCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Parse location data from Telegram message
   */
  static parseLocationData(msg) {
    if (msg.location) {
      return {
        latitude: msg.location.latitude,
        longitude: msg.location.longitude,
        type: 'coordinates'
      };
    }
    
    if (msg.venue) {
      return {
        latitude: msg.venue.location.latitude,
        longitude: msg.venue.location.longitude,
        address: msg.venue.address,
        title: msg.venue.title,
        type: 'venue'
      };
    }
    
    if (msg.text) {
      return {
        address: msg.text,
        type: 'text'
      };
    }
    
    return null;
  }
}

module.exports = GeolocationService;