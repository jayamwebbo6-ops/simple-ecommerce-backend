/**
 * invoice.js
 * Backend invoice generator — builds the invoice HTML (and PDF via html-pdf-node).
 */

const fs   = require('fs');
const path = require('path');

/**
 * Reads signature.png from public/ and returns a base64 data URI.
 * Embedding as base64 ensures the image renders in PDF without HTTP requests.
 * Returns null if the file is not found.
 */
function loadSignatureBase64() {
  try {
    const sigPath = path.join(__dirname, '..', 'public', 'signature.png');
    const data    = fs.readFileSync(sigPath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return null; // file missing — fall back to text
  }
}

/**
 * Reads logo.webp from public/ and returns a base64 data URI.
 * Returns null if the file is not found.
 */
function loadLogoBase64() {
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'logo.webp');
    const data     = fs.readFileSync(logoPath);
    return `data:image/webp;base64,${data.toString('base64')}`;
  } catch {
    return null; // file missing — fall back to text
  }
}

const COLORS = {
  navy:         '#0f172a',
  emerald:      '#059669',
  emeraldLight: '#ecfdf5',
  emeraldBorder:'#a7f3d0',
  slate:        '#1e293b', // darker slate-800
  slateLight:   '#475569', // darker slate-600
  border:       '#cbd5e1', // darker border
  bg:           '#f1f5f9', // darker background
  white:        '#ffffff',
};

/** Formats a number as Indian Rupee, e.g. 93830 → "Rs. 93,830.00" */
function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Builds the full URL for a product image stored in the uploads folder */
function buildImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const port    = process.env.PORT    || 3005;
  const apiSlug = process.env.API_URL || 'simple-ecommerce';
  const clean   = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `http://localhost:${port}/${apiSlug}/api${clean}`;
}

/** Renders a single product image thumbnail */
function renderProductImage(imageUrl) {
  if (!imageUrl) {
    return `<div style="width:52px; height:52px; border-radius:8px; background:${COLORS.bg}; border:1px solid ${COLORS.border}; flex-shrink:0;"></div>`;
  }
  return `<img src="${imageUrl}" alt="product" style="width:52px; height:52px; border-radius:8px; object-fit:cover; border:1px solid ${COLORS.border}; flex-shrink:0; display:block;" />`;
}

