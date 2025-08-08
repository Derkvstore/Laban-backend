// Importe le pool de connexion à la base de données
const pool = require('../db');

// Contrôleur pour la création d'une nouvelle vente
exports.createVente = async (req, res) => {
  const { client_id, vente_items } = req.body;
  const client = await pool.query('SELECT * FROM clients WHERE id = $1', [client_id]);

  if (client.rows.length === 0) {
    return res.status(404).json({ message: 'Client non trouvé' });
  }

  let totalAmount = 0;

  try {
    // Démarre une transaction pour s'assurer que toutes les opérations réussissent ou échouent ensemble
    await pool.query('BEGIN');

    // Calcule le montant total de la vente
    for (const item of vente_items) {
      const product = await pool.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (product.rows.length === 0 || product.rows[0].quantite_en_stock < item.quantite_vendue) {
        throw new Error('Stock insuffisant pour un produit');
      }
      totalAmount += item.prix_unitaire_negocie * item.quantite_vendue;
    }

    // Crée la vente dans la table "ventes"
    const newSale = await pool.query(
      'INSERT INTO ventes (client_id, montant_total, montant_paye) VALUES ($1, $2, $3) RETURNING *',
      [client_id, totalAmount, 0] // Paiement initial à 0, le statut sera "en_attente"
    );

    const venteId = newSale.rows[0].id;

    // Insère chaque produit vendu dans la table "vente_items" et met à jour le stock
    for (const item of vente_items) {
      const product = await pool.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      await pool.query(
        'INSERT INTO vente_items (vente_id, product_id, quantite_vendue, prix_unitaire_negocie, prix_unitaire_achat_au_moment_vente, marque, modele, stockage, type, type_carton) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [venteId, item.product_id, item.quantite_vendue, item.prix_unitaire_negocie, product.rows[0].prix_achat, product.rows[0].marque, product.rows[0].modele, product.rows[0].stockage, product.rows[0].type, product.rows[0].type_carton]
      );
      // Met à jour le stock en décrémentant la quantité
      await pool.query(
        'UPDATE products SET quantite_en_stock = quantite_en_stock - $1 WHERE id = $2',
        [item.quantite_vendue, item.product_id]
      );
    }

    // Valide la transaction
    await pool.query('COMMIT');
    res.status(201).json({ message: 'Vente créée avec succès', vente: newSale.rows[0] });

  } catch (error) {
    // En cas d'erreur, annule toutes les opérations
    await pool.query('ROLLBACK');
    console.error('Erreur lors de la création de la vente:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// Contrôleur pour annuler un produit d'une vente (détail)
exports.cancelVenteItem = async (req, res) => {
  const { vente_item_id } = req.body;
  
  try {
    await pool.query('BEGIN');
    const venteItem = await pool.query('SELECT * FROM vente_items WHERE id = $1 AND statut_vente_item = $2', [vente_item_id, 'actif']);
    
    if (venteItem.rows.length === 0) {
      return res.status(404).json({ message: 'Produit de la vente non trouvé ou déjà annulé' });
    }

    const { product_id, quantite_vendue } = venteItem.rows[0];
    
    // Met à jour le statut du vente_item
    await pool.query('UPDATE vente_items SET statut_vente_item = $1, cancellation_reason = $2 WHERE id = $3', ['annulé', 'Annulation demandée par le client', vente_item_id]);

    // Rétablit le stock du produit
    await pool.query('UPDATE products SET quantite_en_stock = quantite_en_stock + $1 WHERE id = $2', [quantite_vendue, product_id]);

    // Recalcule le montant total de la vente
    const venteId = venteItem.rows[0].vente_id;
    const items = await pool.query('SELECT * FROM vente_items WHERE vente_id = $1 AND statut_vente_item = $2', [venteId, 'actif']);
    let newTotalAmount = 0;
    for (const item of items.rows) {
      newTotalAmount += item.prix_unitaire_negocie * item.quantite_vendue;
    }
    await pool.query('UPDATE ventes SET montant_total = $1 WHERE id = $2', [newTotalAmount, venteId]);

    await pool.query('COMMIT');
    res.status(200).json({ message: 'Produit de la vente annulé avec succès' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erreur lors de l\'annulation du produit:', error.message);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour effectuer un paiement partiel ou total pour une vente
exports.makePayment = async (req, res) => {
  const { vente_id, montant_paye } = req.body;

  try {
    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);

    if (vente.rows.length === 0) {
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    const currentVente = vente.rows[0];
    const newPaidAmount = parseFloat(currentVente.montant_paye) + parseFloat(montant_paye);

    // Vérifie que le paiement ne dépasse pas le montant total
    if (newPaidAmount > currentVente.montant_total) {
      return res.status(400).json({ message: 'Le montant payé dépasse le montant total de la vente' });
    }

    // Détermine le nouveau statut de paiement
    const newStatus = newPaidAmount === currentVente.montant_total ? 'payé' : 'paiement_partiel';

    // Met à jour la vente
    const updatedVente = await pool.query(
      'UPDATE ventes SET montant_paye = $1, statut_paiement = $2 WHERE id = $3 RETURNING *',
      [newPaidAmount, newStatus, vente_id]
    );

    res.status(200).json({ message: 'Paiement effectué avec succès', vente: updatedVente.rows[0] });

  } catch (error) {
    console.error('Erreur lors du paiement de la vente:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour gérer le retour d'un mobile défectueux
exports.returnDefectiveProduct = async (req, res) => {
  const { vente_item_id, reason, quantite_retournee } = req.body;

  try {
    await pool.query('BEGIN');
    const venteItem = await pool.query('SELECT * FROM vente_items WHERE id = $1', [vente_item_id]);

    if (venteItem.rows.length === 0) {
      return res.status(404).json({ message: 'Produit de la vente non trouvé' });
    }

    const { product_id, vente_id } = venteItem.rows[0];
    
    // Insère le retour dans la table "defective_returns"
    const newReturn = await pool.query(
      'INSERT INTO defective_returns (product_id, quantite_retournee, reason) VALUES ($1, $2, $3) RETURNING *',
      [product_id, quantite_retournee, reason]
    );

    // Met à jour le statut du vente_item pour refléter le retour
    await pool.query(
      'UPDATE vente_items SET statut_vente_item = $1 WHERE id = $2',
      ['retourné', vente_item_id]
    );

    // Diminue le montant total de la vente
    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);
    const updatedVenteAmount = parseFloat(vente.rows[0].montant_total) - (venteItem.rows[0].prix_unitaire_negocie * quantite_retournee);
    await pool.query('UPDATE ventes SET montant_total = $1 WHERE id = $2', [updatedVenteAmount, vente_id]);

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Retour de produit défectueux enregistré', retour: newReturn.rows[0] });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erreur lors de l\'enregistrement du retour:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
