const NodeGeocoder = require('node-geocoder');
const config = require('../config/config');
const { logger } = require('../utils/logger');

const geocoder = NodeGeocoder({
  provider: config.GEOCODER_PROVIDER,
  apiKey: config.GEOCODER_API_KEY,
  formatter: null,
  httpAdapter: 'https'
});

class GeolocationService {
  /**
   * Calculate distance between two points in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    try {
      if (!this.validateCoordinates(lat1, lon1) || !this.validateCoordinates(lat2, lon2)) {
        throw new Error('Invalid coordinates provided');
      }

      const R = 6371; // Earth's radius in kilometers
      const dLat = this.toRad(lat2 - lat1);
      const dLon = this.toRad(lon2 - lon1);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    } catch (error) {
      logger.error('Calculate distance error:', {
        lat1, lon1, lat2, lon2,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Convert degrees to radians
   */
  static toRad(degrees) {
    if (typeof degrees !== 'number') {
      throw new Error('Degrees must be a number');
    }
    return degrees * Math.PI / 180;
  }

  /**
   * Validate and geocode a location string with retries
   */
  static async geocodeLocation(locationString) {
    if (!locationString || typeof locationString !== 'string') {
      throw new Error('Invalid location string');
    }

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const results = await geocoder.geocode(locationString);
        if (!results || results.length === 0) {
          throw new Error('Location not found');
        }

        const result = results[0];
        if (!this.validateCoordinates(result.latitude, result.longitude)) {
          throw new Error('Invalid coordinates returned from geocoding service');
        }

        return {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
          city: result.city,
          country: result.country,
          extra: {
            confidence: result.extra?.confidence,
            resultType: result.extra?.resultType
          }
        };
      } catch (error) {
        if (attempt === maxRetries - 1) {
          logger.error('Geocoding error:', { locationString, error: error.message });
          throw new Error('Failed to geocode location');
        }
        
        // Wait with exponential backoff before retrying
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  /**
   * Find workers within radius with spatial index
   */
  static async findWorkersInRadius(centerLocation, userLocations, radius) {
    try {
      if (!this.validateCoordinates(centerLocation.latitude, centerLocation.longitude)) {
        throw new Error('Invalid center coordinates');
      }

      if (!Array.isArray(userLocations)) {
        throw new Error('userLocations must be an array');
      }

      if (typeof radius !== 'number' || radius <= 0) {
        throw new Error('radius must be a positive number');
      }

      const workersInRange = [];
      
      for (const worker of userLocations) {
        if (!this.validateCoordinates(worker.latitude, worker.longitude)) {
          logger.warn('Invalid worker coordinates:', { workerId: worker.id });
          continue;
        }

        try {
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
        } catch (error) {
          logger.error('Distance calculation error:', {
            workerId: worker.id,
            error: error.message
          });
          continue;
        }
      }
      
      return workersInRange.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      logger.error('Find workers in radius error:', {
        center: centerLocation,
        radius,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate coordinates
   */
  static validateCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Parse location data from Telegram message with validation
   */
  static parseLocationData(msg) {
    try {
      if (!msg) {
        throw new Error('Message object is required');
      }

      if (msg.location) {
        const { latitude, longitude } = msg.location;
        if (!this.validateCoordinates(latitude, longitude)) {
          throw new Error('Invalid coordinates in location');
        }

        return {
          latitude,
          longitude,
          type: 'coordinates'
        };
      }
      
      if (msg.venue) {
        const { latitude, longitude } = msg.venue.location;
        if (!this.validateCoordinates(latitude, longitude)) {
          throw new Error('Invalid coordinates in venue');
        }

        return {
          latitude,
          longitude,
          address: msg.venue.address,
          title: msg.venue.title,
          type: 'venue'
        };
      }
      
      if (msg.text) {
        if (typeof msg.text !== 'string' || msg.text.trim().length === 0) {
          throw new Error('Invalid text location');
        }

        return {
          address: msg.text.trim(),
          type: 'text'
        };
      }
      
      throw new Error('No valid location data found in message');
    } catch (error) {
      logger.error('Parse location data error:', {
        msgType: msg ? Object.keys(msg).join(',') : 'null',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates
   */
  static async reverseGeocode(latitude, longitude) {
    if (!this.validateCoordinates(latitude, longitude)) {
      throw new Error('Invalid coordinates for reverse geocoding');
    }

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const results = await geocoder.reverse({ lat: latitude, lon: longitude });
        if (!results || results.length === 0) {
          throw new Error('No results found');
        }

        return {
          formattedAddress: results[0].formattedAddress,
          city: results[0].city,
          country: results[0].country,
          extra: results[0].extra
        };
      } catch (error) {
        if (attempt === maxRetries - 1) {
          logger.error('Reverse geocoding error:', {
            latitude,
            longitude,
            error: error.message
          });
          throw new Error('Failed to reverse geocode location');
        }
        
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, attempt))
        );
      }
    }
  }
}

module.exports = GeolocationService;