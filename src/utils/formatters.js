module.exports = {
    formatLocation: (location) => {
      if (!location) return 'Unknown location';
      return `${location.address || 'No address'} (Lat: ${location.lat}, Lng: ${location.lng})`;
    },
    formatOffer: (offer) => {
      return `Offer: Price - $${offer.price}, Rating - ${offer.rating}/5${offer.vehicleType ? `, Vehicle - ${offer.vehicleType}` : ''}`;
    },
    formatErrorMessage: (error) => {
      return `Error: ${error.message || 'An error occurred. Please try again.'}`;
    },
    formatUserNotification: (message, data = {}) => {
      return {
        text: message,
        parse_mode: 'HTML',
        ...data
      };
    }
  };