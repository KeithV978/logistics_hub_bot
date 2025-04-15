const axios = require('axios');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Find riders near a pickup location
 * @param {number} latitude - Pickup latitude
 * @param {number} longitude - Pickup longitude
 * @param {number} radius - Initial search radius in km
 * @param {number} maxRadius - Maximum search radius in km
 * @param {number} increment - Increment for radius expansion in km
 * @return {Array} Array of nearby riders
 */
async function findNearbyRiders(latitude, longitude, radius = 3, maxRadius = 12, increment = 3) {
  try {
    let riders = [];
    let currentRadius = radius;
    
    while (currentRadius <= maxRadius && riders.length === 0) {
      // Use PostgreSQL's earthdistance extension or manual calculation
      // This is a simplified calculation for demo purposes
      const result = await pool.query(
        `SELECT telegram_id, full_name, rating, 
         (6371 * acos(cos(radians($1)) * cos(radians(last_latitude)) * 
         cos(radians(last_longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(last_latitude)))) AS distance
         FROM riders
         WHERE is_verified = TRUE
         HAVING (6371 * acos(cos(radians($1)) * cos(radians(last_latitude)) * 
         cos(radians(last_longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(last_latitude)))) < $3
         ORDER BY distance`,
        [latitude, longitude, currentRadius]
      );
      
      riders = result.rows;
      
      // If no riders found, expand the radius
      if (riders.length === 0) {
        currentRadius += increment;
      }
    }
    
    return { riders, radius: currentRadius };
  } catch (error) {
    console.error('Error finding nearby riders:', error);
    return { riders: [], radius: 0 };
  }
}

/**
 * Find erranders near an errand location
 * @param {number} latitude - Errand latitude
 * @param {number} longitude - Errand longitude
 * @param {number} radius - Initial search radius in km
 * @param {number} maxRadius - Maximum search radius in km
 * @param {number} increment - Increment for radius expansion in km
 * @return {Array} Array of nearby erranders
 */
async function findNearbyErranders(latitude, longitude, radius = 2, maxRadius = 6, increment = 1) {
  try {
    let erranders = [];
    let currentRadius = radius;
    
    while (currentRadius <= maxRadius && erranders.length === 0) {
      // Use PostgreSQL's earthdistance extension or manual calculation
      // This is a simplified calculation for demo purposes
      const result = await pool.query(
        `SELECT telegram_id, full_name, rating, 
         (6371 * acos(cos(radians($1)) * cos(radians(last_latitude)) * 
         cos(radians(last_longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(last_latitude)))) AS distance
         FROM erranders
         WHERE is_verified = TRUE
         HAVING (6371 * acos(cos(radians($1)) * cos(radians(last_latitude)) * 
         cos(radians(last_longitude) - radians($2)) + 
         sin(radians($1)) * sin(radians(last_latitude)))) < $3
         ORDER BY distance`,
        [latitude, longitude, currentRadius]
      );
      
      erranders = result.rows;
      
      // If no erranders found, expand the radius
      if (erranders.length === 0) {
        currentRadius += increment;
      }
    }
    
    return { erranders, radius: currentRadius };
  } catch (error) {
    console.error('Error finding nearby erranders:', error);
    return { erranders: [], radius: 0 };
  }
}

/**
 * Create a private group for customer and provider communication
 * @param {Object} bot - Telegraf bot instance
 * @param {number} customerId - Customer's Telegram ID
 * @param {number} providerId - Provider's (rider or errander) Telegram ID
 * @param {string} title - Group title
 * @return {Object|null} Created group info or null on failure
 */
async function createPrivateGroup(bot, customerId, providerId, title) {
  try {
    // Create a new group
    const chat = await bot.telegram.createNewSupergroup(title, `Private communication group for ${title}`);
    
    // Add the customer and provider to the group
    await bot.telegram.addChatMember(chat.id, customerId);
    await bot.telegram.addChatMember(chat.id, providerId);
    
    // Make the group private
    await bot.telegram.setChatPermissions(chat.id, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: false,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false
    });
    
    return chat;
  } catch (error) {
    console.error('Error creating private group:', error);
    return null;
  }
}

/**
 * Validate if a location is within service area
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @return {boolean} True if location is valid
 */
async function validateLocation(latitude, longitude) {
  try {
    // This is a placeholder - in a real application, you might check if the
    // location is within your service area using a geofencing API
    return true;
  } catch (error) {
    console.error('Error validating location:', error);
    return false;
  }
}

/**
 * Calculate distance between two points
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @return {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

/**
 * Verify NIN using external API
 * @param {string} nin - National Identification Number
 * @return {Object} Verification result
 */
async function verifyNIN(nin) {
  try {
    // This is a placeholder - in a real application, you would call an actual NIN verification API
    // const response = await axios.post('https://nin-verification-api.example.com', { nin });
    // return response.data;
    
    // For demo purposes, we'll simulate a successful verification
    return {
      success: true,
      verified: true,
      message: 'NIN verified successfully',
      data: {
        name: 'John Doe',
        nin: nin,
        verified: true
      }
    };
  } catch (error) {
    console.error('Error verifying NIN:', error);
    return {
      success: false,
      verified: false,
      message: 'Failed to verify NIN. Please try again later.',
      error: error.message
    };
  }
}

/**
 * Update provider's last known location
 * @param {string} providerType - 'rider' or 'errander'
 * @param {number} providerId - Provider's Telegram ID
 * @param {number} latitude - Current latitude
 * @param {number} longitude - Current longitude
 */
async function updateProviderLocation(providerType, providerId, latitude, longitude) {
  try {
    if (providerType === 'rider') {
      await pool.query(
        'UPDATE riders SET last_latitude = $1, last_longitude = $2, updated_at = NOW() WHERE telegram_id = $3',
        [latitude, longitude, providerId]
      );
    } else {
      await pool.query(
        'UPDATE erranders SET last_latitude = $1, last_longitude = $2, updated_at = NOW() WHERE telegram_id = $3',
        [latitude, longitude, providerId]
      );
    }
  } catch (error) {
    console.error('Error updating provider location:', error);
  }
}

module.exports = {
  findNearbyRiders,
  findNearbyErranders,
  createPrivateGroup,
  validateLocation,
  calculateDistance,
  verifyNIN,
  updateProviderLocation
};