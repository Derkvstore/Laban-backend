// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const pool = require('./db');

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
const retoursFournisseursRoutes = require('./routes/retours_fournisseurs');

dotenv.config();

const app = express();
app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production';
app.use(cors({
  origin: isProduction ? 'https://wassolo-app.vercel.app' : '*',
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));

pool.query('SELECT NOW()', (err, result) => {
  if (err) return console.error('Erreur de connexion à la base de données', err.stack);
  console.log('✅ Connexion DB :', result.rows[0].now);
});

app.get('/', (_req, res) => res.send('API Laban Service démarrée !'));

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

// route historique
app.use('/api/defective_returns', defectiveReturnsRoutes);
// alias court utilisé par ton frontend
app.use('/api/returns', defectiveReturnsRoutes);

app.use('/api/rapports', rapportsRoutes);
app.use('/api/special_orders', specialOrdersRoutes);
app.use('/api/references_produits', referencesProduitsRoutes);
app.use('/api/retours-fournisseurs', retoursFournisseursRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur sur le port ${PORT}`));
