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
    await pool.query('BEGIN');

    // Calcule le montant total de la vente
    for (const item of vente_items) {
      const product = await pool.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      if (product.rows.length === 0 || product.rows[0].quantite_en_stock < item.quantite_vendue) {
        throw new Error('Stock insuffisant pour un produit');
      }
      totalAmount += item.prix_unitaire_negocie * item.quantite_vendue;
    }

    // Crée la vente
    const newSale = await pool.query(
      'INSERT INTO ventes (client_id, montant_total, montant_paye) VALUES ($1, $2, $3) RETURNING *',
      [client_id, totalAmount, 0]
    );

    const venteId = newSale.rows[0].id;

    // Insère les items et décrémente le stock
    for (const item of vente_items) {
      const product = await pool.query('SELECT * FROM products WHERE id = $1', [item.product_id]);
      await pool.query(
        'INSERT INTO vente_items (vente_id, product_id, quantite_vendue, prix_unitaire_negocie, prix_unitaire_achat_au_moment_vente, marque, modele, stockage, type, type_carton) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [venteId, item.product_id, item.quantite_vendue, item.prix_unitaire_negocie, product.rows[0].prix_achat, product.rows[0].marque, product.rows[0].modele, product.rows[0].stockage, product.rows[0].type, product.rows[0].type_carton]
      );
      await pool.query(
        'UPDATE products SET quantite_en_stock = quantite_en_stock - $1 WHERE id = $2',
        [item.quantite_vendue, item.product_id]
      );
    }

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Vente créée avec succès', vente: newSale.rows[0] });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Erreur lors de la création de la vente:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// Nouvelle fonction pour récupérer toutes les ventes
exports.getAllVentes = async (req, res) => {
  try {
    const allVentes = await pool.query('SELECT * FROM ventes ORDER BY date_vente DESC');
    res.status(200).json(allVentes.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des ventes:', error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// Contrôleur pour annuler un produit d'une vente (détail)
exports.cancelVenteItem = async (req, res) => {
  const { vente_item_id, cancellation_reason } = req.body;

  try {
    await pool.query('BEGIN');

    // ⬇️ Autoriser l'annulation si l'item est 'actif' OU 'vendu'
    const venteItem = await pool.query(
      `SELECT * FROM vente_items 
       WHERE id = $1 AND statut_vente_item IN ('actif','vendu')`,
      [vente_item_id]
    );

    if (venteItem.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Produit de la vente non trouvé ou déjà annulé/retourné' });
    }

    const { product_id, quantite_vendue, prix_unitaire_negocie, vente_id } = venteItem.rows[0];

    // Marque l'item comme annulé + raison
    await pool.query(
      'UPDATE vente_items SET statut_vente_item = $1, cancellation_reason = $2 WHERE id = $3',
      ['annulé', cancellation_reason || 'Annulation demandée par le client', vente_item_id]
    );

    // Rétablit le stock
    await pool.query(
      'UPDATE products SET quantite_en_stock = quantite_en_stock + $1 WHERE id = $2',
      [quantite_vendue, product_id]
    );

    // Recalcule montant_total / montant_paye / statut_paiement
    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);
    let newTotalAmount = parseFloat(vente.rows[0].montant_total) - (parseFloat(prix_unitaire_negocie) * quantite_vendue);
    if (newTotalAmount < 0) newTotalAmount = 0;

    let newPaidAmount = parseFloat(vente.rows[0].montant_paye);
    if (newPaidAmount > newTotalAmount) newPaidAmount = newTotalAmount;

    // Si tous les items sont annulés/retournés => statut 'annulé'
    const items = await pool.query('SELECT statut_vente_item FROM vente_items WHERE vente_id = $1', [vente_id]);
    const tousClotures = items.rows.length > 0 && items.rows.every(i => i.statut_vente_item === 'annulé' || i.statut_vente_item === 'retourné');

    let newStatus;
    if (tousClotures || newTotalAmount === 0) newStatus = 'annulé';
    else if (newPaidAmount >= newTotalAmount) newStatus = 'payé';
    else if (newPaidAmount > 0) newStatus = 'paiement_partiel';
    else newStatus = 'en_attente';

    await pool.query(
      'UPDATE ventes SET montant_total = $1, montant_paye = $2, statut_paiement = $3 WHERE id = $4',
      [newTotalAmount, newPaidAmount, newStatus, vente_id]
    );

    await pool.query('COMMIT');
    res.status(200).json({ message: 'Produit de la vente annulé avec succès' });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Erreur lors de l'annulation du produit:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Contrôleur pour effectuer un paiement partiel ou total pour une vente
exports.makePayment = async (req, res) => {
  const { vente_id, montant_paye } = req.body;

  try {
    await pool.query('BEGIN');

    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);
    if (vente.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Vente non trouvée' });
    }

    const currentVente = vente.rows[0];
    const newPaidAmount = parseFloat(currentVente.montant_paye) + parseFloat(montant_paye);

    if (newPaidAmount > currentVente.montant_total) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Le montant payé dépasse le montant total de la vente' });
    }

    let newStatus;
    if (currentVente.montant_total === 0) newStatus = 'annulé';
    else if (newPaidAmount === currentVente.montant_total) newStatus = 'payé';
    else if (newPaidAmount > 0) newStatus = 'paiement_partiel';
    else newStatus = 'en_attente';

    const updatedVente = await pool.query(
      'UPDATE ventes SET montant_paye = $1, statut_paiement = $2 WHERE id = $3 RETURNING *',
      [newPaidAmount, newStatus, vente_id]
    );

    // Ne passe "vendu" que les items encore "actif"
    if (newStatus === 'payé') {
      await pool.query(
        'UPDATE vente_items SET statut_vente_item = $1 WHERE vente_id = $2 AND statut_vente_item = $3',
        ['vendu', vente_id, 'actif']
      );
    }

    await pool.query('COMMIT');
    res.status(200).json({ message: 'Paiement effectué avec succès', vente: updatedVente.rows[0] });

  } catch (error) {
    await pool.query('ROLLBACK');
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
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Produit de la vente non trouvé' });
    }

    if (venteItem.rows[0].statut_vente_item === 'retourné') {
      await pool.query('ROLLBACK');
      return res.status(200).json({ message: 'Produit déjà retourné' });
    }

    const { product_id, vente_id, prix_unitaire_negocie } = venteItem.rows[0];

    const newReturn = await pool.query(
      'INSERT INTO defective_returns (product_id, quantite_retournee, reason) VALUES ($1, $2, $3) RETURNING *',
      [product_id, quantite_retournee, reason]
    );

    await pool.query(
      'UPDATE vente_items SET statut_vente_item = $1 WHERE id = $2',
      ['retourné', vente_item_id]
    );

    const vente = await pool.query('SELECT * FROM ventes WHERE id = $1', [vente_id]);

    let updatedVenteAmount = parseFloat(vente.rows[0].montant_total) - (parseFloat(prix_unitaire_negocie) * quantite_retournee);
    if (updatedVenteAmount < 0) updatedVenteAmount = 0;

    let updatedMontantPaye = parseFloat(vente.rows[0].montant_paye) - (parseFloat(prix_unitaire_negocie) * quantite_retournee);
    if (updatedMontantPaye < 0) updatedMontantPaye = 0;
    if (updatedMontantPaye > updatedVenteAmount) updatedMontantPaye = updatedVenteAmount;

    const items = await pool.query('SELECT statut_vente_item FROM vente_items WHERE vente_id = $1', [vente_id]);
    const tousClotures = items.rows.length > 0 && items.rows.every(i => i.statut_vente_item === 'annulé' || i.statut_vente_item === 'retourné');

    let newStatus;
    if (tousClotures || updatedVenteAmount === 0) newStatus = 'annulé';
    else if (updatedMontantPaye >= updatedVenteAmount) newStatus = 'payé';
    else if (updatedMontantPaye > 0) newStatus = 'paiement_partiel';
    else newStatus = 'en_attente';

    await pool.query(
      'UPDATE ventes SET montant_total = $1, montant_paye = $2, statut_paiement = $3 WHERE id = $4',
      [updatedVenteAmount, updatedMontantPaye, newStatus, vente_id]
    );

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Retour de produit défectueux enregistré', retour: newReturn.rows[0] });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error("Erreur lors de l'enregistrement du retour:", error);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
