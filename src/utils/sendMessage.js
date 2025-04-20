// Helper function to delete previous message and send new one
async function sendMessage(ctx, text, extra = {}) {
    try {
      // Delete previous bot message if exists
      if (ctx.session?.lastBotMessageId) {
        await ctx.deleteMessage(ctx.session.lastBotMessageId).catch(() => {});
      }
      // Send new message and store its ID
      const message = await ctx.reply(text, extra);
      ctx.session.lastBotMessageId = message.message_id;
      return message;
    } catch (error) {
      console.error('Error in sendMessage:', error);
    }
  }

  module.exports = {
    sendMessage
  }