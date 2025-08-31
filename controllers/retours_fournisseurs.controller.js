const pool = require('../db');

/**
 * Créer un ou plusieurs retours vers fournisseur.
 * Corps attendu:
 *  - fournisseur_id (optionnel)
 *  - numero_dossier (optionnel)
 *  - observation (optionnel)
 *  - date_envoi (optionnel)
 *  - lignes: [
 *      { product_id, quantite_retournee, raison, defective_return_id (optionnel) }
 *    ]
 *  OU bien un seul retour à plat sans "lignes".
 */
exports.creerRetourFournisseur = async (req, res) => {
  const { fournisseur_id, numero_dossier, observation, date_envoi } = req.body;
  let { lignes } = req.body;

  // Support d'un seul objet (sans tableau)
  if (!Array.isArray(lignes)) {
    const { product_id, quantite_retournee, raison, defective_return_id } = req.body;
    if (product_id && quantite_retournee && raison) {
      lignes = [{ product_id, quantite_retournee, raison, defective_return_id }];
    }
  }

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ message: "Aucune ligne de retour fournie." });
  }

  try {
    await pool.query('BEGIN');

    if (fournisseur_id) {
      const f = await pool.query('SELECT id FROM fournisseurs WHERE id = $1', [fournisseur_id]);
      if (f.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: "Fournisseur introuvable." });
      }
    }

    const ins = [];
    for (const l of lignes) {
      const { product_id, quantite_retournee, raison, defective_return_id } = l;

      // Contrôles de base
      const p = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
      if (p.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: `Produit ${product_id} introuvable.` });
      }
      if (defective_return_id) {
        const d = await pool.query('SELECT id FROM defective_returns WHERE id = $1', [defective_return_id]);
        if (d.rows.length === 0) {
          await pool.query('ROLLBACK');
          return res.status(404).json({ message: `defective_return_id ${defective_return_id} introuvable.` });
        }
      }

      // Insertion du retour fournisseur
      const statut = date_envoi ? 'envoye' : 'en_attente_envoi';
      const row = await pool.query(
        `INSERT INTO retours_fournisseurs
          (fournisseur_id, product_id, defective_return_id, quantite_retournee, raison, numero_dossier, observation, date_envoi, statut_retour_fournisseur)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          fournisseur_id || null,
          product_id,
          defective_return_id || null,
          quantite_retournee,
          raison,
          numero_dossier || null,
          observation || null,
          date_envoi || null,
          statut
        ]
      );

      // Traçabilité du mouvement (ne touche pas au stock dispo)
      await pool.query(
        `INSERT INTO stock_movements
           (product_id, movement_type, quantity_moved, movement_date, reason, related_entity_id, related_entity_type)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
        [
          product_id,
          'retour_fournisseur',
          quantite_retournee,
          'defectueux',
          row.rows[0].id,
          'retours_fournisseurs'
        ]
      );

      ins.push(row.rows[0]);
    }

    await pool.query('COMMIT');
    res.status(201).json({ message: "Retour(s) fournisseur créé(s).", retours: ins });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Erreur création retour fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};

/**
 * Liste paginée simple (joins utiles pour l'UI)
 * Query string possible: ?q=... (recherche par marque/modèle), ?statut=...
 */
exports.listerRetoursFournisseurs = async (req, res) => {
  const { q, statut } = req.query;
  const clauses = [];
  const params = [];
  let i = 1;

  if (statut) {
    clauses.push(`rf.statut_retour_fournisseur = $${i++}`);
    params.push(statut);
  }
  if (q) {
    clauses.push(`(LOWER(p.marque) LIKE $${i} OR LOWER(p.modele) LIKE $${i})`);
    params.push(`%${q.toLowerCase()}%`);
    i++;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  try {
    const rows = await pool.query(
      `
      SELECT
        rf.*,
        f.nom AS fournisseur_nom,
        p.marque, p.modele, p.stockage, p.type, p.type_carton
      FROM retours_fournisseurs rf
      LEFT JOIN fournisseurs f ON rf.fournisseur_id = f.id
      JOIN products p ON rf.product_id = p.id
      ${where}
      ORDER BY rf.date_envoi DESC, rf.id DESC
      `,
      params
    );
    res.status(200).json(rows.rows);
  } catch (error) {
    console.error("Erreur liste retours fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};

/**
 * Détail par id
 */
exports.lireRetourFournisseur = async (req, res) => {
  const { id } = req.params;
  try {
    const row = await pool.query(
      `
      SELECT
        rf.*,
        f.nom AS fournisseur_nom,
        p.marque, p.modele, p.stockage, p.type, p.type_carton
      FROM retours_fournisseurs rf
      LEFT JOIN fournisseurs f ON rf.fournisseur_id = f.id
      JOIN products p ON rf.product_id = p.id
      WHERE rf.id = $1
      `,
      [id]
    );
    if (row.rows.length === 0) {
      return res.status(404).json({ message: "Retour fournisseur introuvable." });
    }
    res.status(200).json(row.rows[0]);
  } catch (error) {
    console.error("Erreur lecture retour fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};

/**
 * Mise à jour du statut.
 * Corps attendu:
 *  - statut_retour_fournisseur (requis)
 *  - date_reception (optionnel)
 *  - reintegrer_stock (optionnel boolean)
 *  - observation (optionnel)
 *
 * Si statut = remplace|repare et reintegrer_stock = true:
 *  -> +quantité au stock produit
 *  -> mouvement 'entrée' avec reason 'remplacement_fournisseur' ou 'reparation_fournisseur'
 */
exports.mettreAJourStatutRetourFournisseur = async (req, res) => {
  const { id } = req.params;
  const { statut_retour_fournisseur, date_reception, reintegrer_stock, observation } = req.body;

  if (!statut_retour_fournisseur) {
    return res.status(400).json({ message: "statut_retour_fournisseur est requis." });
  }

  try {
    await pool.query('BEGIN');

    const rf = await pool.query('SELECT * FROM retours_fournisseurs WHERE id = $1', [id]);
    if (rf.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: "Retour fournisseur introuvable." });
    }
    const courant = rf.rows[0];

    // Mise à jour de base
    const maj = await pool.query(
      `UPDATE retours_fournisseurs
         SET statut_retour_fournisseur = $1,
             date_reception = COALESCE($2, date_reception),
             observation = COALESCE($3, observation)
       WHERE id = $4
       RETURNING *`,
      [
        statut_retour_fournisseur,
        date_reception || null,
        observation || null,
        id
      ]
    );

    // Réintégration stock si demandé
    if (reintegrer_stock === true &&
        (statut_retour_fournisseur === 'remplace' || statut_retour_fournisseur === 'repare')) {
      await pool.query(
        'UPDATE products SET quantite_en_stock = quantite_en_stock + $1 WHERE id = $2',
        [courant.quantite_retournee, courant.product_id]
      );

      const reason = (statut_retour_fournisseur === 'remplace')
        ? 'remplacement_fournisseur'
        : 'reparation_fournisseur';

      await pool.query(
        `INSERT INTO stock_movements
           (product_id, movement_type, quantity_moved, movement_date, reason, related_entity_id, related_entity_type)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
        [
          courant.product_id,
          'entrée',
          courant.quantite_retournee,
          reason,
          courant.id,
          'retours_fournisseurs'
        ]
      );
    }

    await pool.query('COMMIT');
    res.status(200).json({ message: "Statut mis à jour.", retour: maj.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Erreur MAJ statut retour fournisseur:", error);
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};
