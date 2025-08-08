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
      AND vi.statut_vente_item = 'vendu'
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

// Contrôleur pour récupérer les totaux du tableau de bord
exports.getDashboardTotals = async (req, res) => {
  try {
    // Requête pour compter le nombre total de produits en stock de type 'CARTON'
    const cartonsResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_stock
      FROM products
      WHERE type = 'CARTON' AND quantite_en_stock > 0
    `);
    
    // Requête pour compter le nombre total de produits en stock de type 'ARRIVAGE'
    const arrivagesResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_arrivages
      FROM products
      WHERE type = 'ARRIVAGE' AND quantite_en_stock > 0
    `);

    // Requête pour compter le nombre total de produits en stock de type 'ACCESSOIRE'
    const accessoiresResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_accessoires
      FROM products
      WHERE type = 'ACCESSOIRE' AND quantite_en_stock > 0
    `);

    const retoursResult = await pool.query(`
      SELECT SUM(quantite_retournee) as total_retours
      FROM defective_returns
    `);
    
    const mobilesVendusResult = await pool.query(`
      SELECT SUM(quantite_vendue) as total_vendus
      FROM vente_items
      WHERE statut_vente_item = 'vendu'
    `);

    res.status(200).json({
      cartons: parseInt(cartonsResult.rows[0].total_stock, 10) || 0,
      arrivages: parseInt(arrivagesResult.rows[0].total_arrivages, 10) || 0,
      retours: parseInt(retoursResult.rows[0].total_retours, 10) || 0,
      mobilesVendus: parseInt(mobilesVendusResult.rows[0].total_vendus, 10) || 0,
      accessoires: parseInt(accessoiresResult.rows[0].total_accessoires, 10) || 0,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des totaux du tableau de bord:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
