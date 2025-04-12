const { bot } = require("../config");
const { default: notifyRiders } = require("../Helper/notifyRiders");
const { createDeliveryGroup } = require("../Helper/groupChat");

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome to LogisticsHub Bot!\n- Customers: Use /order to place a delivery request.\n- Riders: Use /register to sign up and /available to see open orders."
  );
});

// Handle /order command for customers
bot.onText(/\/order/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Please provide pickup and drop-off locations in this format:\nPickup: [address]\nDropoff: [address] (Case sensitive)\n\nExample:\nPickup: 123 Main St\nDropoff: 456 Elm St",
    { reply_markup: { force_reply: true } }
  );
});

// Handle customer order details (pickup and drop-off)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Check if the message is a reply to an order request
  if (
    msg.reply_to_message &&
    msg.reply_to_message.text.includes(
      "Please provide pickup and drop-off locations"
    )
  ) {
    const lines = text.split("\n");
    const pickup = lines
      .find((line) => line.startsWith("Pickup:"))
      ?.replace("Pickup:", "")
      .trim();
    const dropoff = lines
      .find((line) => line.startsWith("Dropoff:"))
      ?.replace("Dropoff:", "")
      .trim();

    if (pickup && dropoff) {
      const order = {
        orderId: 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5),
        customerId: chatId,
        pickup,
        dropoff,
        status: "pending",
        riderId: null,
      };
      await db.collection('Order').insertOne(order);
      bot.sendMessage(
        chatId,
        `Order #${order.orderId} placed!\nPickup: ${pickup}\nDropoff: ${dropoff}\nWaiting for a rider...`
      );
      notifyRiders(chatId, order);
    } else {
      bot.sendMessage(
        chatId,
        "Invalid format. Case sensitive. Please use:\nPickup: [address]\nDropoff: [address]"
      );
    }
  }
});

// Handle /register command for riders
bot.onText(/\/register/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const existingRider = await db.collection('Rider').findOne({ riderId: chatId });
    
    if (existingRider) {
        bot.sendMessage(chatId, "You are already registered as a rider!");
    } else {
        await db.collection('Rider').insertOne({ riderId: chatId });
        await bot.sendMessage(chatId, 
            "Please provide your details in this format:\n\n" +
            "Name: [first name] [last name]\n" +
            "Phone: [phone number]\n" +
            "Bank Name: [bank name]\n" +
            "Account Number: [account number]\n" +
            "Account Name: [account name]", +
            "Please note that this bank details must be an active one:" + {
            reply_markup: { force_reply: true }
        });

        // Add a message handler for rider registration details
        bot.on("message", async (msg) => {
            if (msg.reply_to_message?.text?.includes("Please provide your details")) {
                const lines = msg.text.split("\n");
                const fullName = lines.find(line => line.startsWith("Name:"))?.replace("Name:", "").trim().split(" ");
                const phone = lines.find(line => line.startsWith("Phone:"))?.replace("Phone:", "").trim();
                const bankName = lines.find(line => line.startsWith("Bank Name:"))?.replace("Bank Name:", "").trim();
                const accountNumber = lines.find(line => line.startsWith("Account Number:"))?.replace("Account Number:", "").trim();
                const accountName = lines.find(line => line.startsWith("Account Name:"))?.replace("Account Name:", "").trim();
                
                if (fullName?.length >= 2 && phone && bankName && accountNumber && accountName) {
                    await db.collection('Rider').updateOne(
                        { riderId: msg.chat.id },
                        { 
                            $set: { 
                                legalName: {
                                    firstName: fullName[0],
                                    lastName: fullName[1]
                                },
                                phoneNumber: phone,
                                bankDetails: {
                                    bankName,
                                    accountNumber,
                                    accountName
                                },
                                isVerified: false,
                                isAvailable: true
                            } 
                        }
                    );
                    bot.sendMessage(chatId, "Registration successful! Your details will be verified shortly.");
                } else {
                    bot.sendMessage(chatId, "Please provide all required information in the correct format.");
                }
            }
        });
    }
  } catch (error) {
    console.error('Error registering rider:', error);
    bot.sendMessage(chatId, "Sorry, there was an error registering you. Please try again.");
  }
});

