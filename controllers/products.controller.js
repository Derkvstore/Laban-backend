const pool = require('../db');

// Contrôleur pour la création d'un nouveau produit
exports.createProduct = async (req, res) => {
  const { marque, modele, stockage, type, quantite_en_stock, prix_achat, prix_vente_suggere, fournisseur_id, type_carton } = req.body;

  try {
    const newProduct = await pool.query(
      'INSERT INTO products (marque, modele, stockage, type, quantite_en_stock, prix_achat, prix_vente_suggere, fournisseur_id, type_carton) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [marque, modele, stockage, type, quantite_en_stock, prix_achat, prix_vente_suggere, fournisseur_id, type_carton]
    );

    await pool.query(
      `INSERT INTO stock_movements (product_id, movement_type, quantity_moved, reason, related_entity_id, related_entity_type)
       VALUES ($1, 'entree', $2, 'ajout', NULL, 'produit_cree')`,
      [newProduct.rows[0].id, quantite_en_stock]
    );

    res.status(201).json(newProduct.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la création d\'un produit:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour ajouter une quantité à un produit existant
exports.addProductQuantity = async (req, res) => {
    const { id } = req.params;
    const { quantite_ajoutee, fournisseur_id } = req.body;

    if (!quantite_ajoutee || quantite_ajoutee <= 0) {
        return res.status(400).json({ message: 'Quantité à ajouter invalide.' });
    }

    try {
        await pool.query('BEGIN');
        
        const existingProduct = await pool.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
        if (existingProduct.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: 'Produit non trouvé.' });
        }

        const currentProduct = existingProduct.rows[0];
        const newStock = currentProduct.quantite_en_stock + quantite_ajoutee;

        await pool.query(
            'UPDATE products SET quantite_en_stock = $1 WHERE id = $2 RETURNING *',
            [newStock, id]
        );

        await pool.query(
            `INSERT INTO stock_movements (product_id, movement_type, quantity_moved, reason, related_entity_id, related_entity_type, supplier_id)
             VALUES ($1, 'entree', $2, 'reapprovisionnement', NULL, 'produit_ajoute', $3)`,
            [id, quantite_ajoutee, fournisseur_id]
        );

        await pool.query('COMMIT');
        res.status(200).json({ message: 'Quantité ajoutée avec succès.' });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Erreur lors de l\'ajout de la quantité au produit:', error);
        res.status(500).json({ message: 'Erreur serveur interne.' });
    }
};


// Contrôleur pour récupérer tous les produits
exports.getAllProducts = async (req, res) => {
  try {
    const allProducts = await pool.query('SELECT * FROM products ORDER BY date_ajout DESC');
    res.status(200).json(allProducts.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour récupérer un produit par son ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.status(200).json(product.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour mettre à jour un produit
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { marque, modele, stockage, type, quantite_en_stock, prix_achat, prix_vente_suggere, fournisseur_id, type_carton } = req.body;
  try {
    const updatedProduct = await pool.query(
      'UPDATE products SET marque = $1, modele = $2, stockage = $3, type = $4, quantite_en_stock = $5, prix_achat = $6, prix_vente_suggere = $7, fournisseur_id = $8, type_carton = $9 WHERE id = $10 RETURNING *',
      [marque, modele, stockage, type, quantite_en_stock, prix_achat, prix_vente_suggere, fournisseur_id, type_carton, id]
    );
    if (updatedProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.status(200).json(updatedProduct.rows[0]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du produit:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour supprimer un produit
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedProduct = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
    if (deletedProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Produit non trouvé' });
    }
    res.status(200).json({ message: 'Produit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du produit:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};