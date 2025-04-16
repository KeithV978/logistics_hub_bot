module.exports = {
    STATUS: {
      PENDING: 'pending',
      OFFERED: 'offered',
      ACCEPTED: 'accepted',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      CANCELED: 'canceled'
    },
    ROLES: {
      CUSTOMER: 'customer',
      RIDER: 'rider',
      ERRANDER: 'errander'
    },
    DISTANCE_THRESHOLDS: {
      RIDER_INITIAL_RADIUS: 3,
      RIDER_MAX_RADIUS: 12,
      ERRANDER_INITIAL_RADIUS: 2,
      ERRANDER_MAX_RADIUS: 6
    },
    SESSION_DURATION: 10 * 60 * 1000,
    TELEGRAM_COMMANDS: {
      CREATE_ORDER: '/create_order',
      CREATE_ERRAND: '/create_errand',
      REGISTER: '/register',
      OFFER: '/offer',
      ACCEPT_OFFER: '/accept_offer',
      DELIVERY_SUCCESSFUL: '/delivery_successful',
      PAYMENT_RECEIVED: '/payment_received'
    }
  };