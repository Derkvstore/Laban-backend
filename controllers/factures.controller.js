const pool = require('../db');
const puppeteer = require('puppeteer');

// ===== utilitaires =====
const formaterMonnaie = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(Number(v || 0));

const genererNumeroFacture = async () => {
  // Format: FAC-YYYYMMDD-XXXX
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  // petit compteur du jour
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
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Facture ${facture.numero_facture}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *{box-sizing:border-box;font-family: Inter, -apple-system, Segoe UI, Roboto, Arial}
    .container{max-width:900px;margin:0 auto;padding:24px}
    .muted{color:#6b7280}
    .badge{display:inline-block;border:1px solid #d1d5db;border-radius:999px;padding:2px 10px;font-size:12px}
    .totaux td{padding:8px}
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <h2 style="margin:0;font-size:22px;">Wassolo Service</h2>
        <div class="muted" style="font-size:13px;">Adresse – Téléphone</div>
      </div>
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
      <tbody>
        ${lignesHTML}
      </tbody>
    </table>

    <table style="width:320px;margin-left:auto;margin-top:16px;" class="totaux">
      <tr>
        <td class="muted">Montant total</td>
        <td style="text-align:right;font-weight:600;">${formaterMonnaie(facture.montant_original_facture)}</td>
      </tr>
      <tr>
        <td class="muted">Montant payé</td>
        <td style="text-align:right;">${formaterMonnaie(facture.montant_paye_facture || 0)}</td>
      </tr>
      <tr>
        <td class="muted">Reste à payer</td>
        <td style="text-align:right;color:#dc2626;font-weight:700;">
          ${formaterMonnaie(facture.montant_actuel_du)}
        </td>
      </tr>
    </table>

    <div class="muted" style="margin-top:24px;font-size:12px;">
      Merci pour votre confiance.
    </div>
  </div>
</body>
</html>
`;
};

// ===== contrôleurs =====

// POST /api/factures/creer
// body:
// {
//   "client_id": 1,
//   "articles": [
//     {"product_id": 12, "quantite": 2, "prix_unitaire_negocie": 130000},
//     {"product_id": 8,  "quantite": 1, "prix_unitaire_negocie": 170000}
//   ],
//   "is_gros_sale": false
// }
exports.creerFacture = async (req, res) => {
  const { client_id, articles, is_gros_sale } = req.body;

  if (!client_id || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ message: 'client_id et articles sont requis.' });
  }

  try {
    await pool.query('BEGIN');

    const cli = await pool.query('SELECT * FROM clients WHERE id = $1', [client_id]);
    if (!cli.rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Client introuvable' });
    }

    // vérifie stock + calcule total
    let montant_total = 0;
    for (const a of articles) {
      const p = await pool.query('SELECT * FROM products WHERE id = $1', [a.product_id]);
      if (!p.rows.length) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ message: `Produit ${a.product_id} introuvable` });
      }
      if (p.rows[0].quantite_en_stock < a.quantite) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ message: `Stock insuffisant pour ${p.rows[0].marque} ${p.rows[0].modele}` });
      }
      montant_total += Number(a.prix_unitaire_negocie) * Number(a.quantite);
    }

    // crée la vente
    const venteNew = await pool.query(
      `INSERT INTO ventes (client_id, montant_total, montant_paye, statut_paiement, is_gros_sale)
       VALUES ($1, $2, 0, 'en_attente', $3) RETURNING *`,
      [client_id, montant_total, !!is_gros_sale]
    );
    const vente = venteNew.rows[0];

    // insère les lignes + décrémente le stock
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

      // optionnel : tracer le mouvement
      await pool.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity_moved, reason, related_entity_id, related_entity_type)
         VALUES ($1,'sortie',$2,'vente',$3,'vente')`,
        [prod.id, a.quantite, vente.id]
      );
    }

    // crée la facture
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

// GET /api/factures/:id (détail)
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

// GET /api/factures/:id/pdf  -> stream PDF via Puppeteer
exports.genererPDF = async (req, res) => {
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

    const html = gabaritHTMLFacture({
      facture,
      client,
      vente,
      items: items.rows
    });

    const navigateur = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await navigateur.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
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
