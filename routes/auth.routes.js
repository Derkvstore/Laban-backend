// Importe le module 'express'
const express = require('express');
// Crée un nouveau router Express
const router = express.Router();
// Importe le contrôleur d'authentification pour gérer la logique
const authController = require('../controllers/auth.controller');

// Définit la route POST pour la connexion des utilisateurs
// La logique de traitement de cette route est déléguée au contrôleur.
router.post('/login', authController.login);

// Exporte le router pour qu'il puisse être utilisé dans server.js
module.exports = router;
