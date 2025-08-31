// Importe jsonwebtoken pour la vérification des tokens
const jwt = require('jsonwebtoken');

// Middleware d'authentification pour protéger les routes
module.exports = (req, res, next) => {
  try {
    // Récupère le token de l'en-tête Authorization
    const token = req.headers.authorization.split(' ')[1];
    // Vérifie et décode le token à l'aide de la clé secrète
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    // Extrait l'ID utilisateur du token décodé
    const { userId } = decodedToken;
    // Ajoute l'ID utilisateur à l'objet de requête pour une utilisation ultérieure
    req.auth = { userId };
    // Passe au middleware ou à la route suivante
    next();
  } catch (error) {
    // Si la vérification échoue, renvoie une erreur 401 (Non autorisé)
    res.status(401).json({
      message: 'Requête non authentifiée !',
    });
  }
};
