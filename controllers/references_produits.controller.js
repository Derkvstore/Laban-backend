const pool = require('../db');

/**
 * POST /api/references_produits
 * Créer/activer une référence (marque, modèle, etc.)
 * Stratégie: upsert manuel (SELECT si existe -> UPDATE, sinon INSERT),
 * pour éviter ON CONFLICT sur un index d’expression.
 */
exports.createReference = async (req, res) => {
  const { marque, modele, stockage, type, type_carton, actif = true } = req.body;

  if (!marque || !modele) {
    return res.status(400).json({ message: "Les champs 'marque' et 'modele' sont requis." });
  }

  try {
    // 1) Chercher si une référence équivalente existe déjà (NULL traité comme '')
    const findSql = `
      SELECT id
      FROM references_produits
      WHERE marque = $1
        AND modele = $2
        AND COALESCE(stockage,'') = COALESCE($3,'')
        AND COALESCE(type,'') = COALESCE($4,'')
        AND COALESCE(type_carton,'') = COALESCE($5,'')
      LIMIT 1;
    `;
    const found = await pool.query(findSql, [
      marque,
      modele,
      stockage || null,
      type || null,
      type_carton || null
    ]);

    if (found.rows.length > 0) {
      // 2) Existe -> UPDATE actif
      const id = found.rows[0].id;
      const up = await pool.query(
        `UPDATE references_produits
         SET actif = $1
         WHERE id = $2
         RETURNING *;`,
        [!!actif, id]
      );
      return res.status(200).json(up.rows[0]);
    }

    // 3) N’existe pas -> INSERT
    const ins = await pool.query(
      `INSERT INTO references_produits (marque, modele, stockage, type, type_carton, actif)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [marque, modele, stockage || null, type || null, type_carton || null, !!actif]
    );
    return res.status(201).json(ins.rows[0]);

  } catch (error) {
    // En cas de concurrence, l’index unique peut lever 23505.
    // On rattrape et on refait un UPDATE.
    if (error && error.code === '23505') {
      try {
        const up2 = await pool.query(
          `UPDATE references_produits
           SET actif = $1
           WHERE marque = $2
             AND modele = $3
             AND COALESCE(stockage,'') = COALESCE($4,'')
             AND COALESCE(type,'') = COALESCE($5,'')
             AND COALESCE(type_carton,'') = COALESCE($6,'')
           RETURNING *;`,
          [!!(req.body.actif ?? true), marque, modele, stockage || null, type || null, type_carton || null]
        );
        if (up2.rows.length > 0) {
          return res.status(200).json(up2.rows[0]);
        }
      } catch (e2) {
        console.error("Erreur createReference (rattrapage 23505):", e2);
        return res.status(500).json({ message: "Erreur serveur interne", detail: e2?.detail || e2?.message });
      }
    }
    console.error("Erreur createReference:", error);
    return res.status(500).json({ message: "Erreur serveur interne", detail: error?.detail || error?.message });
  }
};

/**
 * GET /api/references_produits
 * Lister les références (filtre global ?q=)
 */
exports.getReferences = async (req, res) => {
  const { q } = req.query;
  try {
    let sql = `SELECT * FROM references_produits WHERE actif = TRUE`;
    const params = [];
    if (q) {
      sql += ` AND (marque ILIKE $1 OR modele ILIKE $1 OR COALESCE(stockage,'') ILIKE $1 OR COALESCE(type,'') ILIKE $1 OR COALESCE(type_carton,'') ILIKE $1)`;
      params.push(`%${q}%`);
    }
    sql += ` ORDER BY marque ASC, modele ASC`;
    const rs = await pool.query(sql, params);
    res.status(200).json(rs.rows);
  } catch (error) {
    console.error("Erreur getReferences:", error);
    res.status(500).json({ message: "Erreur serveur interne", detail: error?.detail || error?.message });
  }
};

/**
 * GET /api/references_produits/suggestions?champ=marque&q=ip
 * Renvoie un tableau de chaînes (valeurs DISTINCT) pour le champ demandé
 * Source: union des références + des valeurs existantes dans products.
 */
exports.getSuggestions = async (req, res) => {
  const { champ = 'marque', q = '' } = req.query;
  const autorises = new Set(['marque', 'modele', 'stockage', 'type', 'type_carton']);
  if (!autorises.has(champ)) {
    return res.status(400).json({ message: "Champ de suggestion invalide." });
  }
  try {
    const sql = `
      SELECT DISTINCT ${champ} AS valeur
      FROM (
        SELECT ${champ} FROM references_produits WHERE actif = TRUE
        UNION ALL
        SELECT ${champ} FROM products
      ) t
      WHERE ${champ} IS NOT NULL AND ${champ} <> ''
        AND ${champ} ILIKE $1
      ORDER BY ${champ} ASC
      LIMIT 50;
    `;
    const rs = await pool.query(sql, [`%${q}%`]);
    res.status(200).json(rs.rows.map(r => r.valeur));
  } catch (error) {
    console.error("Erreur getSuggestions:", error);
    res.status(500).json({ message: "Erreur serveur interne", detail: error?.detail || error?.message });
  }
};

/**
 * GET /api/references_produits/distinct
 * Renvoie { marques:[], modeles:[], stockages:[], types:[], type_cartons:[] }
 */
exports.getAllDistinct = async (_req, res) => {
  try {
    const champs = ['marque', 'modele', 'stockage', 'type', 'type_carton'];
    const result = {};
    for (const c of champs) {
      const rs = await pool.query(`
        SELECT DISTINCT ${c} AS valeur
        FROM (
          SELECT ${c} FROM references_produits WHERE actif = TRUE
          UNION ALL
          SELECT ${c} FROM products
        ) t
        WHERE ${c} IS NOT NULL AND ${c} <> ''
        ORDER BY ${c} ASC
        LIMIT 300;
      `);
      result[`${c}s`] = rs.rows.map(r => r.valeur);
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Erreur getAllDistinct:", error);
    res.status(500).json({ message: "Erreur serveur interne", detail: error?.detail || error?.message });
  }
};
