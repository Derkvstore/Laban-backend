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
        c.nom AS client_nom,
        c.telephone AS client_telephone,
        p.marque,
        p.modele,
        p.stockage,
        p.type,
        p.type_carton
      FROM defective_returns dr
      LEFT JOIN products p ON dr.product_id = p.id
      LEFT JOIN vente_items vi ON dr.product_id = vi.product_id
      LEFT JOIN ventes v ON vi.vente_id = v.id
      LEFT JOIN clients c ON v.client_id = c.id
      GROUP BY dr.id, c.id, p.id, vi.id
      ORDER BY dr.return_date DESC
    `);
    res.status(200).json(returns.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des retours défectueux:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
