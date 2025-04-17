/**
 * Google Maps API client for geolocation services with caching and batch distance calculation
 */
const axios = require('axios');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const { APIFailureError } = require('../utils/error-handler');
const db = require('../database');

// Initialize in-memory cache
const cache = new NodeCache({
  stdTTL: 3600, // Default TTL: 1 hour for geocoding
  checkperiod: 120, // Check for expired keys every 2 minutes
});

// Cache TTL constants (in seconds)
const CACHE_TTL_GEOCODING = 3600; // 1 hour
const CACHE_TTL_DISTANCE = 600; // 10 minutes

/**
 * Generate cache key for geocoding and reverse geocoding
 * @param {string} type - 'geocode' or 'reverse_geocode'
 * @param {Object|string} input - Address or { lat, lng }
 * @returns {string} - Cache key
 */
const generateCacheKey = (type, input) => {
  if (type === 'geocode') {
    return `geocode:${input.toLowerCase().replace(/\s+/g, '')}`;
  } else if (type === 'reverse_geocode') {
    return `reverse_geocode:${input.lat}:${input.lng}`;
  } else if (type === 'distance') {
    return `distance:${input.origins.map(o => `${o.lat}:${o.lng}`).join('|')}:${input.destinations.map(d => `${d.lat}:${d.lng}`).join('|')}`;
  }
  return '';
};

/**
 * Get coordinates from an address using Google Maps Geocoding API
 * @param {string} address - Address to geocode
 * @returns {Object} - { lat: number, lng: number, address: string }
 */
const getCoordinates = async (address) => {
  const cacheKey = generateCacheKey('geocode', address);
  
  // Check cache
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    logger.info('Geocoding cache hit', { address, cacheKey });
    return cachedResult;
  }

  try {
    const apiKey = process.env.GEOLOCATION_API_KEY;
    if (!apiKey) {
      throw new APIFailureError('Google Maps API key not configured');
    }

    logger.info('Initiating address geocoding', { address });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: apiKey,
        },
        timeout: 5000, // 5 seconds timeout
      }
    );

    if (response.data.status !== 'OK' || !response.data.results.length) {
      throw new APIFailureError('No results found for the provided address');
    }

    const { lat, lng } = response.data.results[0].geometry.location;
    const formattedAddress = response.data.results[0].formatted_address;
    const result = { lat, lng, address: formattedAddress };

    logger.info('Geocoding successful', { address, lat, lng, formattedAddress });

    // Store in cache
    cache.set(cacheKey, result, CACHE_TTL_GEOCODING);
    return result;
  } catch (error) {
    logger.error(`Geocoding failed: ${error.message}`, {
      address,
      status: error.response?.status,
      response: error.response?.data,
    });

    // Retry logic for transient errors (e.g., 429, 503)
    if (error.response?.status === 429 || error.response?.status === 503) {
      logger.info('Retrying geocoding due to transient error');
      try {
        const retryResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/geocode/json',
          {
            params: {
              address,
              key: process.env.GEOLOCATION_API_KEY,
            },
            timeout: 5000,
          }
        );
        if (retryResponse.data.status !== 'OK' || !retryResponse.data.results.length) {
          throw new APIFailureError('No results found on retry');
        }
        const { lat, lng } = retryResponse.data.results[0].geometry.location;
        const formattedAddress = retryResponse.data.results[0].formatted_address;
        const result = { lat, lng, address: formattedAddress };
        logger.info('Geocoding retry successful', { address, lat, lng, formattedAddress });
        cache.set(cacheKey, result, CACHE_TTL_GEOCODING);
        return result;
      } catch (retryError) {
        logger.error(`Geocoding retry failed: ${retryError.message}`, { address });
        throw new APIFailureError('Geocoding failed after retry');
      }
    }

    throw new APIFailureError('Google Maps Geocoding service unavailable');
  }
};

/**
 * Get address from coordinates using Google Maps Geocoding API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - Formatted address
 */
