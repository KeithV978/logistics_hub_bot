const { Composer } = require('telegraf');
const { ValidationError } = require('../middlewares/errorHandler');
const { query } = require('../database/connection');
const Joi = require('joi');

const registration = new Composer();

// Registration validation schema
const registrationSchema = Joi.object({
    userType: Joi.string().valid('rider', 'errander').required(),
    fullName: Joi.string().min(3).max(255).required(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    bankAccountNumber: Joi.string().min(8).max(255).required(),
    bankName: Joi.string().required()
});

// Registration session middleware
registration.use((ctx, next) => {
    ctx.session = ctx.session || {};
    ctx.session.registration = ctx.session.registration || {};
    return next();
});

// Start registration command
registration.command('register', async (ctx) => {
    try {
        // Check if user is already registered
        const existingUser = await query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [ctx.from.id]
        );

        if (existingUser.rows.length > 0) {
            throw new ValidationError('You are already registered.');
        }

        // Clear any existing registration session
        ctx.session.registration = {};
        
        // Ask user type
        return ctx.reply(
            'What would you like to register as?',
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🚗 Rider', callback_data: 'register_rider' },
                            { text: '🏃 Errander', callback_data: 'register_errander' }
                        ]
                    ]
                }
            }
        );
    } catch (error) {
        throw error;
    }
});

// Handle user type selection
registration.action(/^register_(rider|errander)$/, async (ctx) => {
    try {
        const userType = ctx.match[1];
        ctx.session.registration.userType = userType;
        
        await ctx.editMessageText(
            'Please enter your full name:',
            { reply_markup: { remove_keyboard: true } }
        );
        
        ctx.session.registration.step = 'fullName';
    } catch (error) {
        throw error;
    }
});

// Handle text input for registration steps
registration.on('text', async (ctx) => {
    try {
        if (!ctx.session.registration || !ctx.session.registration.step) {
            return;
        }

        const step = ctx.session.registration.step;
        const input = ctx.message.text;

        switch (step) {
            case 'fullName':
                ctx.session.registration.fullName = input;
                ctx.session.registration.step = 'phoneNumber';
                await ctx.reply('Please enter your phone number (with country code, e.g., +1234567890):');
                break;

            case 'phoneNumber':
                ctx.session.registration.phoneNumber = input;
                ctx.session.registration.step = 'bankName';
                await ctx.reply('Please enter your bank name:');
                break;

            case 'bankName':
                ctx.session.registration.bankName = input;
                ctx.session.registration.step = 'bankAccountNumber';
                await ctx.reply('Please enter your bank account number:');
                break;

            case 'bankAccountNumber':
                ctx.session.registration.bankAccountNumber = input;
                ctx.session.registration.step = 'photo';
                await ctx.reply('Please send a photo of your ID or selfie:');
                break;
        }
    } catch (error) {
        throw error;
    }
});

// Handle photo upload
registration.on('photo', async (ctx) => {
    try {
        if (ctx.session.registration?.step !== 'photo') {
            return;
        }

        const photos = ctx.message.photo;
        const photo = photos[photos.length - 1]; // Get highest quality photo
        const photoUrl = await ctx.telegram.getFileLink(photo.file_id);

        // Validate all collected data
        const registrationData = {
            userType: ctx.session.registration.userType,
            fullName: ctx.session.registration.fullName,
            phoneNumber: ctx.session.registration.phoneNumber,
            bankName: ctx.session.registration.bankName,
            bankAccountNumber: ctx.session.registration.bankAccountNumber
        };

        await registrationSchema.validateAsync(registrationData);

        // Save user to database
        await query(
            `INSERT INTO users (
                telegram_id, user_type, full_name, phone_number,
                bank_name, bank_account_number, photo_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                ctx.from.id,
                registrationData.userType,
                registrationData.fullName,
                registrationData.phoneNumber,
                registrationData.bankName,
                registrationData.bankAccountNumber,
                photoUrl.href
            ]
        );

        // Clear registration session
        ctx.session.registration = {};

        await ctx.reply(
            '✅ Registration submitted successfully!\n\n' +
            'Your account is pending verification. You will be notified once your account is verified.'
        );

        // Notify admin about new registration
        if (process.env.ADMIN_CHAT_ID) {
            await ctx.telegram.sendMessage(
                process.env.ADMIN_CHAT_ID,
                `🆕 New ${registrationData.userType} registration:\n\n` +
                `Name: ${registrationData.fullName}\n` +
                `Phone: ${registrationData.phoneNumber}\n` +
                `Telegram ID: ${ctx.from.id}`
            );
        }
    } catch (error) {
        if (error instanceof Joi.ValidationError) {
            throw new ValidationError(error.message);
        }
        throw error;
    }
});

module.exports = registration;