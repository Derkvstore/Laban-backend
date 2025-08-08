// Importe le module Pool de 'pg'
const { Pool } = require('pg');
// Importe le module dotenv pour gérer les variables d'environnement
const dotenv = require('dotenv');

// Charge les variables d'environnement
dotenv.config();

// Crée et exporte un nouveau Pool de connexions
// Cela permet de centraliser la gestion de la base de données
// et de réutiliser la connexion dans toute l'application.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Exporte le pool pour qu'il puisse être utilisé par d'autres fichiers
module.exports = pool;
