const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const retoursFournisseursController = require('../controllers/retours_fournisseurs.controller');

// Toutes les routes sont protégées
router.use(authMiddleware);

// Petit ping pour vérifier que la route est bien montée
router.get('/_ping', (req, res) => res.json({ ok: true }));

// ✅ Envoi d’un lot de retours défectueux au fournisseur
router.post('/', retoursFournisseursController.creerEnvoiFournisseur);

// ✅ Listing simple des retours déjà envoyés au fournisseur (statut)
router.get('/', retoursFournisseursController.listerEnvoisFournisseur);

module.exports = router;
