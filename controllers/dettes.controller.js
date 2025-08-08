const pool = require('../db');

// Contrôleur pour récupérer toutes les dettes (ventes avec un paiement partiel)
exports.getAllDettes = async (req, res) => {
  try {
    const dettes = await pool.query(`
      SELECT
        v.id,
        c.nom AS client_nom,
        c.telephone AS client_telephone,
        v.date_vente,
        v.montant_total,
        v.montant_paye,
        (v.montant_total - v.montant_paye) AS montant_restant,
        v.statut_paiement
      FROM ventes v
      JOIN clients c ON v.client_id = c.id
      WHERE v.statut_paiement = 'en_attente' OR v.statut_paiement = 'paiement_partiel'
      ORDER BY v.date_vente DESC
    `);
    res.status(200).json(dettes.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des dettes:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer les dettes d'un client spécifique
exports.getDettesByClient = async (req, res) => {
  const { clientId } = req.params;
  try {
    const dettes = await pool.query(`
      SELECT
        v.id,
        v.date_vente,
        v.montant_total,
        v.montant_paye,
        (v.montant_total - v.montant_paye) AS montant_restant,
        v.statut_paiement
      FROM ventes v
      WHERE v.client_id = $1
      AND (v.statut_paiement = 'en_attente' OR v.statut_paiement = 'paiement_partiel')
      ORDER BY v.date_vente DESC
    `, [clientId]);
    res.status(200).json(dettes.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des dettes du client:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
