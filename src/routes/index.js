const express = require('express');
const router = express.Router();
const { bot } = require('../services');

router.post(`/${process.env.BOT_TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

module.exports = router;