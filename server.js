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
const defectiveReturnsRoutes = require('./routes/defective_returns'); // contrôleur des retours défectueux
const rapportsRoutes = require('./routes/rapports');
const specialOrdersRoutes = require('./routes/special_orders');
const referencesProduitsRoutes = require('./routes/references_produits');
const retoursFournisseursRoutes = require('./routes/retours_fournisseurs');

// Charge les variables d'environnement depuis le fichier .env
dotenv.config();

// Crée l'application Express
const app = express();

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Middleware CORS pour autoriser les requêtes du frontend
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction ? 'https://wassolo-app.vercel.app' : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Affiche un message de connexion à la base de données
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    return console.error('Erreur de connexion à la base de données', err.stack);
  }
  console.log('✅ Connexion à la base de données réussie :', result.rows[0].now);
});

// Route de test de base
app.get('/', (req, res) => {
  res.send('API Laban Service démarrée !');
});

// ==== Routes API ====
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/stock_movements', stockMovementsRoutes);
app.use('/api/vente_items', venteItemsRoutes);
app.use('/api/benefices', beneficesRoutes);
app.use('/api/dettes', dettesRoutes);

// Retours défectueux : on expose 3 alias pour compatibilité front
app.use('/api/defective_returns', defectiveReturnsRoutes);   // underscore
app.use('/api/defective-returns', defectiveReturnsRoutes);   // tiret
app.use('/api/returns', defectiveReturnsRoutes);             // court (appelé par ton front)

app.use('/api/rapports', rapportsRoutes);
app.use('/api/special_orders', specialOrdersRoutes);
app.use('/api/references_produits', referencesProduitsRoutes);

// Retours vers fournisseurs : 2 alias (tiret + underscore)
app.use('/api/retours-fournisseurs', retoursFournisseursRoutes);
app.use('/api/retours_fournisseurs', retoursFournisseursRoutes);

// ==== Gestion des erreurs JSON propres ====
// 404 JSON (évite les pages HTML qui cassent le parsing côté front)
app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable', path: req.originalUrl });
});

// 500 JSON (filet de sécurité)
app.use((err, req, res, next) => {
  console.error('Erreur non interceptée :', err);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

// Démarre le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
