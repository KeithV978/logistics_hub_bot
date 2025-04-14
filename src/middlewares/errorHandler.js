class BotError extends Error {
    constructor(message, code = 'INTERNAL_ERROR', metadata = {}) {
        super(message);
        this.code = code;
        this.metadata = metadata;
    }
}

class ValidationError extends BotError {
    constructor(message, metadata = {}) {
        super(message, 'VALIDATION_ERROR', metadata);
    }
}

class DatabaseError extends BotError {
    constructor(message, metadata = {}) {
        super(message, 'DATABASE_ERROR', metadata);
    }
}

const errorHandler = async (ctx, next) => {
    try {
        await next();
    } catch (error) {
        console.error(`Error for ${ctx.updateType}:`, error);

        const errorMessage = error instanceof BotError
            ? error.message
            : 'An unexpected error occurred. Please try again later.';

        // Send error message to user
        await ctx.reply(errorMessage);

        // If it's a critical error, notify admin
        if (!(error instanceof ValidationError)) {
            const adminMessage = `🚨 Error in ${ctx.updateType}\nUser: ${ctx.from?.id}\nError: ${error.message}\nStack: ${error.stack}`;
            await ctx.telegram.sendMessage(process.env.ADMIN_CHAT_ID, adminMessage).catch(console.error);
        }
    }
};

module.exports = {
    errorHandler,
    BotError,
    ValidationError,
    DatabaseError
};