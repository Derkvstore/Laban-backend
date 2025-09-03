const pool = require('../db');

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) { /* laissé null si non installé */ }

const formaterMonnaie = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(Number(v || 0));

const genererNumeroFacture = async () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM factures
    WHERE date_facture::date = CURRENT_DATE
  `);
  const seq = String((rows?.[0]?.total || 0) + 1).padStart(4, '0');
  return `FAC-${yyyy}${mm}${dd}-${seq}`;
};

const gabaritHTMLFacture = ({ facture, client, vente, items }) => {
  const lignesHTML = items.map((it, idx) => {
    const totalLigne = Number(it.prix_unitaire_negocie) * Number(it.quantite_vendue);
    return `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">
          <strong>${it.marque} ${it.modele}</strong><br/>
          <small>${it.stockage || ''} ${it.type} ${it.type_carton || ''}</small>
        </td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${it.quantite_vendue}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formaterMonnaie(it.prix_unitaire_negocie)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${formaterMonnaie(totalLigne)}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"/><title>Facture ${facture.numero_facture}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>*{box-sizing:border-box;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial}
.container{max-width:900px;margin:0 auto;padding:24px}.muted{color:#6b7280}.badge{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:2px 10px;font-size:12px}.totaux td{padding:8px}
</style></head>
<body><div class="container">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <div><h2 style="margin:0;font-size:22px;">Wassolo Service</h2>
      <div class="muted" style="font-size:13px;">Adresse: Halle de Bamako</div></div>
      <div class="muted" style="font-size:13px;">Télephone: +223 77 39 90 05</div></div>
    <div style="text-align:right;">
      <div class="badge">Facture</div>
      <div style="margin-top:8px;font-weight:600;">${facture.numero_facture}</div>
      <div class="muted" style="font-size:13px;">Émise le ${new Date(facture.date_facture).toLocaleString('fr-FR')}</div>
    </div>
  </div>

  <div style="display:flex;gap:16px;margin-bottom:20px;">
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <div style="font-weight:600;margin-bottom:6px;">Facturé à</div>
      <div>${client?.nom || 'Client'}</div>
      <div class="muted" style="font-size:13px;">${client?.telephone || ''}</div>
      <div class="muted" style="font-size:13px;">${client?.adresse || ''}</div>
    </div>
    <div style="flex:1;border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <div style="font-weight:600;margin-bottom:6px;">Informations Vente</div>
      <div class="muted" style="font-size:13px;">Vente n° ${vente.id}</div>
      <div class="muted" style="font-size:13px;">Date vente : ${new Date(vente.date_vente).toLocaleString('fr-FR')}</div>
      <div class="muted" style="font-size:13px;">Statut paiement : ${vente.statut_paiement}</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
    <thead style="background:#f3f4f6;">
      <tr>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">#</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Produit</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:center;">Qté</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Prix unitaire</th>
        <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lignesHTML}</tbody>
  </table>

  <table style="width:320px;margin-left:auto;margin-top:16px;" class="totaux">
    <tr><td class="muted">Montant total</td><td style="text-align:right;font-weight:600;">${formaterMonnaie(facture.montant_original_facture)}</td></tr>
    <tr><td class="muted">Montant payé</td><td style="text-align:right;">${formaterMonnaie(facture.montant_paye_facture || 0)}</td></tr>
    <tr><td class="muted">Reste à payer</td><td style="text-align:right;color:#dc2626;font-weight:700;">${formaterMonnaie(facture.montant_actuel_du)}</td></tr>
  </table>

  <div class="muted" style="margin-top:24px;font-size:12px;">Merci pour votre confiance.</div>
