// Importe le pool de connexion à la base de données
const pool = require('../db');

// Contrôleur pour la création d'un nouveau client
exports.createClient = async (req, res) => {
  const { nom, telephone, adresse } = req.body;

  try {
    // Requête SQL pour insérer un nouveau client
    const newClient = await pool.query(
      'INSERT INTO clients (nom, telephone, adresse) VALUES ($1, $2, $3) RETURNING *',
      [nom, telephone, adresse]
    );
    res.status(201).json(newClient.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création d\'un client:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer tous les clients
exports.getAllClients = async (req, res) => {
  try {
    const allClients = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.status(200).json(allClients.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des clients:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer un client par son ID
exports.getClientById = async (req, res) => {
  const { id } = req.params;

  try {
    const client = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (client.rows.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    res.status(200).json(client.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du client:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour un client
exports.updateClient = async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse } = req.body;

  try {
    const updatedClient = await pool.query(
      'UPDATE clients SET nom = $1, telephone = $2, adresse = $3 WHERE id = $4 RETURNING *',
      [nom, telephone, adresse, id]
    );
    if (updatedClient.rows.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    res.status(200).json(updatedClient.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du client:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour supprimer un client
exports.deleteClient = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedClient = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (deletedClient.rows.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    res.status(200).json({ message: 'Client supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du client:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
