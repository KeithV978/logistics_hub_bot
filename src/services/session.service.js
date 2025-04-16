const db = require('../database');
const CustomError = require('../utils/customError');
const logger = require('../utils/logger');

const createSession = async (telegramId, data) => {
  try {
    const session = {
      sessionId: uuidv4(),
      telegramId,
      data,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date()
    };
    await db.sessions.insert(session);
    return session;
  } catch (error) {
    logger.error(`Error creating session: ${error.message}`, { telegramId });
    throw new CustomError('Failed to create session', 'SessionError');
  }
};

const getSession = async (telegramId) => {
  try {
    const session = await db.sessions.findOne({ telegramId });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return session;
  } catch (error) {
    logger.error(`Error getting session: ${error.message}`, { telegramId });
    throw new CustomError('Failed to get session', 'SessionError');
  }
};

const updateSession = async (telegramId, data) => {
  try {
    const session = await db.sessions.findOne({ telegramId });
    if (!session) {
      throw new CustomError('Session not found', 'NotFoundError');
    }
    await db.sessions.update(telegramId, { data, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    return true;
  } catch (error) {
    logger.error(`Error updating session: ${error.message}`, { telegramId });
    throw new CustomError('Failed to update session', 'SessionError');
  }
};

const deleteSession = async (telegramId) => {
  try {
    await db.sessions.delete({ telegramId });
    return true;
  } catch (error) {
    logger.error(`Error deleting session: ${error.message}`, { telegramId });
    throw new CustomError('Failed to delete session', 'SessionError');
  }
};

module.exports = {
  createSession,
  getSession,
  updateSession,
  deleteSession
};