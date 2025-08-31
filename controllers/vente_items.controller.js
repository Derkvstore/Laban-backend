const pool = require('../db');

// Contrôleur pour récupérer tous les articles de vente
exports.getAllVenteItems = async (req, res) => {
  try {
    const allItems = await pool.query('SELECT * FROM vente_items ORDER BY id DESC');
    res.status(200).json(allItems.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des articles de vente:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer les articles de vente par ID de vente
exports.getVenteItemsByVenteId = async (req, res) => {
  const { venteId } = req.params;
  try {
    const items = await pool.query('SELECT * FROM vente_items WHERE vente_id = $1', [venteId]);
    res.status(200).json(items.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des articles de vente pour la vente:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour un article de vente (en cas de modification de prix, etc.)
exports.updateVenteItem = async (req, res) => {
  const { id } = req.params;
  const { quantite_vendue, prix_unitaire_negocie, statut_vente_item, cancellation_reason } = req.body;

  try {
    const updatedItem = await pool.query(
      'UPDATE vente_items SET quantite_vendue = $1, prix_unitaire_negocie = $2, statut_vente_item = $3, cancellation_reason = $4 WHERE id = $5 RETURNING *',
      [quantite_vendue, prix_unitaire_negocie, statut_vente_item, cancellation_reason, id]
    );

    if (updatedItem.rows.length === 0) {
      return res.status(404).json({ message: 'Article de vente non trouvé' });
    }

    res.status(200).json(updatedItem.rows[0]);
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'article de vente:", error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
