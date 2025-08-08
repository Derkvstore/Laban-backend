const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const dettesController = require('../controllers/dettes.controller');

// Toutes les routes pour les dettes sont protégées
router.use(authMiddleware);

// Route GET pour récupérer toutes les dettes
router.get('/', dettesController.getAllDettes);

// Route GET pour récupérer les dettes d'un client spécifique
router.get('/client/:clientId', dettesController.getDettesByClient);

module.exports = router;
