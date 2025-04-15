const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command('start', (ctx) => ctx.reply('Hello World'));

bot.launch({
  webhook: {
    domain: process.env.WEBHOOK_DOMAIN,
    hookPath: process.env.WEBHOOK_PATH,
    port: 3000
  }
}).then(() => {
  console.log('Bot started with webhook');
}).catch((err) => {
  console.error('Error starting bot:', err);
});