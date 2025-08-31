const pool = require('../db');

// Normalise les lignes envoyées depuis le frontend (items | lignes | retours | retours_ids)
function extraireIdsDepuisCorps(corps) {
  const candidat =
    corps?.items ??
    corps?.lignes ??
    corps?.retours ??
    corps?.retours_ids ??
    [];
  // Accepte soit [{retour_id: 1}, ...] soit [1,2,3]
  return (Array.isArray(candidat) ? candidat : [])
    .map(x => (typeof x === 'object' && x !== null ? x.retour_id : x))
    .filter(Boolean);
}

// POST /api/retours-fournisseurs
exports.creerEnvoiFournisseur = async (req, res) => {
  const { numero_dossier = null, date_envoi = null, observation = null } = req.body || {};
  const ids = extraireIdsDepuisCorps(req.body);

  if (!ids.length) {
    return res.status(400).json({ message: 'Aucune ligne de retour fournie.' });
  }

  try {
    await pool.query('BEGIN');

    // Vérifie l’existence des retours
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const verif = await pool.query(
      `SELECT id FROM defective_returns WHERE id IN (${placeholders})`,
      ids
    );
    if (verif.rows.length !== ids.length) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Certains retours défectueux sont introuvables.' });
    }

    // Marque ces retours comme "envoyés au fournisseur"
    await pool.query(
      `UPDATE defective_returns
       SET status = 'envoye_fournisseur'
       WHERE id IN (${placeholders})`,
      ids
    );

    // (Optionnel) Tu pourras plus tard persister numero_dossier/date_envoi/observation
    // dans une table dédiée si tu veux un historisation détaillée.

    await pool.query('COMMIT');
    return res.status(201).json({
      message: 'Retours transmis au fournisseur.',
      retours_ids: ids,
      numero_dossier,
      date_envoi,
      observation
    });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Erreur envoi fournisseur:', e);
    return res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// GET /api/retours-fournisseurs
exports.listerEnvoisFournisseur = async (_req, res) => {
  try {
    // On liste les retours marqués "envoye_fournisseur"
    const { rows } = await pool.query(`
      SELECT
        dr.id,
        dr.quantite_retournee,
        dr.reason,
        dr.return_date,
        dr.status,
        p.marque,
        p.modele,
        p.stockage,
        p.type,
        p.type_carton,
        c.id   AS client_id,
        c.nom  AS client_nom
      FROM defective_returns dr
      LEFT JOIN products p ON p.id = dr.product_id
      LEFT JOIN LATERAL (
        SELECT vi.*
        FROM vente_items vi
        WHERE vi.product_id = dr.product_id
        ORDER BY vi.id DESC
        LIMIT 1
      ) vi ON TRUE
      LEFT JOIN ventes v  ON v.id  = vi.vente_id
      LEFT JOIN clients c ON c.id  = v.client_id
      WHERE dr.status = 'envoye_fournisseur'
      ORDER BY dr.return_date DESC
    `);

    return res.status(200).json(rows);
  } catch (e) {
    console.error('Erreur listage retours fournisseur:', e);
    return res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
