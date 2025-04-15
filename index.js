const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();

// Replace 'YOUR_BOT_TOKEN' with the token from BotFather
const bot = new Telegraf(process.env.BOT_TOKEN);

// Define the webhook path and secret token
const secretPath = '/secret-path'; // Customize this path
const secretToken = 'your-secret-token'; // Customize this token

console.log("heree")
// Set up Telegraf to handle webhook updates at the specified path
app.use(bot.webhookCallback(secretPath, { secretToken }));

// Define bot commands
bot.start((ctx) => ctx.reply('Welcome to the bot!'));
bot.help((ctx) => ctx.reply('Send me any message.'));

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});