const config = require('../config/config');
const logger = require('../utils/logger');
const db = require('../config/database');

class GroupManager {
  /**
   * Create a private group for an order/errand
   */
  static async createOrderGroup(bot, order, worker) {
    try {
      // Create private group
      const chat = await bot.telegram.createPrivateGroup(
        `Order_${order.id}`,
        [order.customer_telegram_id, worker.telegram_id]
      );

      // Set bot as admin
      await bot.telegram.promoteChatMember(chat.id, bot.botInfo.id, {
        can_manage_chat: true,
        can_delete_messages: true,
        can_manage_video_chats: true,
        can_restrict_members: true,
        can_promote_members: false,
        can_change_info: true,
        can_invite_users: true
      });

      // Send welcome message and rules
      await bot.telegram.sendMessage(chat.id, config.messages.groupRules);

      // Enable location sharing in group
      await bot.telegram.sendMessage(chat.id, 'Location sharing has been enabled for this group.');

      // Update order with group chat id
      await db.query(
        'UPDATE orders SET group_chat_id = $1 WHERE id = $2',
        [chat.id, order.id]
      );

      return chat;
    } catch (error) {
      logger.error('Create order group error:', { orderId: order.id, error: error.message });
      throw error;
    }
  }

  /**
   * Handle live location updates in group
   */
  static async handleLocationUpdate(bot, msg) {
    try {
      const order = await db.query(
        'SELECT * FROM orders WHERE group_chat_id = $1',
        [msg.chat.id]
      );

      if (!order.rows.length) {
        return;
      }

      // Update tracking session
      await db.query(
        `UPDATE tracking_sessions 
         SET current_location = $1,
             last_update = CURRENT_TIMESTAMP
         WHERE order_id = $2`,
        [
          {
            latitude: msg.location.latitude,
            longitude: msg.location.longitude,
            timestamp: msg.date
          },
          order.rows[0].id
        ]
      );

      // Check if location updates are too infrequent
      const lastUpdate = new Date(order.rows[0].last_update);
      const now = new Date();
      const timeDiff = (now - lastUpdate) / 1000 / 60; // Convert to minutes

      if (timeDiff > config.TRACKING_UPDATE_TIMEOUT) {
        await bot.telegram.sendMessage(
          msg.chat.id,
          'Location updates are infrequent. Please ensure stable sharing.'
        );
      }
    } catch (error) {
      logger.error('Handle location update error:', { 
        chatId: msg.chat.id, 
        error: error.message 
      });
    }
  }

  /**
   * Clean up group after transaction completion
   */
  static async cleanupGroup(bot, orderId) {
    try {
      const order = await db.query(
        'SELECT group_chat_id FROM orders WHERE id = $1',
        [orderId]
      );

      if (!order.rows.length || !order.rows[0].group_chat_id) {
        return;
      }

      const chatId = order.rows[0].group_chat_id;

      // Get chat members
      const members = await bot.telegram.getChatAdministrators(chatId);

      // Remove all members except bot
      for (const member of members) {
        if (member.user.id !== bot.botInfo.id) {
          await bot.telegram.banChatMember(chatId, member.user.id);
          await bot.telegram.unbanChatMember(chatId, member.user.id);
        }
      }

      // Delete group
      await bot.telegram.deleteChat(chatId);

      // Update order
      await db.query(
        'UPDATE orders SET group_chat_id = NULL WHERE id = $1',
        [orderId]
      );
    } catch (error) {
      logger.error('Cleanup group error:', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Start tracking session
   */
  static async startTracking(orderId, userId) {
    try {
      await db.query(
        `INSERT INTO tracking_sessions (order_id, user_id)
         VALUES ($1, $2)`,
        [orderId, userId]
      );
    } catch (error) {
      logger.error('Start tracking error:', { orderId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Stop tracking session
   */
  static async stopTracking(orderId) {
    try {
      await db.query(
        `UPDATE tracking_sessions 
         SET status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [orderId]
      );
    } catch (error) {
      logger.error('Stop tracking error:', { orderId, error: error.message });
      throw error;
    }
  }
}

module.exports = GroupManager;