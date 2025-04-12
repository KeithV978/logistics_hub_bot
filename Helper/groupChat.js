const { bot } = require("../config");

async function createDeliveryGroup(order, riderId, customerId) {
    try {
        // Create group chat
        const groupTitle = `Delivery-${order.orderId}`;
        const group = await bot.createChatInviteLink(groupTitle);
        
        // Add bot as admin
        const botInfo = await bot.getMe();
        await bot.promoteChatMember(group.chat.id, botInfo.id, {
            can_manage_chat: true,
            can_delete_messages: true,
            can_manage_video_chats: true,
            can_restrict_members: true,
            can_promote_members: true,
            can_invite_users: true
        });

        // Add members
        await bot.promoteChatMember(group.chat.id, riderId, {
            can_delete_messages: false,
            can_invite_users: false
        });
        await bot.promoteChatMember(group.chat.id, customerId, {
            can_delete_messages: false,
            can_invite_users: false
        });

        // Send welcome message with available commands
        await bot.sendMessage(group.chat.id, 
            `🤝 Welcome to the delivery group chat!\n\n` +
            `📦 Order: #${order.orderId}\n` +
            `📍 Pickup: ${order.pickup}\n` +
            `🎯 Dropoff: ${order.dropoff}\n\n` +
            `Available commands:\n` +
            `🚫 /cancel - Cancel the order (customer only)\n` +
            `✅ /complete - Mark delivery as complete (rider only)\n` +
            `❓ /status - Check current order status\n\n` +
            `This group will be automatically deleted once delivery is completed.`
        );

        return group.chat.id;
    } catch (error) {
        console.error('Error creating group chat:', error);
        throw error;
    }
}

module.exports = { createDeliveryGroup };