const getAddressFromCoordinates = async (lat, lng) => {
  const cacheKey = generateCacheKey('reverse_geocode', { lat, lng });
  
  // Check cache
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    logger.info('Reverse geocoding cache hit', { lat, lng, cacheKey });
    return cachedResult;
  }

  try {
    const apiKey = process.env.GEOLOCATION_API_KEY;
    if (!apiKey) {
      throw new APIFailureError('Google Maps API key not configured');
    }

    logger.info('Initiating reverse geocoding', { lat, lng });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${lat},${lng}`,
          key: apiKey,
        },
        timeout: 5000,
      }
    );

    if (response.data.status !== 'OK' || !response.data.results.length) {
      throw new APIFailureError('No address found for the provided coordinates');
    }

    const formattedAddress = response.data.results[0].formatted_address;
    logger.info('Reverse geocoding successful', { lat, lng, address: formattedAddress });

    // Store in cache
    cache.set(cacheKey, formattedAddress, CACHE_TTL_GEOCODING);
    return formattedAddress;
  } catch (error) {
    logger.error(`Reverse geocoding failed: ${error.message}`, {
      lat,
      lng,
      status: error.response?.status,
      response: error.response?.data,
    });

    // Retry logic for transient errors
    if (error.response?.status === 429 || error.response?.status === 503) {
      logger.info('Retrying reverse geocoding due to transient error');
      try {
        const retryResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/geocode/json',
          {
            params: {
              latlng: `${lat},${lng}`,
              key: process.env.GEOLOCATION_API_KEY,
            },
            timeout: 5000,
          }
        );
        if (retryResponse.data.status !== 'OK' || !retryResponse.data.results.length) {
          throw new APIFailureError('No address found on retry');
        }
        const formattedAddress = retryResponse.data.results[0].formatted_address;
        logger.info('Reverse geocoding retry successful', { lat, lng, address: formattedAddress });
        cache.set(cacheKey, formattedAddress, CACHE_TTL_GEOCODING);
        return formattedAddress;
      } catch (retryError) {
        logger.error(`Reverse geocoding retry failed: ${retryError.message}`, { lat, lng });
        throw new APIFailureError('Reverse geocoding failed after retry');
      }
    }

    throw new APIFailureError('Google Maps Geocoding service unavailable');
  }
};

/**
 * Calculate distance between location pairs using Google Maps Distance Matrix API
 * @param {Object|Array} origins - Single { lat, lng } or array of { lat, lng }
 * @param {Object|Array} destinations - Single { lat, lng } or array of { lat, lng }
 * @returns {number|Array} - Distance in kilometers (single number or array of distances)
 */
const calculateDistance = async (origins, destinations) => {
  // Normalize inputs to arrays for batch processing
  const originArray = Array.isArray(origins) ? origins : [origins];
  const destinationArray = Array.isArray(destinations) ? destinations : [destinations];

  const cacheKey = generateCacheKey('distance', { origins: originArray, destinations: destinationArray });
  
  // Check cache
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    logger.info('Distance calculation cache hit', { cacheKey });
    return Array.isArray(origins) || Array.isArray(destinations) ? cachedResult : cachedResult[0];
  }

  try {
    const apiKey = process.env.GEOLOCATION_API_KEY;
    if (!apiKey) {
      throw new APIFailureError('Google Maps API key not configured');
    }

    logger.info('Initiating distance calculation', {
      origins: originArray.map(o => ({ lat: o.lat, lng: o.lng })),
      destinations: destinationArray.map(d => ({ lat: d.lat, lng: d.lng })),
    });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: {
          origins: originArray.map(o => `${o.lat},${o.lng}`).join('|'),
          destinations: destinationArray.map(d => `${d.lat},${d.lng}`).join('|'),
          key: apiKey,
          units: 'metric',
        },
        timeout: 5000,
      }
    );

    if (response.data.status !== 'OK' || !response.data.rows.length) {
      throw new APIFailureError('Unable to calculate distance');
    }

    // Process response to extract distances
    const distances = response.data.rows.map((row, i) =>
      row.elements.map((element, j) => {
        if (element.status !== 'OK' || !element.distance) {
          logger.warn('Distance calculation failed for pair', {
            origin: originArray[i],
            destination: destinationArray[j],
          });
          return null; // Return null for failed pairs
        }
        return element.distance.value / 1000; // Convert meters to kilometers
      })
    );

    // Flatten distances for single origin/destination case
    const result = originArray.length === 1 && destinationArray.length === 1
      ? distances[0][0]
      : distances.flat().filter(d => d !== null);

    logger.info('Distance calculation successful', {
      distances: result,
    });

    // Store in cache
    cache.set(cacheKey, result, CACHE_TTL_DISTANCE);
    return Array.isArray(origins) || Array.isArray(destinations) ? result : result[0];
  } catch (error) {
    logger.error(`Distance calculation failed: ${error.message}`, {
      origins: originArray,
      destinations: destinationArray,
      status: error.response?.status,
      response: error.response?.data,
    });

    // Retry logic for transient errors
    if (error.response?.status === 429 || error.response?.status === 503) {
      logger.info('Retrying distance calculation due to transient error');
      try {
        const retryResponse = await axios.get(
          'https://maps.googleapis.com/maps/api/distancematrix/json',
          {
            params: {
              origins: originArray.map(o => `${o.lat},${o.lng}`).join('|'),
              destinations: destinationArray.map(d => `${d.lat},${d.lng}`).join('|'),
              key: process.env.GEOLOCATION_API_KEY,
              units: 'metric',
            },
            timeout: 5000,
          }
        );
        if (retryResponse.data.status !== 'OK' || !retryResponse.data.rows.length) {
          throw new APIFailureError('Unable to calculate distance on retry');
        }
        const distances = retryResponse.data.rows.map((row, i) =>
          row.elements.map((element, j) => {
            if (element.status !== 'OK' || !element.distance) {
              logger.warn('Distance calculation failed for pair on retry', {
                origin: originArray[i],
                destination: destinationArray[j],
              });
              return null;
            }
            return element.distance.value / 1000;
          })
        );
        const result = originArray.length === 1 && destinationArray.length === 1
          ? distances[0][0]
          : distances.flat().filter(d => d !== null);
        logger.info('Distance calculation retry successful', { distances: result });
        cache.set(cacheKey, result, CACHE_TTL_DISTANCE);
        return Array.isArray(origins) || Array.isArray(destinations) ? result : result[0];
      } catch (retryError) {
        logger.error(`Distance calculation retry failed: ${retryError.message}`, {
          origins: originArray,
          destinations: destinationArray,
        });
        throw new APIFailureError('Distance calculation failed after retry');
      }
    }

    throw new APIFailureError('Google Maps Distance Matrix service unavailable');
  }
};

/**
 * Find users within a radius using Google Maps API and database
 * @param {Object} location - { lat: number, lng: number }
 * @param {number} radius - Radius in kilometers
 * @param {string} role - User role (e.g., 'rider', 'errander')
 * @returns {Array} - List of users within radius
 */
const findUsersWithinRadius = async (location, radius, role) => {
  try {
    logger.info('Finding users within radius', { location, radius, role });

    const users = await db.users.find({ role, isVerified: true });
    const userLocations = users
      .filter(user => user.lastKnownLocation)
      .map(user => ({
        user,
        location: user.lastKnownLocation,
      }));

    if (!userLocations.length) {
      logger.info('No users with location data found', { role });
      return [];
    }

    // Batch calculate distances
    const distances = await calculateDistance(
      [location],
      userLocations.map(ul => ul.location)
    );

    const nearbyUsers = userLocations
      .filter((_, index) => distances[index] !== null && distances[index] <= radius)
      .map(ul => ul.user);

    logger.info('Users within radius found', { count: nearbyUsers.length });
    return nearbyUsers;
  } catch (error) {
    logger.error(`Failed to find users within radius: ${error.message}`, {
      location,
      radius,
      role,
    });
    throw new APIFailureError('Google Maps service or database unavailable');
  }
};

module.exports = {
  getCoordinates,
  getAddressFromCoordinates,
  calculateDistance,
  findUsersWithinRadius,
};