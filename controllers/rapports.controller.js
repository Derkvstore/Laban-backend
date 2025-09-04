const pool = require('../db');

/* ---------- helpers ---------- */
function mapTypeToKey(t) {
  const up = (t || '').toUpperCase();
  if (up === 'CARTON') return 'cartons';
  if (up === 'ARRIVAGE') return 'arrivages';
  if (up === 'ACCESSOIRE') return 'accessoires';
  return null;
}

/* ---------- Rapport journalier “cartes + inventaire” (existant) ---------- */
exports.getDailyReport = async (req, res) => {
  const { date } = req.query; // 'YYYY-MM-DD'
  const targetDate = date ? date : new Date().toISOString().slice(0, 10);

  try {
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

    const mouvementsDuJour = {
      cartons:    { stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
      arrivages:  { stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
      accessoires:{ stockHier: 0, ajouteToday: 0, venduToday: 0, retourneToday: 0, renduToday: 0 },
    };

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

/* ---------- Dashboard totals (existant) ---------- */
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

    // ✅ Modification : Ne compte que les retours en attente d'envoi
    const retoursResult = await pool.query(`
      SELECT SUM(quantite_retournee) as total_retours
      FROM defective_returns
      WHERE status IS NULL OR status = 'en_attente'
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

/* ---------- NOUVEAU : Rapport journalier par PRODUIT ---------- */
/* Renvoie pour chaque produit :
   - stock_hier (reconstitué)
   - ajouts_jour  (entrées hors annulations)
   - rendus_jour  (entrées avec reason='annulation')
   - ventes_jour  (sorties)
   - retours_jour (retour défectueux)
   - stock_aujourdhui (stock actuel)
*/
exports.getRapportJournalierProduits = async (req, res) => {
  const { date } = req.query; // 'YYYY-MM-DD'
  const targetDate = date ? date : new Date().toISOString().slice(0, 10);

  try {
    // Stock actuel + info produit
    const produitsRes = await pool.query(`
      SELECT id AS product_id, marque, modele, stockage, type, type_carton, quantite_en_stock
      FROM products
    `);

    // Mouvements agrégés du jour par produit
    const mvtsRes = await pool.query(`
      SELECT 
        sm.product_id,
        COALESCE(SUM(CASE WHEN sm.movement_type IN ('entrée','entree') AND COALESCE(sm.reason,'') <> 'annulation' THEN sm.quantity_moved ELSE 0 END),0) AS ajouts_jour,
        COALESCE(SUM(CASE WHEN sm.movement_type IN ('entrée','entree') AND sm.reason = 'annulation' THEN sm.quantity_moved ELSE 0 END),0) AS rendus_jour,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'sortie' THEN sm.quantity_moved ELSE 0 END),0) AS ventes_jour,
        COALESCE(SUM(CASE WHEN sm.movement_type = 'retour' THEN sm.quantity_moved ELSE 0 END),0) AS retours_jour
      FROM stock_movements sm
      WHERE DATE(sm.movement_date) = $1
      GROUP BY sm.product_id
    `, [targetDate]);

    const mvtsParProduit = new Map();
    for (const r of mvtsRes.rows) {
      mvtsParProduit.set(Number(r.product_id), {
        ajouts_jour: Number(r.ajouts_jour) || 0,
        rendus_jour: Number(r.rendus_jour) || 0,
        ventes_jour: Number(r.ventes_jour) || 0,
        retours_jour: Number(r.retours_jour) || 0,
      });
    }

    // Construction du rapport par produit
    const rapport = produitsRes.rows.map(p => {
      const m = mvtsParProduit.get(Number(p.product_id)) || { ajouts_jour:0, rendus_jour:0, ventes_jour:0, retours_jour:0 };
      const stock_aujourdhui = Number(p.quantite_en_stock) || 0;

      // stock d'hier = stock aujourd'hui - entrées du jour (ajouts + rendus) + sorties du jour
      let stock_hier = stock_aujourdhui - (m.ajouts_jour + m.rendus_jour) + m.ventes_jour;
      if (stock_hier < 0) stock_hier = 0;

      return {
        product_id: p.product_id,
        marque: p.marque,
        modele: p.modele,
        stockage: p.stockage,
        type: p.type,
        type_carton: p.type_carton,
        stock_hier,
        ajouts_jour: m.ajouts_jour,
        ventes_jour: m.ventes_jour,
        retours_jour: m.retours_jour,
        rendus_jour: m.rendus_jour,
        stock_aujourdhui
      };
    });

    // On peut trier par marque puis modèle
    rapport.sort((a,b) => {
      const A = `${a.marque} ${a.modele} ${a.stockage || ''}`.toLowerCase();
      const B = `${b.marque} ${b.modele} ${b.stockage || ''}`.toLowerCase();
      return A.localeCompare(B);
    });

    res.status(200).json(rapport);
  } catch (error) {
    console.error('Erreur rapport journalier produits:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};