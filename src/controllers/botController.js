const userService = require('../services/userService');
const orderService = require('../services/orderService');
const errandService = require('../services/errandService');
const trackingService = require('../services/trackingService');
const { calculateDistance, validateLocation } = require('../utils/helpers');

module.exports = (bot) => {
    // Start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Welcome to the Logistics Bot! Use /register to sign up as a rider or errander, or /create_order to place an order.');
    });

    // Register command
    bot.onText(/\/register/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Please provide your full name, phone number, bank details, NIN, and a photo.');
        // Store user in pending state
        await userService.startRegistration(chatId);
    });

    // Handle registration data
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const user = await userService.getUser(chatId);
        if (user && user.verification_status === 'pending' && !msg.text.startsWith('/')) {
            if (msg.text) {
                await userService.updateRegistration(chatId, { full_name: msg.text });
                bot.sendMessage(chatId, 'Name received. Please send your phone number.');
            } else if (msg.contact) {
                await userService.updateRegistration(chatId, { phone: msg.contact.phone_number });
                bot.sendMessage(chatId, 'Phone received. Please send your bank details (e.g., {"bank": "Bank Name", "account": "1234567890"}).');
            } else if (msg.text && msg.text.includes('bank')) {
                await userService.updateRegistration(chatId, { bank_details: JSON.parse(msg.text) });
                bot.sendMessage(chatId, 'Bank details received. Please send your NIN.');
            } else if (msg.text && msg.text.match(/^\d+$/)) {
                await userService.updateRegistration(chatId, { nin: msg.text });
                bot.sendMessage(chatId, 'NIN received. Please send a photo.');
            } else if (msg.photo) {
                await userService.updateRegistration(chatId, { photo_url: msg.photo[msg.photo.length - 1].file_id });
                await userService.verifyUser(chatId);
                bot.sendMessage(chatId, 'Registration complete! Awaiting verification.');
            }
        }
    });

    // Create order
    bot.onText(/\/create_order/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Please send the pickup location (text or share location).');
        await orderService.startOrderCreation(chatId);
    });

    // Handle order inputs
    bot.on('location', async (msg) => {
        const chatId = msg.chat.id;
        const order = await orderService.getPendingOrder(chatId);
        if (order && !order.pickup_location) {
            await orderService.updateOrder(chatId, { pickup_location: msg.location });
            bot.sendMessage(chatId, 'Pickup location received. Please send the drop-off location.');
        } else if (order && order.pickup_location && !order.dropoff_location) {
            await orderService.updateOrder(chatId, { dropoff_location: msg.location });
            bot.sendMessage(chatId, 'Drop-off location received. Please provide any delivery instructions.');
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const order = await orderService.getPendingOrder(chatId);
        if (order && order.pickup_location && order.dropoff_location && !msg.text.startsWith('/') && !msg.location) {
            await orderService.updateOrder(chatId, { instructions: msg.text });
            const riders = await orderService.notifyRiders(order);
            bot.sendMessage(chatId, `${riders.length} riders found. Please wait for offers.`);
        }
    });

    // Create errand
    bot.onText(/\/create_errand/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Please send the errand location (text or share location).');
        await errandService.startErrandCreation(chatId);
    });

    // Handle errand inputs
    bot.on('location', async (msg) => {
        const chatId = msg.chat.id;
        const errand = await errandService.getPendingErrand(chatId);
        if (errand && !errand.location) {
            await errandService.updateErrand(chatId, { location: msg.location });
            bot.sendMessage(chatId, 'Errand location received. Please provide errand details.');
        }
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const errand = await errandService.getPendingErrand(chatId);
        if (errand && errand.location && !msg.text.startsWith('/') && !msg.location) {
            await errandService.updateErrand(chatId, { details: msg.text });
            const erranders = await errandService.notifyErranders(errand);
            bot.sendMessage(chatId, `${erranders.length} erranders found. Please wait for offers.`);
        }
    });

    // Make offer
    bot.onText(/\/make_offer (\d+) (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const [_, orderId, price] = match;
        try {
            const offer = await orderService.makeOffer(chatId, orderId, parseFloat(price));
            bot.sendMessage(chatId, 'Offer submitted.');
            const customerId = offer.order.customer_id;
            const user = await userService.getUser(chatId);
            bot.sendMessage(customerId, `New offer from ${user.full_name}: $${price}, Rating: ${user.rating}`);
        } catch (error) {
            bot.sendMessage(chatId, 'Error submitting offer: ' + error.message);
        }
    });

    // Accept offer
    bot.onText(/\/accept_offer (\d+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const [_, offerId] = match;
        try {
            const { order, rider } = await orderService.acceptOffer(offerId);
            const group = await bot.createChatInviteLink({ creates_join_request: false });
            await bot.sendMessage(chatId, `Offer accepted. Join group: ${group.invite_link}`);
            await bot.sendMessage(rider.telegram_id, `Your offer was accepted. Join group: ${group.invite_link}`);
            await bot.sendMessage(group.chat.id, 'Rules of Engagement: Be respectful, share updates.');
            bot.sendMessage(rider.telegram_id, 'Please start sharing your live location with /start_tracking.');
        } catch (error) {
            bot.sendMessage(chatId, 'Error accepting offer: ' + error.message);
        }
    });

    // Start tracking
    bot.onText(/\/start_tracking/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 'Please share your live location.');
    });

    // Handle live location
    bot.on('location', async (msg) => {
        if (msg.live_period) {
            const chatId = msg.chat.id;
            await trackingService.updateLocation(chatId, msg.location);
            const session = await trackingService.getActiveSession(chatId);
            if (session) {
                const customerId = session.order ? session.order.customer_id : session.errand.customer_id;
                bot.sendMessage(customerId, 'Rider/Errander location updated.', {
                    reply_markup: {
                        inline_keyboard: [[{ text: 'View Location', url: `https://t.me/${chatId}` }]],
                    },
                });
            }
        }
    });

    // Payment received
    bot.onText(/\/payment_received/, async (msg) => {
        const chatId = msg.chat.id;
        await trackingService.stopTracking(chatId);
        bot.sendMessage(chatId, 'Payment confirmed. Waiting for customer to confirm delivery.');
    });

    // Delivery successful
    bot.onText(/\/delivery_successful/, async (msg) => {
        const chatId = msg.chat.id;
        const session = await trackingService.getActiveSession(chatId);
        if (session) {
            await orderService.completeOrder(session.order_id);
            bot.sendMessage(chatId, 'Transaction complete. Please rate the rider/errander with /rate [1-5] [review text].');
            // Delete group (simplified for example)
            bot.sendMessage(session.group_id, 'Transaction complete. Group will be deleted.');
        }
    });

    // Rate
    bot.onText(/\/rate (\d) (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const [_, rating, reviewText] = match;
        try {
            await userService.rateUser(chatId, parseInt(rating), reviewText);
            bot.sendMessage(chatId, 'Rating submitted. Thank you!');
        } catch (error) {
            bot.sendMessage(chatId, 'Error submitting rating: ' + error.message);
        }
    });
};