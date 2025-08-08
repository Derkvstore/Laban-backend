// Importe le pool de connexion à la base de données
const pool = require('../db');
// Importe bcrypt pour le hachage des mots de passe
const bcrypt = require('bcrypt');
// Importe jsonwebtoken pour la création de tokens d'authentification
const jwt = require('jsonwebtoken');

// Logique pour la connexion des utilisateurs
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Recherche de l'utilisateur dans la base de données par son nom d'utilisateur
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    // Si aucun utilisateur n'est trouvé, renvoie une erreur 401 (Non autorisé)
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    const user = userResult.rows[0];

    // 2. Comparaison du mot de passe fourni avec le hachage stocké dans la base de données
    const validPassword = await bcrypt.compare(password, user.password_hash);

    // Si le mot de passe n'est pas valide, renvoie une erreur 401
    if (!validPassword) {
      return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // 3. Si l'utilisateur est authentifié, crée un token JWT
    // Le token inclut l'ID de l'utilisateur, son nom d'utilisateur et son rôle.
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.SECRET_KEY,
      { expiresIn: '1h' } // Le token expire après 1 heure
    );

    // 4. Renvoie le token et les informations de l'utilisateur
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        email: user.email
      },
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
