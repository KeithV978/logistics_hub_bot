# Logistics Hub

A Telegram bot that connects riders and erranders with customers for logistics and errand services.

## Features

- User registration (riders and erranders)
- NIN verification
- Location-based order matching
- Real-time order tracking
- Rating system
- Secure payment integration
- Group chat creation for orders

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12
- Redis >= 6
- Telegram Bot Token (from @BotFather)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Node environment
NODE_ENV=development
PORT=3000

# Database
DB_NAME=logistics_hub
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
WEBHOOK_URL=https://your-domain.com
WEBHOOK_SECRET=your_webhook_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/logistics-hub.git
cd logistics-hub
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
createdb logistics_hub
```

4. Start the development server:
```bash
npm run dev
```

## Production Deployment

1. Set the environment variables for production
2. Build and start the application:
```bash
npm start
```

## Bot Commands

- `/start` - Start the bot
- `/help` - Show help message
- `/register_rider` - Register as a rider
- `/register_errander` - Register as an errander
- `/profile` - View your profile
- `/create_order` - Create a new logistics order
- `/create_errand` - Create a new errand order
- `/my_orders` - View your orders
- `/my_offers` - View your offers
- `/toggle_active` - Toggle your active status

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Project Structure

```
logistics-hub/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── telegram.js
│   ├── controllers/
│   │   └── botController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Order.js
│   │   ├── Offer.js
│   │   ├── Review.js
│   │   └── index.js
│   ├── services/
│   ├── utils/
│   ├── middlewares/
│   └── index.js
├── .env
├── .gitignore
├── package.json
└── README.md
```

## Support

For support, please contact [your-email@example.com](mailto:your-email@example.com) 