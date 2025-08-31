const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const ctrl = require('../controllers/retours_fournisseurs.controller');

// Toutes les routes sont protégées
router.use(authMiddleware);

// Créer un ou plusieurs retours fournisseur
router.post('/', ctrl.creerRetourFournisseur);

// Lister / chercher
router.get('/', ctrl.listerRetoursFournisseurs);

// Lire un retour fournisseur
router.get('/:id', ctrl.lireRetourFournisseur);

// Mettre à jour le statut (reception, remplacement, avoir, etc.)
router.put('/:id/statut', ctrl.mettreAJourStatutRetourFournisseur);

module.exports = router;
