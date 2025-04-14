require('dotenv').config();

const config = {
  telegram: {
    token: process.env.BOT_TOKEN,
    webhookDomain: process.env.WEBHOOK_DOMAIN,
    webhookPath: process.env.WEBHOOK_PATH || '/webhook',
    adminChatId: process.env.ADMIN_CHAT_ID
  },
  server: {
    port: process.env.PORT || 3000
  },
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  },
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    encryptionKey: process.env.ENCRYPTION_KEY
  },
  geolocation: {
    defaultSearchRadius: parseInt(process.env.DEFAULT_SEARCH_RADIUS) || 5000
  }
};

module.exports = config;