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
        p.marque,
        p.modele,
        p.stockage,
        p.type
      FROM defective_returns dr
      JOIN products p ON dr.product_id = p.id
      ORDER BY dr.return_date DESC
    `);
    res.status(200).json(returns.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des retours défectueux:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
