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
const referencesProduitsRoutes = require('./routes/references_produits');
const retoursFournisseursRoutes = require('./routes/retours_fournisseurs'); // ✅

// Charge les variables d'environnement
dotenv.config();

// Crée l'application Express
const app = express();

// Middleware JSON
app.use(express.json());

// CORS (Vercel en prod)
const isProduction = process.env.NODE_ENV === 'production';
const corsOptions = {
  origin: isProduction ? 'https://wassolo-app.vercel.app' : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Test DB
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    return console.error('Erreur de connexion à la base de données', err.stack);
  }
  console.log('✅ Connexion DB :', result.rows[0].now);
});

// Ping
app.get('/', (req, res) => {
  res.send('API Laban Service démarrée !');
});

// Auth
app.use('/api/auth', authRoutes);

// Ressources
app.use('/api/clients', clientsRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/ventes', ventesRoutes);
app.use('/api/factures', facturesRoutes);
app.use('/api/stock_movements', stockMovementsRoutes);
app.use('/api/vente_items', venteItemsRoutes);
app.use('/api/benefices', beneficesRoutes);
app.use('/api/dettes', dettesRoutes);

// Retours défectueux (route officielle)
app.use('/api/defective_returns', defectiveReturnsRoutes);
// ✅ Alias rétro-compatibilité pour ton frontend actuel
app.use('/api/returns', defectiveReturnsRoutes);

// Rapports & autres
app.use('/api/rapports', rapportsRoutes);
app.use('/api/special_orders', specialOrdersRoutes);
app.use('/api/references_produits', referencesProduitsRoutes);

// ✅ Retours Fournisseurs (deux chemins acceptés : tiret ET underscore)
app.use('/api/retours-fournisseurs', retoursFournisseursRoutes);
app.use('/api/retours_fournisseurs', retoursFournisseursRoutes);

// 404 JSON propre
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
});

// Démarre le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur sur le port ${PORT}`);
});
