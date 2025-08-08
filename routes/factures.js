const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const facturesController = require('../controllers/factures.controller');

// Applique le middleware d'authentification pour toutes les routes des factures
router.use(authMiddleware);

// Routes CRUD pour les factures
router.post('/', facturesController.createFacture);
router.get('/', facturesController.getAllFactures);
router.get('/:id', facturesController.getFactureById);
router.put('/:id', facturesController.updateFacture);
router.put('/cancel/:id', facturesController.cancelFacture);

module.exports = router;
