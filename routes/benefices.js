const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const beneficesController = require('../controllers/benefices.controller');

router.use(authMiddleware);

// GET /api/benefices
router.get('/', beneficesController.getBenefices);

module.exports = router;
