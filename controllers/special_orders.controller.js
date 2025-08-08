const pool = require('../db');

// Contrôleur pour créer une nouvelle commande spéciale
exports.createSpecialOrder = async (req, res) => {
  const {
    client_id,
    fournisseur_id,
    marque,
    modele,
    stockage,
    type,
    prix_achat_fournisseur,
    prix_vente_client,
  } = req.body;

  try {
    const newOrder = await pool.query(
      `INSERT INTO special_orders (
        client_id,
        fournisseur_id,
        marque,
        modele,
        stockage,
        type,
        prix_achat_fournisseur,
        prix_vente_client
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        client_id,
        fournisseur_id,
        marque,
        modele,
        stockage,
        type,
        prix_achat_fournisseur,
        prix_vente_client,
      ]
    );

    res.status(201).json(newOrder.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création de la commande spéciale:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer toutes les commandes spéciales
exports.getAllSpecialOrders = async (req, res) => {
  try {
    const allOrders = await pool.query('SELECT * FROM special_orders ORDER BY date_commande DESC');
    res.status(200).json(allOrders.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes spéciales:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer une commande spéciale par son ID
exports.getSpecialOrderById = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await pool.query('SELECT * FROM special_orders WHERE id = $1', [id]);
    if (order.rows.length === 0) {
      return res.status(404).json({ message: 'Commande spéciale non trouvée' });
    }
    res.status(200).json(order.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération de la commande spéciale:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour une commande spéciale
exports.updateSpecialOrder = async (req, res) => {
  const { id } = req.params;
  const {
    client_id,
    fournisseur_id,
    marque,
    modele,
    stockage,
    type,
    prix_achat_fournisseur,
    prix_vente_client,
    statut,
    raison_annulation,
  } = req.body;

  try {
    const updatedOrder = await pool.query(
      `UPDATE special_orders SET
        client_id = $1,
        fournisseur_id = $2,
        marque = $3,
        modele = $4,
        stockage = $5,
        type = $6,
        prix_achat_fournisseur = $7,
        prix_vente_client = $8,
        statut = $9,
        raison_annulation = $10,
        date_statut_change = NOW()
      WHERE id = $11 RETURNING *`,
      [
        client_id,
        fournisseur_id,
        marque,
        modele,
        stockage,
        type,
        prix_achat_fournisseur,
        prix_vente_client,
        statut,
        raison_annulation,
        id,
      ]
    );

    if (updatedOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Commande spéciale non trouvée' });
    }

    res.status(200).json(updatedOrder.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la commande spéciale:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour supprimer une commande spéciale
exports.deleteSpecialOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedOrder = await pool.query('DELETE FROM special_orders WHERE id = $1 RETURNING *', [id]);
    if (deletedOrder.rows.length === 0) {
      return res.status(404).json({ message: 'Commande spéciale non trouvée' });
    }
    res.status(200).json({ message: 'Commande spéciale supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la commande spéciale:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
