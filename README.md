# RiderFinder Telegram Bot

A Telegram bot that connects riders and erranders with customers for logistics and errand services.

## Features

- User registration (Riders and Erranders)
- User verification system
- Order creation and management
- Real-time location tracking
- Rating and review system
- Secure payment integration
- Group chat creation for orders

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- A domain with SSL certificate for webhook

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rider_finder.git
cd rider_finder
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBHOOK_URL=https://your-domain.com/webhook
WEBHOOK_SECRET=your_webhook_secret_here

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rider_finder
DB_USER=postgres
DB_PASSWORD=your_password_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

4. Create the PostgreSQL database:
```bash
createdb rider_finder
```

5. Start the server:
```bash
npm start
```

## Development

To start the server in development mode with auto-reload:
```bash
npm run dev
```

## Project Structure

```
rider_finder/
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

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please contact [your-email@example.com](mailto:your-email@example.com) 