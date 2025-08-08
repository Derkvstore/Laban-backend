const pool = require('../db');

// Contrôleur pour un rapport des mouvements de la journée
exports.getDailyReport = async (req, res) => {
  const { date } = req.query; // Date au format 'YYYY-MM-DD'
  const targetDate = date ? date : new Date().toISOString().slice(0, 10);
  
  try {
    // Rapport des ventes de la journée
    const ventes = await pool.query(`
      SELECT
        v.id,
        c.nom AS client_nom,
        v.montant_total,
        v.montant_paye,
        (v.montant_total - v.montant_paye) AS montant_restant,
        v.statut_paiement
      FROM ventes v
      JOIN clients c ON v.client_id = c.id
      WHERE DATE(v.date_vente) = $1
      ORDER BY v.date_vente DESC
    `, [targetDate]);

    // Rapport des mouvements de stock de la journée
    const stockMovements = await pool.query(`
      SELECT
        sm.movement_type,
        sm.quantity_moved,
        sm.movement_date,
        p.marque,
        p.modele,
        p.type
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE DATE(sm.movement_date) = $1
      ORDER BY sm.movement_date DESC
    `, [targetDate]);

    // Rapport des retours défectueux de la journée
    const defectiveReturns = await pool.query(`
      SELECT
        dr.quantite_retournee,
        dr.reason,
        dr.return_date,
        p.marque,
        p.modele,
        p.type
      FROM defective_returns dr
      JOIN products p ON dr.product_id = p.id
      WHERE DATE(dr.return_date) = $1
      ORDER BY dr.return_date DESC
    `, [targetDate]);
    
    // Calcule le bénéfice brut de la journée
    const beneficeResult = await pool.query(`
      SELECT
        SUM(vi.quantite_vendue * vi.prix_unitaire_negocie) AS total_ventes,
        SUM(vi.quantite_vendue * vi.prix_unitaire_achat_au_moment_vente) AS total_achats
      FROM vente_items vi
      JOIN ventes v ON vi.vente_id = v.id
      WHERE DATE(v.date_vente) = $1
      AND vi.statut_vente_item = 'actif'
    `, [targetDate]);
    
    const { total_ventes, total_achats } = beneficeResult.rows[0];
    const beneficeBrut = (parseFloat(total_ventes) || 0) - (parseFloat(total_achats) || 0);

    res.status(200).json({
      date: targetDate,
      ventes: ventes.rows,
      stock_movements: stockMovements.rows,
      defective_returns: defectiveReturns.rows,
      benefice_brut: beneficeBrut,
      total_ventes: parseFloat(total_ventes) || 0
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport journalier:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
