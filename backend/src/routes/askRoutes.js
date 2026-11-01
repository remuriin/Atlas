// The address under /api/ask. No login: anyone with the Atlas Explorer may ask.
const express = require('express');
const rateLimit = require('../middleware/rateLimit');
const askController = require('../controllers/askController');

const router = express.Router();

router.post('/', rateLimit.askLimiter, askController.ask);

module.exports = router;
