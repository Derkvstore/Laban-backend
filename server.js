// Importe les dépendances
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
// Importe le pool de connexion à la base de données
const pool = require('./db');
// Importe les routes
const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients');
const fournisseursRoutes = require('./routes/fournisseurs');
const productsRoutes = require('./routes/products');
const ventesRoutes = require('./routes/ventes');
const facturesRoutes = require('./routes/factures');
const stockMovementsRoutes = require('./routes/stock_movements');
const venteItemsRoutes = require('./routes/vente_items');
const beneficesRoutes = require('./routes/benefices');
const dettesRoutes = require('./routes/dettes');
const defectiveReturnsRoutes = require('./routes/defective_returns');
const rapportsRoutes = require('./routes/rapports');
const specialOrdersRoutes = require('./routes/special_orders');


// Charge les variables d'environnement depuis le fichier .env
dotenv.config();

// Crée l'application Express
const app = express();

// Middleware pour analyser les requêtes JSON
app.use(express.json());
// Middleware CORS pour autoriser les requêtes du frontend
app.use(cors());

// Affiche un message de connexion à la base de données
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    // Affiche une erreur si la connexion échoue
    return console.error('Erreur de connexion à la base de données', err.stack);
  }
  console.log('✅ Connexion à la base de données réussie :', result.rows[0].now);
});

// Route de test de base
app.get('/', (req, res) => {
  res.send('API Laban Service démarrée !');
});

// Utilise les routes d'authentification
app.use('/api/auth', authRoutes);

// Utilise les routes pour les clients
app.use('/api/clients', clientsRoutes);

// Utilise les routes pour les fournisseurs
app.use('/api/fournisseurs', fournisseursRoutes);

// Utilise les routes pour les produits
app.use('/api/products', productsRoutes);

// Utilise les routes pour les ventes
app.use('/api/ventes', ventesRoutes);

// Utilise les routes pour les factures
app.use('/api/factures', facturesRoutes);

// Utilise les routes pour les mouvements de stock
app.use('/api/stock_movements', stockMovementsRoutes);

// Utilise les routes pour les articles de vente
app.use('/api/vente_items', venteItemsRoutes);

// Utilise les routes pour les bénéfices
app.use('/api/benefices', beneficesRoutes);

// Utilise les routes pour les dettes
app.use('/api/dettes', dettesRoutes);

// Utilise les routes pour les retours défectueux
app.use('/api/defective_returns', defectiveReturnsRoutes);

// Utilise les routes pour les rapports
app.use('/api/rapports', rapportsRoutes);

// Utilise les routes pour les commandes spéciales
app.use('/api/special_orders', specialOrdersRoutes);


// Démarre le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
