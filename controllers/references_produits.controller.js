const pool = require('../db');

/**
 * POST /api/references_produits
 * Créer/activer une référence (marque, modèle, etc.)
 */
exports.createReference = async (req, res) => {
  const { marque, modele, stockage, type, type_carton, actif = true } = req.body;

  if (!marque || !modele) {
    return res.status(400).json({ message: "Les champs 'marque' et 'modele' sont requis." });
  }

  try {
    const sql = `
      INSERT INTO references_produits (marque, modele, stockage, type, type_carton, actif)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ON CONSTRAINT uq_references_produits
      DO UPDATE SET actif = EXCLUDED.actif
      RETURNING *;
    `;
    const rs = await pool.query(sql, [
      marque,
      modele,
      stockage || null,
      type || null,
      type_carton || null,
      !!actif
    ]);
    res.status(201).json(rs.rows[0]);
  } catch (error) {
    console.error("Erreur createReference:", error);
    res.status(500).json({ message: "Erreur serveur interne" });
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
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};

/**
 * GET /api/references_produits/suggestions?champ=marque&q=ip
 * Renvoie un tableau de chaînes (valeurs DISTINCT) pour le champ demandé
 * Source: union des références + des valeurs existantes dans products (pratique pour bootstrap).
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
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};

/**
 * GET /api/references_produits/distinct
 * Renvoie { marques:[], modeles:[], stockages:[], types:[], types_carton:[] }
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
    res.status(500).json({ message: "Erreur serveur interne" });
  }
};
