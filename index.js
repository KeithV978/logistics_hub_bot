const { Telegraf } = require('telegraf');

const bot = new Telegraf('YOUR_BOT_TOKEN_HERE');

bot.command('start', (ctx) => ctx.reply('Hello World'));

bot.launch({
  webhook: {
    domain: 'https://your-server.com',
    hookPath: '/secret-path',
    port: 3000
  }
}).then(() => {
  console.log('Bot started with webhook');
}).catch((err) => {
  console.error('Error starting bot:', err);
});