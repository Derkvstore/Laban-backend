// Importe les dépendances nécessaires
const express = require('express');
const router = express.Router();
// Importe le middleware d'authentification pour sécuriser les routes
const authMiddleware = require('../middleware/auth.middleware');
// Importe le contrôleur des clients (la logique métier sera ici)
// Notez le chemin relatif pour atteindre le dossier "controllers"
const clientsController = require('../controllers/clients.controller');

// Toutes les routes définies ci-dessous utiliseront le middleware d'authentification.
// Cela signifie que seules les requêtes avec un token JWT valide seront autorisées.
router.use(authMiddleware);

// Route POST pour créer un nouveau client
router.post('/', clientsController.createClient);

// Route GET pour récupérer tous les clients
router.get('/', clientsController.getAllClients);

// Route GET pour récupérer un client par son ID
router.get('/:id', clientsController.getClientById);

// Route PUT pour mettre à jour un client par son ID
router.put('/:id', clientsController.updateClient);

// Route DELETE pour supprimer un client par son ID
router.delete('/:id', clientsController.deleteClient);

// Exporte le routeur pour qu'il puisse être utilisé par le fichier `server.js`
module.exports = router;
