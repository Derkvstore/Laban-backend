// Importe le pool de connexion à la base de données
const pool = require('../db');

// Contrôleur pour récupérer tous les mouvements de stock
// Utile pour la section "Rapports" du tableau de bord
exports.getAllStockMovements = async (req, res) => {
  try {
    const allMovements = await pool.query('SELECT * FROM stock_movements ORDER BY movement_date DESC');
    res.status(200).json(allMovements.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des mouvements de stock:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer les mouvements de stock d'un produit spécifique
exports.getStockMovementsByProduct = async (req, res) => {
  const { productId } = req.params;
  try {
    const movements = await pool.query('SELECT * FROM stock_movements WHERE product_id = $1 ORDER BY movement_date DESC', [productId]);
    res.status(200).json(movements.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des mouvements de stock pour le produit:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Note: La création de nouveaux mouvements de stock est gérée
// automatiquement par d'autres contrôleurs (ventes, retours, ajouts de produits).
// Par exemple, lors d'une vente, une entrée dans `stock_movements` est créée.
// Il n'y a donc pas de route POST directe ici pour des raisons de cohérence des données.
