import { bot } from "../config";
import Order from '../Models/order.model.js';
import Rider from '../Models/rider.model.js';

const acceptOrder = async (orderId, riderId) => {
    try {
        // Verify rider status
        const rider = await Rider.findOne({ 
            telegramId: riderId,
            isVerified: true,
            isAvailable: true
        });

        if (!rider) {
            throw new Error('Unauthorized rider or rider unavailable');
        }

        // Find and update order
        const order = await Order.findOneAndUpdate(
            { 
                orderId: orderId,
                status: 'pending'
            },
            {
                status: 'assigned',
                riderId: rider._id
            },
            { new: true }
        );

        if (!order) {
            throw new Error('Order not found or already assigned');
        }

        // Notify customer
        await bot.sendMessage(order.customersId, 
            `✅ Your order ${orderId} has been accepted by a rider!\n` +
            `They will pick up your package shortly.`
        );

        // Update rider status
        await Rider.findByIdAndUpdate(rider._id, { isAvailable: false });

        return true;
    } catch (error) {
        console.error('Error accepting order:', error);
        return false;
    }
};

export default acceptOrder;
