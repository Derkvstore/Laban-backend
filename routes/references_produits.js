// routes/references_produits.js
const express = require('express');
const routeur = express.Router();

// Contrôleur
const referencesProduitsController = require('../controllers/references_produits.controller');

// ⚠️ Si tu as un middleware d’authentification, tu peux l’activer ici sans changer ta logique :
// const { verifierToken } = require('../controllers/auth.controller');

// Création d’une référence
// POST /api/references_produits
routeur.post(
  '/',
  // verifierToken,  // décommente si tu protèges l’API
  referencesProduitsController.createReference
);

// Liste des références (avec filtre global ?q=...)
// GET /api/references_produits
routeur.get(
  '/',
  // verifierToken,
  referencesProduitsController.getReferences
);

// Suggestions par champ (?champ=marque|modele|stockage|type|type_carton & q=ip)
// GET /api/references_produits/suggestions
routeur.get(
  '/suggestions',
  // verifierToken,
  referencesProduitsController.getSuggestions
);

// Listes distinctes prêtes pour <datalist>
// GET /api/references_produits/distinct
routeur.get(
  '/distinct',
  // verifierToken,
  referencesProduitsController.getAllDistinct
);

module.exports = routeur;
