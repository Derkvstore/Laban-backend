const pool = require('../db');

// Contrôleur pour calculer les bénéfices sur une période donnée
exports.getBenefices = async (req, res) => {
  // Les dates sont optionnelles, si non fournies, on prend toutes les ventes
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT
        SUM(vi.quantite_vendue * vi.prix_unitaire_negocie) AS total_ventes,
        SUM(vi.quantite_vendue * vi.prix_unitaire_achat_au_moment_vente) AS total_achats
      FROM vente_items vi
      JOIN ventes v ON vi.vente_id = v.id
      WHERE vi.statut_vente_item = 'actif'
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Ajoute la condition de date si elle est fournie
    if (startDate && endDate) {
      query += ` AND v.date_vente BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      queryParams.push(startDate, endDate);
    }
    
    // Ajoute la condition pour exclure les ventes annulées
    query += ` AND v.statut_paiement != 'annulé'`;

    const result = await pool.query(query, queryParams);

    const { total_ventes, total_achats } = result.rows[0];

    const beneficeBrut = (parseFloat(total_ventes) || 0) - (parseFloat(total_achats) || 0);

    res.status(200).json({
      total_ventes: parseFloat(total_ventes) || 0,
      total_achats: parseFloat(total_achats) || 0,
      benefice_brut: beneficeBrut
    });

  } catch (error) {
    console.error('Erreur lors du calcul des bénéfices:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
