const pool = require('../db');

// petit helper pour passer TYPE produit -> clé de carte
function mapTypeToKey(t) {
  const up = (t || '').toUpperCase();
  if (up === 'CARTON') return 'cartons';
  if (up === 'ARRIVAGE') return 'arrivages';
  if (up === 'ACCESSOIRE') return 'accessoires';
  return null;
}

// Contrôleur pour un rapport des mouvements de la journée
exports.getDailyReport = async (req, res) => {
  const { date } = req.query; // 'YYYY-MM-DD'
  const targetDate = date ? date : new Date().toISOString().slice(0, 10);

  try {
    // (facultatif) autres sections du rapport conservées
    const ventes = await pool.query(`
      SELECT v.id, c.nom AS client_nom, v.montant_total, v.montant_paye,
             (v.montant_total - v.montant_paye) AS montant_restant, v.statut_paiement, v.date_vente
      FROM ventes v
      JOIN clients c ON v.client_id = c.id
      WHERE DATE(v.date_vente) = $1
      ORDER BY v.date_vente DESC
    `, [targetDate]);

    const stockMovements = await pool.query(`
      SELECT sm.movement_type, sm.quantity_moved, sm.movement_date,
             p.marque, p.modele, p.type
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE DATE(sm.movement_date) = $1
      ORDER BY sm.movement_date DESC
    `, [targetDate]);

    const defectiveReturns = await pool.query(`
      SELECT dr.quantite_retournee, dr.reason, dr.return_date,
             p.marque, p.modele, p.type
      FROM defective_returns dr
      JOIN products p ON dr.product_id = p.id
      WHERE DATE(dr.return_date) = $1
      ORDER BY dr.return_date DESC
    `, [targetDate]);

    // Bénéfice brut du jour (sur items marqués vendus)
    const beneficeResult = await pool.query(`
      SELECT
        COALESCE(SUM(vi.quantite_vendue * vi.prix_unitaire_negocie),0) AS total_ventes,
        COALESCE(SUM(vi.quantite_vendue * vi.prix_unitaire_achat_au_moment_vente),0) AS total_achats
      FROM vente_items vi
      JOIN ventes v ON vi.vente_id = v.id
      WHERE DATE(v.date_vente) = $1
      AND vi.statut_vente_item = 'vendu'
    `, [targetDate]);
    const { total_ventes, total_achats } = beneficeResult.rows[0];
    const beneficeBrut = (parseFloat(total_ventes) || 0) - (parseFloat(total_achats) || 0);

    // ---------- Mouvements du jour ----------
    const mouvementsDuJour = {
      cartons:    { stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
      arrivages:  { stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
      accessoires:{ stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
    };

    // Agrégat des mouvements du jour (type produit + type de mouvement)
    const todayMovements = await pool.query(`
      SELECT p.type, sm.movement_type, SUM(sm.quantity_moved) AS total
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE DATE(sm.movement_date) = $1
      GROUP BY p.type, sm.movement_type
    `, [targetDate]);

    for (const row of todayMovements.rows) {
      const key = mapTypeToKey(row.type);
      if (!key) continue;
      const total = parseInt(row.total, 10) || 0;
      const mt = (row.movement_type || '').toLowerCase();

      if (mt === 'entrée' || mt === 'entree') mouvementsDuJour[key].ajouteToday += total;
      else if (mt === 'sortie')            mouvementsDuJour[key].venduToday   += total;
      else if (mt === 'retour')            mouvementsDuJour[key].retourneToday+= total;
      else if (mt === 'rendu')             mouvementsDuJour[key].renduToday   += total;
    }

    // Stock ACTUEL par type (dans products)
    const stockActuelRes = await pool.query(`
      SELECT p.type, COALESCE(SUM(p.quantite_en_stock),0) AS total_stock
      FROM products p
      GROUP BY p.type
    `);

    const stockActuel = { cartons: 0, arrivages: 0, accessoires: 0 };
    for (const row of stockActuelRes.rows) {
      const key = mapTypeToKey(row.type);
      if (!key) continue;
      stockActuel[key] = parseInt(row.total_stock, 10) || 0;
    }

    // Reconstitution du "stock d'hier" : stock_actuel - entrées_du_jour - rendus_du_jour + sorties_du_jour
    for (const key of Object.keys(mouvementsDuJour)) {
      const m = mouvementsDuJour[key];
      m.stockHier = stockActuel[key] - (m.ajouteToday + m.renduToday) + m.venduToday;
      if (m.stockHier < 0) m.stockHier = 0;
    }

    res.status(200).json({
      date: targetDate,
      ventes: ventes.rows,
      stock_movements: stockMovements.rows,
      defective_returns: defectiveReturns.rows,
      mouvements_du_jour: mouvementsDuJour,
      benefice_brut: beneficeBrut,
      total_ventes: parseFloat(total_ventes) || 0
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport journalier:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Totaux du dashboard (inchangé)
exports.getDashboardTotals = async (req, res) => {
  try {
    const cartonsResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_stock
      FROM products
      WHERE type = 'CARTON' AND quantite_en_stock > 0
    `);

    const arrivagesResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_arrivages
      FROM products
      WHERE type = 'ARRIVAGE' AND quantite_en_stock > 0
    `);

    const accessoiresResult = await pool.query(`
      SELECT SUM(quantite_en_stock) as total_accessoires
      FROM products
      WHERE type = 'ACCESSOIRE' AND quantite_en_stock > 0
    `);

    const retoursResult = await pool.query(`SELECT SUM(quantite_retournee) as total_retours FROM defective_returns`);
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
