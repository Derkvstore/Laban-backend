// Importe les dépendances nécessaires
const express = require('express');
const router = express.Router();
// Importe le middleware d'authentification pour sécuriser les routes
const authMiddleware = require('../middleware/auth.middleware');
// Importe le contrôleur des fournisseurs
const fournisseursController = require('../controllers/fournisseurs.controller');

// Toutes les routes définies ci-dessous utiliseront le middleware d'authentification.
router.use(authMiddleware);

// Route POST pour créer un nouveau fournisseur
router.post('/', fournisseursController.createFournisseur);

// Route GET pour récupérer tous les fournisseurs
router.get('/', fournisseursController.getAllFournisseurs);

// Route GET pour récupérer un fournisseur par son ID
router.get('/:id', fournisseursController.getFournisseurById);

// Route PUT pour mettre à jour un fournisseur par son ID
router.put('/:id', fournisseursController.updateFournisseur);

// Route DELETE pour supprimer un fournisseur par son ID
router.delete('/:id', fournisseursController.deleteFournisseur);

// Exporte le routeur pour qu'il puisse être utilisé par le fichier `server.js`
module.exports = router;
