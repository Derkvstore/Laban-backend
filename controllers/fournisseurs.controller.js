// Importe le pool de connexion à la base de données
const pool = require('../db');

// Contrôleur pour la création d'un nouveau fournisseur
exports.createFournisseur = async (req, res) => {
  const { nom, telephone, adresse } = req.body;

  try {
    // Requête SQL pour insérer un nouveau fournisseur
    const newFournisseur = await pool.query(
      'INSERT INTO fournisseurs (nom, telephone, adresse) VALUES ($1, $2, $3) RETURNING *',
      [nom, telephone, adresse]
    );
    res.status(201).json(newFournisseur.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création d\'un fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer tous les fournisseurs
exports.getAllFournisseurs = async (req, res) => {
  try {
    const allFournisseurs = await pool.query('SELECT * FROM fournisseurs ORDER BY date_ajout DESC');
    res.status(200).json(allFournisseurs.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer un fournisseur par son ID
exports.getFournisseurById = async (req, res) => {
  const { id } = req.params;

  try {
    const fournisseur = await pool.query('SELECT * FROM fournisseurs WHERE id = $1', [id]);
    if (fournisseur.rows.length === 0) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }
    res.status(200).json(fournisseur.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour un fournisseur
exports.updateFournisseur = async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse } = req.body;

  try {
    const updatedFournisseur = await pool.query(
      'UPDATE fournisseurs SET nom = $1, telephone = $2, adresse = $3 WHERE id = $4 RETURNING *',
      [nom, telephone, adresse, id]
    );
    if (updatedFournisseur.rows.length === 0) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }
    res.status(200).json(updatedFournisseur.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour supprimer un fournisseur
exports.deleteFournisseur = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedFournisseur = await pool.query('DELETE FROM fournisseurs WHERE id = $1 RETURNING *', [id]);
    if (deletedFournisseur.rows.length === 0) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }
    res.status(200).json({ message: 'Fournisseur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du fournisseur:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
