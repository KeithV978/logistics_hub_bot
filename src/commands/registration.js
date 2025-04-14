const { Markup } = require('telegraf');
const db = require('../config/database');
const logger = require('../utils/logger');

// Registration states
const REGISTRATION_STATES = {
    IDLE: 'IDLE',
    AWAITING_ROLE: 'AWAITING_ROLE',
    AWAITING_NAME: 'AWAITING_NAME',
    AWAITING_PHONE: 'AWAITING_PHONE',
    AWAITING_BANK_DETAILS: 'AWAITING_BANK_DETAILS',
    AWAITING_DOCUMENT: 'AWAITING_DOCUMENT',
    COMPLETED: 'COMPLETED'
};

// Initialize registration command
const initializeRegistration = async (ctx) => {
    try {
        // Check if user is already registered
        const result = await db.query(
            'SELECT role FROM users WHERE telegram_id = $1',
            [ctx.from.id]
        );

        if (result.rows.length > 0) {
            return ctx.reply('You are already registered as a ' + result.rows[0].role);
        }

        // Set initial registration state
        ctx.session.registrationState = REGISTRATION_STATES.AWAITING_ROLE;

        // Show role selection buttons
        return ctx.reply(
            'Welcome to Logistics Hub! Please select your role:',
            Markup.keyboard([
                ['🛍️ Customer'],
                ['🚚 Rider'],
                ['🏃 Errander']
            ]).oneTime().resize()
        );
    } catch (error) {
        logger.error('Error in initializeRegistration:', error);
        return ctx.reply('Sorry, an error occurred. Please try again later.');
    }
};

// Handle role selection
const handleRoleSelection = async (ctx) => {
    const roleMap = {
        '🛍️ Customer': 'user',
        '🚚 Rider': 'rider',
        '🏃 Errander': 'errander'
    };

    const selectedRole = roleMap[ctx.message.text];
    if (!selectedRole) {
        return ctx.reply('Please select a valid role using the buttons provided.');
    }

    ctx.session.registration = {
        role: selectedRole
    };
    ctx.session.registrationState = REGISTRATION_STATES.AWAITING_NAME;

    return ctx.reply(
        'Please enter your full name:',
        Markup.removeKeyboard()
    );
};

// Handle name input
const handleNameInput = async (ctx) => {
    const name = ctx.message.text.trim();
    if (name.length < 3) {
        return ctx.reply('Please enter a valid name (at least 3 characters).');
    }

    ctx.session.registration.fullName = name;
    ctx.session.registrationState = REGISTRATION_STATES.AWAITING_PHONE;

    return ctx.reply(
        'Please share your phone number:',
        Markup.keyboard([
            [Markup.button.contactRequest('📱 Share Phone Number')]
        ]).oneTime().resize()
    );
};

// Handle phone number
const handlePhoneNumber = async (ctx) => {
    const contact = ctx.message.contact;
    if (!contact || !contact.phone_number) {
        return ctx.reply('Please share your phone number using the button provided.');
    }

    ctx.session.registration.phoneNumber = contact.phone_number;

    // If user is registering as a rider or errander, ask for bank details
    if (['rider', 'errander'].includes(ctx.session.registration.role)) {
        ctx.session.registrationState = REGISTRATION_STATES.AWAITING_BANK_DETAILS;
        return ctx.reply(
            'Please enter your bank details in the following format:\nBank Name, Account Number',
            Markup.removeKeyboard()
        );
    }

    // For regular users, complete registration
    return completeRegistration(ctx);
};

// Handle bank details
const handleBankDetails = async (ctx) => {
    const bankDetails = ctx.message.text.split(',').map(item => item.trim());
    if (bankDetails.length !== 2) {
        return ctx.reply('Please provide bank details in the correct format: Bank Name, Account Number');
    }

    const [bankName, accountNumber] = bankDetails;
    ctx.session.registration.bankDetails = { bankName, accountNumber };
    ctx.session.registrationState = REGISTRATION_STATES.AWAITING_DOCUMENT;

    return ctx.reply(
        'Please upload a photo of your ID document (passport, driver\'s license, or national ID).',
        Markup.removeKeyboard()
    );
};

// Handle document upload
const handleDocument = async (ctx) => {
    const photo = ctx.message.photo;
    if (!photo || !photo.length) {
        return ctx.reply('Please upload a valid photo document.');
    }

    // Get the file ID of the largest photo version
    const fileId = photo[photo.length - 1].file_id;
    ctx.session.registration.documentFileId = fileId;

    return completeRegistration(ctx);
};

// Complete registration
const completeRegistration = async (ctx) => {
    const registration = ctx.session.registration;
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // Insert user
        const userResult = await client.query(
            'INSERT INTO users (telegram_id, role, full_name, phone_number) VALUES ($1, $2, $3, $4) RETURNING id',
            [ctx.from.id, registration.role, registration.fullName, registration.phoneNumber]
        );

        // If rider or errander, create additional record
        if (['rider', 'errander'].includes(registration.role)) {
            const table = registration.role === 'rider' ? 'riders' : 'erranders';
            await client.query(
                `INSERT INTO ${table} (user_id, bank_account_number, bank_name, document_url) VALUES ($1, $2, $3, $4)`,
                [
                    userResult.rows[0].id,
                    registration.bankDetails.accountNumber,
                    registration.bankDetails.bankName,
                    registration.documentFileId
                ]
            );
        }

        await client.query('COMMIT');

        // Clear registration session
        ctx.session.registrationState = REGISTRATION_STATES.COMPLETED;
        delete ctx.session.registration;

        // Send completion message
        const message = ['rider', 'errander'].includes(registration.role)
            ? 'Thank you for registering! Your account is pending verification. We will notify you once your account is verified.'
            : 'Thank you for registering! You can now use our services.';

        return ctx.reply(message, Markup.removeKeyboard());

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error in completeRegistration:', error);
        return ctx.reply('Sorry, an error occurred during registration. Please try again.');
    } finally {
        client.release();
    }
};

// Registration middleware
const registrationMiddleware = (ctx, next) => {
    if (!ctx.session.registrationState || ctx.session.registrationState === REGISTRATION_STATES.COMPLETED) {
        return next();
    }

    // Handle registration steps based on current state
    switch (ctx.session.registrationState) {
        case REGISTRATION_STATES.AWAITING_ROLE:
            return handleRoleSelection(ctx);
        case REGISTRATION_STATES.AWAITING_NAME:
            return handleNameInput(ctx);
        case REGISTRATION_STATES.AWAITING_PHONE:
            return handlePhoneNumber(ctx);
        case REGISTRATION_STATES.AWAITING_BANK_DETAILS:
            return handleBankDetails(ctx);
        case REGISTRATION_STATES.AWAITING_DOCUMENT:
            return handleDocument(ctx);
        default:
            return next();
    }
};

module.exports = {
    initializeRegistration,
    registrationMiddleware,
    REGISTRATION_STATES
};