/** Renders the "combo included items" block for a line item, if present. */
function renderComboItems(item) {
  if (!item.comboItems || item.comboItems.length === 0) return '';

  const rows = item.comboItems
    .map((combo) => {
      const comboImg = buildImageUrl(combo.image);
      return `
        <div style="display:flex; align-items:center; gap:10px; padding:5px 0;">
          ${renderProductImage(comboImg)}
          <div>
            <div style="font-size:12px; font-weight:600; color:${COLORS.navy};">
              ${combo.name}${combo.isCurrentItem ? ` <span style="color:${COLORS.slateLight}; font-weight:400;">(This Item)</span>` : ''}
            </div>
            <div style="font-size:11px; color:${COLORS.slate}; margin-top:2px;">${formatCurrency(combo.price)}</div>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div style="margin-top:10px; padding:10px 12px; background:${COLORS.emeraldLight}; border:1px solid ${COLORS.emeraldBorder}; border-radius:8px;">
      <div style="font-size:10px; font-weight:700; letter-spacing:0.05em; color:${COLORS.emerald}; text-transform:uppercase; margin-bottom:8px;">Combo Included Items</div>
      ${rows}
    </div>`;
}

/** Renders the line-item table rows with product image. */
function renderItemRows(items) {
  return items
    .map((item, idx) => {
      const imgUrl = buildImageUrl(item.imageUrl);
      return `
      <tr>
        <td style="padding:14px 12px; border-bottom:1px solid ${COLORS.border}; vertical-align:middle; color:${COLORS.slateLight}; font-size:13px; width:36px;">${idx + 1}</td>
        <td style="padding:14px 12px; border-bottom:1px solid ${COLORS.border}; vertical-align:middle;">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            ${renderProductImage(imgUrl)}
            <div>
              <div style="font-size:13px; font-weight:700; color:${COLORS.navy}; line-height:1.4;">${item.description}</div>
              ${renderComboItems(item)}
            </div>
          </div>
        </td>
        <td style="padding:14px 12px; border-bottom:1px solid ${COLORS.border}; vertical-align:middle; color:${COLORS.slate}; font-size:13px; white-space:nowrap;">${item.quantity}</td>
        <td style="padding:14px 12px; border-bottom:1px solid ${COLORS.border}; vertical-align:middle; color:${COLORS.slate}; font-size:13px; white-space:nowrap;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:14px 12px; border-bottom:1px solid ${COLORS.border}; vertical-align:middle; font-size:13px; font-weight:700; color:${COLORS.navy}; white-space:nowrap;">${formatCurrency(item.totalPrice)}</td>
      </tr>`;
    })
    .join('');
}

/**
 * Builds the full invoice HTML document.
 *
 * @param {Object} order
 * @param {string} order.invoiceId
 * @param {string} order.orderId
 * @param {string} order.issuedOn
 * @param {Object} order.seller       - { name, addressLines: [], email, phone }
 * @param {Object} order.shipTo       - { name, addressLines: [] }
 * @param {Array}  order.items        - [{ description, quantity, unitPrice, totalPrice, imageUrl?, comboItems? }]
 * @param {number} order.subtotal
 * @param {number} order.total
 * @param {string} [order.storeName]
 * @param {string} [order.tagline]
 * @param {string} [order.supportEmail]
 */
function generateInvoiceHTML(order) {
  const {
    invoiceId,
    orderId,
    issuedOn,
    seller,
    shipTo,
    items,
    subtotal,
    total,
    storeName    = 'AURA',
    tagline      = 'Precision Engineering for Modern Commerce.',
    supportEmail = seller?.email || process.env.EMAIL_USER || '',
  } = order;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${invoiceId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    height: 100%;
  }

  body {
    font-family: 'Times New Roman', Times, Georgia, serif;
    font-size: 15px;
    color: ${COLORS.slate};
    background: ${COLORS.white};
    /* leave bottom space for fixed footer */
    padding: 16px 32px;
  }

  .container {
    max-width: 860px;
    margin: 0 auto;
  }

  .label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: ${COLORS.emerald};
    margin-bottom: 5px;
  }

  table { border-collapse: collapse; width: 100%; }

  /* Fixed footer printed at the bottom of every page */
  .page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 18px 48px 24px;
    background: ${COLORS.white};
    border-top: 1px solid ${COLORS.border};
    font-size: 13px;
    color: ${COLORS.slate};
    text-align: center;
    line-height: 1.6;
  }

  @media print {
    .page-footer { position: fixed; bottom: 0; }
  }
</style>
</head>
<body>
<div class="container">

  <!-- ── TOP HEADER ─────────────────────────────── -->
  <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:2px solid ${COLORS.navy}; margin-bottom:28px;">
    <div>
      <div style="font-size:36px; font-weight:900; letter-spacing:-0.03em; color:${COLORS.navy}; line-height:1;">INVOICE</div>
      <div style="font-size:13px; color:${COLORS.slate}; margin-top:6px;">
        Invoice ID: <strong style="color:${COLORS.navy};">${invoiceId}</strong>
      </div>
    </div>
    <div style="text-align:right;">
      ${(() => {
        const logoDataUri = loadLogoBase64();
        return logoDataUri
          ? `<img src="${logoDataUri}" alt="${storeName}" style="height:45px; max-width:200px; object-fit:contain; display:block; margin:0 0 0 auto;" />`
          : `<div style="font-size:22px; font-weight:900; color:${COLORS.emerald}; letter-spacing:-0.02em;">${storeName}</div>`;
      })()}
      <div style="font-size:11px; color:${COLORS.slateLight}; margin-top:4px;">${tagline}</div>
    </div>
  </div>

  <!-- ── SOLD BY / SHIPPING ─────────────────────── -->
  <div style="display:flex; gap:40px; margin-bottom:24px; padding-bottom:24px; border-bottom:1px solid ${COLORS.border};">
    <div style="flex:1;">
      <div class="label">Sold By</div>
      <div style="font-weight:700; color:${COLORS.navy}; font-size:14px; margin-bottom:4px;">${seller.name}</div>
      ${(seller.addressLines || []).map((l) => `<div style="color:${COLORS.slate}; line-height:1.6;">${l}</div>`).join('')}
      ${seller.email ? `<div style="color:${COLORS.slate}; margin-top:4px;">${seller.email}</div>` : ''}
      ${seller.phone ? `<div style="color:${COLORS.slate};">${seller.phone}</div>` : ''}
    </div>
    <div style="flex:1;">
      <div class="label">Shipping Address</div>
      <div style="font-weight:700; color:${COLORS.navy}; font-size:14px; margin-bottom:4px;">${shipTo.name}</div>
      ${(shipTo.addressLines || []).map((l) => `<div style="color:${COLORS.slate}; line-height:1.6;">${l}</div>`).join('')}
    </div>
  </div>

  <!-- ── ISSUED ON / ORDER ID ───────────────────── -->
  <div style="display:flex; gap:40px; margin-bottom:28px;">
    <div>
      <div class="label">Issued On</div>
      <div style="font-weight:700; color:${COLORS.navy}; font-size:14px;">${issuedOn}</div>
    </div>
    <div>
      <div class="label">Order ID</div>
      <div style="font-weight:700; color:${COLORS.navy}; font-size:14px;">${orderId}</div>
    </div>
  </div>

  <!-- ── ITEMS TABLE ────────────────────────────── -->
  <table style="border:1px solid ${COLORS.border}; border-radius:10px; overflow:hidden; margin-bottom:24px;">
    <thead>
      <tr style="background:${COLORS.navy};">
        <th style="padding:12px; text-align:left; color:${COLORS.white}; font-size:11px; letter-spacing:0.06em; font-weight:700;">S.NO</th>
        <th style="padding:12px; text-align:left; color:${COLORS.white}; font-size:11px; letter-spacing:0.06em; font-weight:700;">ITEM DESCRIPTION</th>
        <th style="padding:12px; text-align:left; color:${COLORS.white}; font-size:11px; letter-spacing:0.06em; font-weight:700;">QTY</th>
        <th style="padding:12px; text-align:left; color:${COLORS.white}; font-size:11px; letter-spacing:0.06em; font-weight:700;">UNIT PRICE</th>
        <th style="padding:12px; text-align:left; color:${COLORS.white}; font-size:11px; letter-spacing:0.06em; font-weight:700;">TOTAL PRICE</th>
      </tr>
    </thead>
    <tbody>
      ${renderItemRows(items)}
    </tbody>
  </table>

  <!-- ── TOTALS ─────────────────────────────────── -->
  <div style="display:flex; justify-content:flex-end; margin-bottom:48px;">
    <div style="width:260px;">
      <div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid ${COLORS.border}; color:${COLORS.slateLight}; font-size:13px;">
        <span>Subtotal</span>
        <span style="color:${COLORS.navy}; font-weight:600;">${formatCurrency(subtotal)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; padding-top:12px; margin-top:4px;">
        <span style="font-size:15px; font-weight:800; color:${COLORS.navy};">Total Amount</span>
        <span style="font-size:18px; font-weight:900; color:${COLORS.emerald};">${formatCurrency(total)}</span>
      </div>
    </div>
  </div>

  <!-- ── SIGNATURE ──────────────────────────────── -->
  <div style="display:flex; justify-content:flex-end;">
    <div style="text-align:center; min-width:200px;">
      ${(() => {
        const sigDataUri = loadSignatureBase64();
        return sigDataUri
          ? `<img src="${sigDataUri}" alt="Authorized Signature" style="height:60px; max-width:200px; object-fit:contain; display:block; margin:0 auto; border-bottom:1px solid ${COLORS.border}; padding-bottom:8px;" />`
          : `<div style="font-family:'Brush Script MT',cursive; font-size:28px; color:${COLORS.navy}; border-bottom:1px solid ${COLORS.border}; padding-bottom:8px;">${storeName}</div>`;
      })()}
      <div style="font-size:10px; letter-spacing:0.06em; color:${COLORS.slateLight}; margin-top:6px; text-transform:uppercase; font-weight:600;">Authorized Signature</div>
    </div>
  </div>

</div><!-- /.container -->

<!-- ── PAGE FOOTER (fixed at bottom of every page) ── -->
<div class="page-footer">
  <div style="font-size:16px; font-weight:800; color:${COLORS.navy}; margin-bottom:6px; text-align:center;">
    Thank you for choosing ${storeName}!
  </div>
  <div style="text-align:center; color:${COLORS.slate}; font-size:13px; font-weight:600; line-height:1.5;">
    We appreciate the opportunity to serve you. If you have any questions regarding this invoice, feel free to contact us at
    <a href="mailto:${supportEmail}" style="color:${COLORS.emerald}; font-weight:800; text-decoration:none;">${supportEmail}</a>.
    We look forward to serving you again.
  </div>
</div>

</body>
</html>`;
}

/**
 * Builds the invoice data object from a Sequelize Order record.
 */
function buildInvoiceData(order, seller = {}) {
  const orderNum  = String(order.id).padStart(4, '0');  // ORD-0001 … ORD-1000+
  const invoiceId = `INV-ORD-${orderNum}`;
  const orderId   = `ORD-${orderNum}`;
  const issuedOn  = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const defaultSeller = {
    name:         'AURA',
    addressLines: ['Chennai, Tamil Nadu, India'],
    email:        process.env.EMAIL_USER || 'support@aura.com',
    phone:        '+91 12345 67890',
    ...seller,
  };

  const customerName = order.User?.name || order.User?.email || 'Customer';
  const shipTo = {
    name:         customerName,
    addressLines: [order.shippingAddress || ''],
  };

  const items = (order.items || []).map((item) => {
    const unitPrice  = parseFloat(item.price || item.Product?.sellingPrice || 0);
    const quantity   = item.quantity || 1;
    const totalPrice = unitPrice * quantity;
    // Build image URL from Product.image path
    const imageUrl   = buildImageUrl(item.Product?.image || null);
    return {
      description: item.Product?.name || 'Product',
      quantity,
      unitPrice,
      totalPrice,
      imageUrl,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0);
  const total    = parseFloat(order.totalAmount) || subtotal;

  return { invoiceId, orderId, issuedOn, seller: defaultSeller, shipTo, items, subtotal, total };
}

/**
 * Converts the invoice HTML to a PDF Buffer using html-pdf-node.
 * Requires: npm install html-pdf-node
 */
async function generateInvoicePDF(order, sellerOverride = {}) {
  const htmlPdf = require('html-pdf-node');

  const invoiceData = buildInvoiceData(order, sellerOverride);
  const html        = generateInvoiceHTML(invoiceData);

  const file    = { content: html };
  const options = {
    format:          'A4',
    printBackground: true,
    margin: { top: '30px', bottom: '80px', left: '0px', right: '0px' },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  const pdfBuffer = await htmlPdf.generatePdf(file, options);
  return { pdfBuffer, invoiceId: invoiceData.invoiceId };
}

module.exports = {
  generateInvoiceHTML,
  generateInvoicePDF,
  buildInvoiceData,
  formatCurrency,
};
