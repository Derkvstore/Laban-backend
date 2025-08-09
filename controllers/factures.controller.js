const pool = require('../db');

// Contrôleur pour la création d'une nouvelle facture à partir d'une vente
exports.createFacture = async (req, res) => {
  const { vente_id, numero_facture } = req.body;
  try {
    // Vérifie si la vente existe
    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);
    if (vente.rows.length === 0) {
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    const { montant_total, montant_paye } = vente.rows[0];
    const montant_actuel_du = montant_total - montant_paye;

    // Crée la facture dans la table "factures"
    const newFacture = await pool.query(
      'INSERT INTO factures (vente_id, numero_facture, montant_original_facture, montant_actuel_du, montant_paye_facture) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [vente_id, numero_facture, montant_total, montant_actuel_du, montant_paye]
    );

    res.status(201).json(newFacture.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer toutes les factures
exports.getAllFactures = async (req, res) => {
  try {
    const allFactures = await pool.query('SELECT * FROM factures ORDER BY date_facture DESC');
    res.status(200).json(allFactures.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer une facture par son ID
exports.getFactureById = async (req, res) => {
  const { id } = req.params;
  try {
    const facture = await pool.query('SELECT * FROM factures WHERE id = $1', [id]);
    if (facture.rows.length === 0) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    res.status(200).json(facture.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour une facture
exports.updateFacture = async (req, res) => {
  const { id } = req.params;
  const { numero_facture, montant_paye_facture, statut_facture, observation } = req.body;
  try {
    const updatedFacture = await pool.query(
      'UPDATE factures SET numero_facture = $1, montant_paye_facture = $2, statut_facture = $3, observation = $4 WHERE id = $5 RETURNING *',
      [numero_facture, montant_paye_facture, statut_facture, observation, id]
    );
    if (updatedFacture.rows.length === 0) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    res.status(200).json(updatedFacture.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la facture:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour annuler une facture
exports.cancelFacture = async (req, res) => {
  const { id } = req.params;
  const { raison_annulation } = req.body;

  try {
    const cancelledFacture = await pool.query(
      'UPDATE factures SET statut_facture = $1, date_annulation = now(), raison_annulation = $2 WHERE id = $3 RETURNING *',
      ['annulée', raison_annulation, id]
    );
    if (cancelledFacture.rows.length === 0) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    res.status(200).json({ message: 'Facture annulée avec succès', facture: cancelledFacture.rows[0] });
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la facture:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