</div></body></html>`;
};

// ===== Créer facture (déjà fourni précédemment) =====
exports.creerFacture = async (req, res) => {
  const { client_id, articles, is_gros_sale } = req.body;
  if (!client_id || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ message: 'client_id et articles sont requis.' });
  }
  try {
    await pool.query('BEGIN');

    const cli = await pool.query('SELECT * FROM clients WHERE id = $1', [client_id]);
    if (!cli.rows.length) { await pool.query('ROLLBACK'); return res.status(404).json({ message: 'Client introuvable' }); }

    let montant_total = 0;
    for (const a of articles) {
      const p = await pool.query('SELECT * FROM products WHERE id = $1', [a.product_id]);
      if (!p.rows.length) { await pool.query('ROLLBACK'); return res.status(404).json({ message: `Produit ${a.product_id} introuvable` }); }
      if (p.rows[0].quantite_en_stock < a.quantite) { await pool.query('ROLLBACK'); return res.status(400).json({ message: `Stock insuffisant pour ${p.rows[0].marque} ${p.rows[0].modele}` }); }
      montant_total += Number(a.prix_unitaire_negocie) * Number(a.quantite);
    }

    const venteNew = await pool.query(
      `INSERT INTO ventes (client_id, montant_total, montant_paye, statut_paiement, is_gros_sale)
       VALUES ($1, $2, 0, 'en_attente', $3) RETURNING *`,
      [client_id, montant_total, !!is_gros_sale]
    );
    const vente = venteNew.rows[0];

    for (const a of articles) {
      const p = await pool.query('SELECT * FROM products WHERE id = $1', [a.product_id]);
      const prod = p.rows[0];

      await pool.query(
        `INSERT INTO vente_items
          (vente_id, product_id, quantite_vendue, prix_unitaire_negocie, prix_unitaire_achat_au_moment_vente,
           marque, modele, stockage, type, type_carton)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          vente.id, prod.id, a.quantite, a.prix_unitaire_negocie, prod.prix_achat,
          prod.marque, prod.modele, prod.stockage, prod.type, prod.type_carton
        ]
      );

      await pool.query(
        'UPDATE products SET quantite_en_stock = quantite_en_stock - $1 WHERE id = $2',
        [a.quantite, prod.id]
      );

      await pool.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity_moved, reason, related_entity_id, related_entity_type)
         VALUES ($1,'sortie',$2,'vente',$3,'vente')`,
        [prod.id, a.quantite, vente.id]
      );
    }

    const numero_facture = await genererNumeroFacture();
    const factureNew = await pool.query(
      `INSERT INTO factures
        (vente_id, numero_facture, montant_original_facture, montant_actuel_du, montant_paye_facture, statut_facture)
       VALUES ($1,$2,$3,$4,0,'creee') RETURNING *`,
      [vente.id, numero_facture, montant_total, montant_total]
    );
    const facture = factureNew.rows[0];

    await pool.query('COMMIT');
    res.status(201).json({ message: 'Facture créée', facture, vente_id: vente.id });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Erreur création facture:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// ===== Lister toutes les factures =====
exports.listerFactures = async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, v.client_id, c.nom AS client_nom
      FROM factures f
      JOIN ventes v ON v.id = f.vente_id
      JOIN clients c ON c.id = v.client_id
      ORDER BY f.date_facture DESC, f.id DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('Erreur listerFactures:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// ===== Obtenir une facture =====
exports.obtenirFacture = async (req, res) => {
  const { id } = req.params;
  try {
    const f = await pool.query('SELECT * FROM factures WHERE id = $1', [id]);
    if (!f.rows.length) return res.status(404).json({ message: 'Facture introuvable' });

    const facture = f.rows[0];
    const v = await pool.query('SELECT * FROM ventes WHERE id = $1', [facture.vente_id]);
    const vente = v.rows[0];

    const cli = await pool.query('SELECT * FROM clients WHERE id = $1', [vente.client_id]);
    const client = cli.rows[0];

    const items = await pool.query('SELECT * FROM vente_items WHERE vente_id = $1 ORDER BY id', [vente.id]);

    res.json({ facture, vente, client, items: items.rows });
  } catch (e) {
    console.error('Erreur obtenirFacture:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// ===== Payer une facture (ajouter un montant) =====
exports.payerFacture = async (req, res) => {
  const { id } = req.params;
  const { montant } = req.body; // montant à ajouter

  if (Number(montant) <= 0) {
    return res.status(400).json({ message: 'Montant invalide.' });
  }

  try {
    await pool.query('BEGIN');

    const f = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [id]);
    if (!f.rows.length) { await pool.query('ROLLBACK'); return res.status(404).json({ message: 'Facture introuvable' }); }
    const facture = f.rows[0];

    if (facture.statut_facture === 'annulee') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'La facture est annulée.' });
    }

    const v = await pool.query('SELECT * FROM ventes WHERE id = $1 FOR UPDATE', [facture.vente_id]);
    const vente = v.rows[0];

    const nouveauPayeFacture = Number(facture.montant_paye_facture || 0) + Number(montant);
    if (nouveauPayeFacture > Number(facture.montant_original_facture)) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Le paiement dépasse le montant de la facture.' });
    }

    const nouveauDuFacture = Number(facture.montant_original_facture) - nouveauPayeFacture;
    const statutFacture =
      nouveauDuFacture === 0 ? 'payee' : (nouveauPayeFacture > 0 ? 'partielle' : 'creee');

    await pool.query(
      `UPDATE factures
       SET montant_paye_facture = $1, montant_actuel_du = $2, statut_facture = $3
       WHERE id = $4`,
      [nouveauPayeFacture, nouveauDuFacture, statutFacture, id]
    );

    // miroir côté "ventes"
    const nouveauPayeVente = Number(vente.montant_paye || 0) + Number(montant);
    if (nouveauPayeVente > Number(vente.montant_total)) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ message: 'Le paiement dépasse le montant de la vente.' });
    }
    const statutVente =
      nouveauPayeVente === Number(vente.montant_total) ? 'payé' : (nouveauPayeVente > 0 ? 'paiement_partiel' : 'en_attente');

    await pool.query(
      `UPDATE ventes SET montant_paye = $1, statut_paiement = $2 WHERE id = $3`,
      [nouveauPayeVente, statutVente, vente.id]
    );

    // si payé intégralement : passer les items encore "actif" en "vendu"
    if (statutVente === 'payé') {
      await pool.query(
        `UPDATE vente_items SET statut_vente_item = 'vendu'
         WHERE vente_id = $1 AND statut_vente_item = 'actif'`,
        [vente.id]
      );
    }

    await pool.query('COMMIT');
    res.json({ message: 'Paiement enregistré.' });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Erreur payerFacture:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// ===== Annuler une facture (restock total) =====
exports.annulerFacture = async (req, res) => {
  const { id } = req.params;
  const { raison_annulation } = req.body;

  try {
    await pool.query('BEGIN');

    const f = await pool.query('SELECT * FROM factures WHERE id = $1 FOR UPDATE', [id]);
    if (!f.rows.length) { await pool.query('ROLLBACK'); return res.status(404).json({ message: 'Facture introuvable' }); }
    const facture = f.rows[0];

    if (facture.statut_facture === 'annulee') {
      await pool.query('ROLLBACK');
      return res.status(200).json({ message: 'Facture déjà annulée.' });
    }

    const v = await pool.query('SELECT * FROM ventes WHERE id = $1 FOR UPDATE', [facture.vente_id]);
    const vente = v.rows[0];

    const items = await pool.query(
      `SELECT * FROM vente_items WHERE vente_id = $1`,
      [vente.id]
    );

    // Restock pour tous les items non déjà "annulé" (et non "retourné")
    for (const it of items.rows) {
      if (it.statut_vente_item !== 'annulé' && it.statut_vente_item !== 'retourné') {
        await pool.query(
          `UPDATE products SET quantite_en_stock = quantite_en_stock + $1 WHERE id = $2`,
          [it.quantite_vendue, it.product_id]
        );
        await pool.query(
          `INSERT INTO stock_movements (product_id, movement_type, quantity_moved, reason, related_entity_id, related_entity_type)
           VALUES ($1,'entree',$2,'annulation_facture',$3,'facture')`,
          [it.product_id, it.quantite_vendue, facture.id]
        );
      }
    }

    // Passer tous les items de la vente en "annulé"
    await pool.query(
      `UPDATE vente_items
       SET statut_vente_item = 'annulé', cancellation_reason = COALESCE(cancellation_reason,'Annulation facture')
       WHERE vente_id = $1`,
      [vente.id]
    );

    // Mettre la vente à "annulé"
    await pool.query(
      `UPDATE ventes SET montant_total = 0, montant_paye = 0, statut_paiement = 'annulé' WHERE id = $1`,
      [vente.id]
    );

    // Mettre la facture à "annulee"
    await pool.query(
      `UPDATE factures
       SET statut_facture = 'annulee',
           date_annulation = NOW(),
           raison_annulation = $1,
           montant_actuel_du = 0
       WHERE id = $2`,
      [raison_annulation || 'Annulation demande', id]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Facture annulée et stocks rétablis.' });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Erreur annulerFacture:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};

// ===== Générer PDF =====
exports.genererPDF = async (req, res) => {
  const { id } = req.params;
  if (!puppeteer) {
    return res.status(503).json({ message: "Service PDF indisponible (puppeteer non installé)." });
  }
  try {
    const f = await pool.query('SELECT * FROM factures WHERE id = $1', [id]);
    if (!f.rows.length) return res.status(404).json({ message: 'Facture introuvable' });
    const facture = f.rows[0];

    const v = await pool.query('SELECT * FROM ventes WHERE id = $1', [facture.vente_id]);
    const vente = v.rows[0];

    const cli = await pool.query('SELECT * FROM clients WHERE id = $1', [vente.client_id]);
    const client = cli.rows[0];

    const items = await pool.query('SELECT * FROM vente_items WHERE vente_id = $1 ORDER BY id', [vente.id]);

    const html = gabaritHTMLFacture({ facture, client, vente, items: items.rows });

    const navigateur = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await navigateur.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' }
    });
    await navigateur.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${facture.numero_facture}.pdf"`);
    return res.send(pdfBuffer);
  } catch (e) {
    console.error('Erreur génération PDF:', e);
    res.status(500).json({ message: 'Erreur serveur interne' });
  }
};
