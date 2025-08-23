const pool = require('../db');

// GET /api/benefices?date=YYYY-MM-DD
//    ou /api/benefices?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
exports.getBenefices = async (req, res) => {
  const { startDate, endDate, date } = req.query;

  try {
    const where = [];
    const params = [];

    // 1) Uniquement les items réellement VENDUS (donc payés)
    where.push(`vi.statut_vente_item = 'vendu'`);
    // Optionnel: sécurité supplémentaire si tu veux t'assurer que la vente est marquée payée
    where.push(`v.statut_paiement = 'payé'`);

    // 2) Filtres de date
    if (date) {
      // Filtre sur le jour exact (peu importe l'heure)
      params.push(date);
      where.push(`DATE(v.date_vente) = $${params.length}::date`);
    } else {
      if (startDate) {
        params.push(startDate);
        where.push(`v.date_vente >= $${params.length}::timestamp`);
      }
      if (endDate) {
        // EndDate inclus (jusqu'à 23:59:59)
        params.push(endDate);
        where.push(`v.date_vente < ($${params.length}::timestamp + INTERVAL '1 day')`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // 3) Totaux
    const totalsSql = `
      SELECT
        COALESCE(SUM(vi.quantite_vendue * vi.prix_unitaire_negocie), 0) AS total_ventes,
        COALESCE(SUM(vi.quantite_vendue * vi.prix_unitaire_achat_au_moment_vente), 0) AS total_achats
      FROM vente_items vi
      JOIN ventes v ON vi.vente_id = v.id
      ${whereSql}
    `;

    // 4) Détail par ligne vendue (pour l’affichage du tableau)
    const itemsSql = `
      SELECT
        vi.id AS vente_item_id,
        v.id  AS vente_id,
        c.id  AS client_id,
        c.nom AS client_nom,
        v.date_vente,

        vi.marque,
        vi.modele,
        vi.stockage,
        vi.type,
        vi.type_carton,

        vi.quantite_vendue,
        vi.prix_unitaire_achat_au_moment_vente AS prix_unitaire_achat,
        vi.prix_unitaire_negocie                AS prix_unitaire_vente,

        (vi.prix_unitaire_negocie - vi.prix_unitaire_achat_au_moment_vente)
          AS benefice_unitaire_produit,
        (vi.quantite_vendue * (vi.prix_unitaire_negocie - vi.prix_unitaire_achat_au_moment_vente))
          AS benefice_total_par_ligne
      FROM vente_items vi
      JOIN ventes v   ON vi.vente_id = v.id
      JOIN clients c  ON v.client_id = c.id
      ${whereSql}
      ORDER BY v.date_vente DESC, vi.id DESC
    `;

    const [totalsRes, itemsRes] = await Promise.all([
      pool.query(totalsSql, params),
      pool.query(itemsSql, params),
    ]);

    const total_ventes  = Number(totalsRes.rows[0]?.total_ventes || 0);
    const total_achats  = Number(totalsRes.rows[0]?.total_achats || 0);
    const benefice_brut = total_ventes - total_achats;

    return res.status(200).json({
      total_ventes,
      total_achats,
      benefice_brut,
      total_benefice_global: benefice_brut, // alias pratique côté front
      sold_items: itemsRes.rows,            // lignes détaillées uniquement "vendu"
    });
  } catch (error) {
    console.error('Erreur lors du calcul des bénéfices:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