// Handle /available command for riders
bot.onText(/\/available/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const rider = await db.collection('Rider').findOne({ 
      riderId: chatId,
      isVerified: true 
    });

    if (!rider) {
      bot.sendMessage(chatId, "You must be a verified rider to see available orders. Please /register first or wait for verification if you already registered.");
      return;
    }

    const openOrders = await db.collection('Order').find({ status: "pending" }).toArray();
    if (openOrders.length === 0) {
      bot.sendMessage(chatId, "No open delivery requests at the moment.");
    } else {
      openOrders.forEach((order) => {
        bot.sendMessage(
          chatId, 
          `
          🔔 New Delivery Request!
          
          📦 Order ID: ${order.orderId}
          📍 Pickup: ${order.pickup}
          🎯 Dropoff: ${order.dropoff}
          
          Reply with /accept_${order.orderId} to take this order.`
        );
      });
    }
  } catch (error) {
    console.error('Error fetching available orders:', error);
    bot.sendMessage(chatId, "Sorry, there was an error fetching available orders. Please try again.");
  }
});

// Handle /accept command for riders
bot.onText(/\/accept_(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const orderId = match[1];

  try {
    const rider = await db.collection('Rider').findOne({ 
      riderId: chatId,
       
    });

    if (!rider) {
      bot.sendMessage(chatId, "You are not a registered rider. Please register to continue.");
      return;
    }
    if (rider.isVerified === false) {
      bot.sendMessage(chatId, "You must be a verified rider to accept orders. Please wait for your verification to be completed.");
      return;
    }
    if (rider.isAvailable === false) {
      bot.sendMessage(chatId, "You must complete your delivery before taking another one.");
      return;
    }

    const order = await db.collection('Order').findOneAndUpdate(
      { orderId: orderId, status: "pending" },
      { 
        $set: { 
          status: "in-progress",
          riderId: chatId
        } 
      },
      { new: true }
    );

    if (!order.value) {
      bot.sendMessage(chatId, "The order not found or is already taken.");
      return;
    }

    try {
      // Create temporary group chat
      const groupId = await createDeliveryGroup(order.value, chatId, order.value.customerId);
      
      // Store group chat ID with order
      await db.collection('Order').updateOne(
        { orderId: orderId },
        { $set: { groupChatId: groupId } }
      );

      // Send notifications
      bot.sendMessage(
        chatId,
        `✅ Order #${orderId} accepted!\n` +
        `You've been added to a temporary group chat with the customer.`
      );
      
      bot.sendMessage(
        order.value.customerId,
        `🎉 Order #${orderId} accepted!\n` +
        `You've been added to a temporary group chat with the rider.`
      );

    } catch (error) {
      console.error('Error setting up group chat:', error);
      // Continue with regular notifications if group creation fails
      // bot.sendMessage(
      //   chatId,
      //   `✅ You've accepted order #${orderId}!\n📍 Pickup: ${order.value.pickup}\n🎯 Dropoff: ${order.value.dropoff}`
      // );
      
      // bot.sendMessage(
      //   order.value.customerId,
      //   `🎉 Order #${orderId} has been accepted by a rider!\nThey will pick up your package shortly.`
      // );
    }

  } catch (error) {
    console.error('Error accepting order:', error);
    bot.sendMessage(chatId, "Sorry, there was an error accepting the order. Please try again.");
  }
});

// Handle /cancel command for customers
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    // Check if this is a group chat
    const order = await db.collection('Order').findOne({ 
      groupChatId: chatId,
      status: 'in-progress'
    });

    if (!order) {
      bot.sendMessage(chatId, "This command can only be used in an active delivery group chat.");
      return;
    }

    // Verify the user is the customer
    if (order.customerId !== userId) {
      bot.sendMessage(chatId, "Only the customer can cancel the order.");
      return;
    }

    // Update order status
    await db.collection('Order').updateOne(
      { orderId: order.orderId },
      { $set: { status: 'cancelled' } }
    );

    // Update rider availability
    await db.collection('Rider').updateOne(
      { riderId: order.riderId },
      { $set: { isAvailable: true } }
    );

    // Notify both parties in group
    await bot.sendMessage(chatId, 
      `❌ Order #${order.orderId} has been cancelled by the customer.\n` +
      `This group chat will be deleted in 1 minute.`
    );

    // Schedule group deletion
    setTimeout(async () => {
      try {
        await bot.deleteChat(chatId);
      } catch (error) {
        console.error('Error deleting group chat:', error);
      }
    }, 60000); // 1 minute delay

  } catch (error) {
    console.error('Error cancelling order:', error);
    bot.sendMessage(chatId, "Sorry, there was an error cancelling the order. Please try again.");
  }
});

// Log bot startup
console.log("DeliveryBot is running...");

// Handle polling errors
bot.on("polling_error", (error) => {
  console.error(`Polling error: ${error.message}`);
});
