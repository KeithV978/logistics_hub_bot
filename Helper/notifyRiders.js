import { bot } from "../config"
import Rider from '../Models/rider.model.js'

const notifyRiders = async (chatId, order) => {
    try {
        // Fetch all verified riders
        const verifiedRiders = await Rider.find({ 
            isVerified: true,
            isAvailable: true 
        }).select('riderId');

        if (!verifiedRiders.length) {
            bot.sendMessage( chatId,  'No riders available' ); 
            return false;
        }

        const message = `
🔔 New Delivery Request!

📦 Order ID: ${order.orderId}
📍 Pickup: ${order.pickup}
🎯 Dropoff: ${order.dropoff}

Reply with /accept_${order.orderId} to take this order.`;

        const notifications = verifiedRiders.map(rider => 
            bot.sendMessage(rider.telegramId, message)
        );

        await Promise.all(notifications).then(() => {
            bot.sendMessage(chatId, 'Riders have been notified about the new delivery request.');
            console.log('Notifications sent to riders');
        }
        ).catch(err => {
            console.error('Error sending notifications:', err);
        });
        return true;
    } catch (error) {
        console.error('Error notifying riders:', error);
        return false;
    }
}

export default notifyRiders;
