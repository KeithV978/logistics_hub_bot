require('dotenv').config();

module.exports = {
  // Bot and Server Configuration
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  SERVER_URL: process.env.SERVER_URL,
  PORT: process.env.PORT || 3000,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,

  // Search Radius Configuration (in kilometers)
  RIDER_INITIAL_RADIUS: 3,
  RIDER_MAX_RADIUS: 12,
  RIDER_RADIUS_INCREMENT: 3,
  ERRANDER_INITIAL_RADIUS: 2,
  ERRANDER_MAX_RADIUS: 6,
  ERRANDER_RADIUS_INCREMENT: 1,

  // Timeouts (in minutes)
  ORDER_EXPIRY: 15,
  OFFER_EXPIRY: 10,
  TRANSACTION_EXPIRY: 24 * 60, // 24 hours
  TRACKING_UPDATE_TIMEOUT: 5,

  // NIN Verification
  NIN_API_KEY: process.env.NIN_API_KEY,
  NIN_API_URL: process.env.NIN_API_URL,
  NIN_API_MAX_RETRIES: 3,

  // Geocoding
  GEOCODER_PROVIDER: process.env.GEOCODER_PROVIDER,
  GEOCODER_API_KEY: process.env.GEOCODER_API_KEY,

  // File Upload Limits
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB

  // Rating System
  MIN_RATING: 1,
  MAX_RATING: 5,

  // Regex Patterns
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/, // International phone number format
  PRICE_REGEX: /^\d+(\.\d{1,2})?$/, // Price format (e.g., 10 or 10.99)

  // Message Templates
  messages: {
    welcome: "Welcome to the Logistics Hub! 🚚\nI can help you with deliveries and errands.",
    registerStart: "Let's get you registered! Please provide your full name.",
    invalidPhone: "Invalid phone number format. Please enter a valid phone number (e.g., +1234567890).",
    verificationPending: "Your account is pending verification. We'll notify you once verified.",
    orderCreated: "Order created successfully! Looking for available workers...",
    noWorkersFound: "Sorry, no workers found in your area at the moment. Please try again later.",
    offerReceived: "New offer received! Use /view_offers to see all available offers.",
    orderAccepted: "Great! Your order has been accepted. A private group will be created for communication.",
    trackingStarted: "Live tracking has started! You can view the location in the private group.",
    transactionCompleted: "Transaction completed! Please rate your experience from 1-5 stars.",
    groupRules: `Welcome to the order group! 📦\n\nRules:\n1. Be respectful\n2. Share updates\n3. Report issues to admin\n\nHave a great experience! 🤝`
  }
};