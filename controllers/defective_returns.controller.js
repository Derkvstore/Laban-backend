const pool = require('../db');

// Contrôleur pour récupérer tous les retours défectueux
exports.getAllDefectiveReturns = async (req, res) => {
  try {
    const returns = await pool.query(`
      SELECT
        dr.id,
        dr.quantite_retournee,
        dr.reason,
        dr.return_date,
        dr.status,
        c.id AS client_id,            -- ⬅️ ajouté pour Retours.jsx
        c.nom AS client_nom,
        c.telephone AS client_telephone,
        p.marque,
        p.modele,
        p.stockage,
        p.type,
        p.type_carton
      FROM defective_returns dr
      LEFT JOIN products p ON p.id = dr.product_id

      -- ⬇️ on choisit un seul vente_items lié au product_id (le plus récent)
      LEFT JOIN LATERAL (
        SELECT vi.*
        FROM vente_items vi
        WHERE vi.product_id = dr.product_id
        ORDER BY vi.id DESC
        LIMIT 1
      ) vi ON TRUE

      LEFT JOIN ventes v   ON v.id = vi.vente_id
      LEFT JOIN clients c  ON c.id = v.client_id

      ORDER BY dr.return_date DESC
    `);

    res.status(200).json(returns.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des retours défectueux:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
