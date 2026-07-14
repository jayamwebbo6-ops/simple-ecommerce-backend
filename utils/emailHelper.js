const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("CRITICAL: EMAIL_USER or EMAIL_PASS is not defined in .env");
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ─────────────────────────────────────────────────────────
   Shared design tokens (inline-safe for all email clients)
   ───────────────────────────────────────────────────────── */
const FONT  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const C = {
  navy:       '#0f172a',
  green:      '#16a34a',
  lightGreen: '#ecfdf5',
  border:     '#dbe4ee',
  bg:         '#f8fafc',
  white:      '#ffffff',
  text:       '#334155',
};

/** Wraps content in a consistent outer shell with header + footer */
function emailShell({ heading, body, year = new Date().getFullYear() }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body, table, td, p, a {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 14px !important;
      color: ${C.text} !important;
      line-height: 1.6 !important;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      color: ${C.navy} !important;
      font-weight: bold !important;
    }
    .header-title {
      color: #ffffff !important;
    }
    .header-tagline {
      color: #d1d5db !important;
    }
    .header-badge {
      color: #ffffff !important;
    }
  </style>
</head>
<body style="margin:0; padding:0; background:${C.bg}; font-family:${FONT}; -webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}; padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="650" cellpadding="0" cellspacing="0" style="background:${C.white}; border-radius:18px; overflow:hidden; border:1px solid ${C.border}; max-width:650px; width:100%; box-shadow:0 10px 30px rgba(15,23,42,0.05);">

        <!-- Header -->
        <tr>
          <td style="background:${C.navy}; padding:36px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span class="header-title" style="font-family:${FONT}; font-size:32px; font-weight:700; color:#ffffff; letter-spacing:2px; line-height:1.2;">AURA</span>
                  <div class="header-tagline" style="font-family:${FONT}; font-size:13px; color:#d1d5db; margin-top:8px; letter-spacing:1px; line-height:1.4;">PRECISION ENGINEERING FOR MODERN COMMERCE</div>
                </td>
                <td align="right" style="vertical-align:middle; padding-left:20px;">
                  ${heading ? `<span class="header-badge" style="font-family:${FONT}; font-size:18px; font-weight:bold; color:#ffffff; letter-spacing:1px; text-transform:uppercase; white-space:nowrap;">${heading}</span>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:50px; font-family:${FONT};">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${C.bg}; border-top:1px solid ${C.border}; padding:32px 40px; text-align:center;">
            <!-- Benefits -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center" style="font-family:${FONT}; font-size:12px; color:${C.text}; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">
                  🛡️ Secure & Reliable &nbsp;•&nbsp; 📞 24/7 Support &nbsp;•&nbsp; ✨ Quality Assured
                </td>
              </tr>
            </table>
            <div style="border-top:1px solid ${C.border}; margin-bottom:20px; height:1px;"></div>
            <p style="font-family:${FONT}; font-size:12px; color:${C.text}; margin:0; line-height:1.6;">
              &copy; ${year} AURA Luxe. All rights reserved.<br/>
              For support or inquiries, email us at <a href="mailto:jayamproj@gmail.com" style="color:${C.green}; text-decoration:none; font-weight:bold;">jayamproj@gmail.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

/** Beautiful heading section helper */
function renderHeadingSection(emoji, subheading, title, description) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
      <tr>
        <td width="76" style="vertical-align:top; padding-right:16px;">
          <div style="width:60px; height:60px; border-radius:50%; background:${C.lightGreen}; text-align:center; line-height:60px; font-size:30px;">
            ${emoji}
          </div>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0 0 4px; font-family:${FONT}; font-size:14px; color:${C.green}; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">
            ${subheading}
          </p>
          <h2 style="margin:0 0 8px; font-family:${FONT}; font-size:36px; font-weight:bold; color:${C.navy}; line-height:1.2;">
            ${title}
          </h2>
          <p style="margin:0; font-family:${FONT}; font-size:16px; color:${C.text}; line-height:1.5;">
            ${description}
          </p>
        </td>
      </tr>
    </table>
  `;
}

/** Reusable info row inside a detail card */
function infoRow(label, value) {
  return `
    <tr>
      <td style="font-family:${FONT}; padding:18px 24px; font-weight:700; font-size:14px; color:${C.text}; width:170px; border-bottom:1px solid ${C.border};">
        ${label}
      </td>
      <td style="font-family:${FONT}; padding:18px 24px; font-size:15px; color:${C.navy}; font-weight:600; border-bottom:1px solid ${C.border};">
        ${value}
      </td>
    </tr>`;
}

/** Sends a generic email with optional attachments */
const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const info = await transporter.sendMail({
      from: `"AURA Luxe" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email send failed:', error);
    throw new Error('Failed to send email');
  }
};

/* ─────────────────────────────────────────────────────────
   OTP Email
   ───────────────────────────────────────────────────────── */
const sendOTPEmail = async (to, otp) => {
  const subject = 'Your AURA Verification Code';

  const headingSection = renderHeadingSection(
    '🔑',
    'Security Code',
    'Verify Your Identity',
    'Enter the one-time code below to complete your sign-in to <strong>AURA Luxe</strong>. This code expires in <strong>5 minutes</strong>.'
  );

  const body = `
    ${headingSection}

    <!-- OTP Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px; margin-bottom:32px;">
      <tr>
        <td align="center">
          <div style="display:inline-block; background:${C.lightGreen}; border:2px solid ${C.border}; border-radius:18px; padding:20px 48px; box-shadow:0 8px 24px rgba(22,163,74,0.04);">
            <span style="font-family:${FONT}; font-size:44px; font-weight:900; letter-spacing:14px; color:${C.green};">${otp}</span>
          </div>
        </td>
      </tr>
    </table>

    <p style="font-family:${FONT}; font-size:13px; color:${C.text}; line-height:1.6; margin:0; text-align:center;">
      If you did not request this code, please ignore this email. Do not share it with anyone.
    </p>
  `;

  return sendEmail(to, subject, emailShell({ heading: 'Verification', body }));
};

/* ─────────────────────────────────────────────────────────
   Order Confirmation Email (with optional PDF invoice)
   ───────────────────────────────────────────────────────── */
const sendOrderConfirmationEmail = async (to, order, items, pdfBuffer = null, invoiceId = null) => {
  const ordNum  = String(order.id).padStart(4, '0');
  const orderId = `ORD-${ordNum}`;
  const subject = `Order Confirmed — ${orderId} | AURA${invoiceId ? ` | ${invoiceId}` : ''}`;

  const itemsRows = items.map((item, i) => {
    const price = item.price || item.Product?.sellingPrice || 0;
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="font-family:${FONT}; padding:18px; font-size:15px; color:${C.text}; border-bottom:1px solid ${C.border};">
          <strong style="color:${C.navy};">${item.Product?.name || 'Product'}</strong>
          <span style="color:${C.text}; font-size:13px; font-weight:normal;"> &times; ${item.quantity}</span>
        </td>
        <td style="font-family:${FONT}; padding:18px; font-size:15px; font-weight:bold; color:${C.navy}; text-align:right; border-bottom:1px solid ${C.border}; white-space:nowrap;">
          ₹ ${(price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>`;
  }).join('');

  const headingDesc = `Hi <strong>${order.User?.name || 'there'}</strong>, thank you for shopping with AURA.<br/>
    Your order <strong>${orderId}</strong> has been received and is being processed.
    ${invoiceId ? `<br/>Your invoice <strong>${invoiceId}</strong> is attached as a PDF — open it to view or print your receipt.` : ''}`;

  const headingSection = renderHeadingSection('🛒', 'Purchase Receipt', 'Your order is confirmed! 🎉', headingDesc);

  const body = `
    ${headingSection}

    <!-- Order Summary Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-top:30px; margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📄 ORDER SUMMARY · ${orderId}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>${itemsRows}</tbody>
        <tfoot>
          <tr style="background:#f8fafc;">
            <td style="font-family:${FONT}; padding:18px 24px; font-size:15px; font-weight:bold; color:${C.navy};">Total</td>
            <td style="font-family:${FONT}; padding:18px 24px; text-align:right; white-space:nowrap;">
              <span style="font-size:28px; font-weight:bold; color:${C.green};">
                ₹ ${parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Shipping Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-bottom:32px; background:#ffffff;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📍 SHIPPING ADDRESS
      </div>
      <div style="padding:22px 24px; font-family:${FONT}; font-size:15px; color:${C.text}; line-height:1.6;">
        ${order.shippingAddress || '—'}
      </div>
    </div>

    <p style="font-family:${FONT}; font-size:13px; color:${C.text}; line-height:1.6; margin:0; text-align:center;">
      Questions? Contact us at
      <a href="mailto:${process.env.EMAIL_USER}" style="color:${C.green}; font-weight:bold; text-decoration:none;">${process.env.EMAIL_USER}</a>.
    </p>
  `;

  const attachments = pdfBuffer
    ? [{ filename: `${invoiceId || 'invoice'}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    : [];

  return sendEmail(to, subject, emailShell({ heading: 'Order Confirmation', body }), attachments);
};

/* ─────────────────────────────────────────────────────────
   Order Status Update Email
   ───────────────────────────────────────────────────────── */
const sendOrderStatusUpdateEmail = async (to, order, items, status) => {
  const ordNum  = String(order.id).padStart(4, '0');
  const orderId = `ORD-${ordNum}`;
  const subject = `Order #${orderId} Status Updated — ${status.toUpperCase()} | AURA`;

  const statusEmojis = {
    confirmed: '📦',
    shipped: '🚚',
    delivered: '🎁',
    cancelled: '❌',
    payment_failed: '⚠️'
  };

  const emoji = statusEmojis[status.toLowerCase()] || '🔔';

  const headingDesc = `Hi <strong>${order.User?.name || 'there'}</strong>,<br/>
    The status of your order <strong>${orderId}</strong> has been updated to: <strong>${status.toUpperCase()}</strong>.`;

  const headingSection = renderHeadingSection(
    emoji,
    'Order Update',
    `Status: ${status.toUpperCase()}`,
    headingDesc
  );

  const itemsRows = items.map((item, i) => {
    const price = item.price || item.Product?.sellingPrice || 0;
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="font-family:${FONT}; padding:18px; font-size:15px; color:${C.text}; border-bottom:1px solid ${C.border};">
          <strong style="color:${C.navy};">${item.Product?.name || 'Product'}</strong>
          <span style="color:${C.text}; font-size:13px; font-weight:normal;"> &times; ${item.quantity}</span>
        </td>
        <td style="font-family:${FONT}; padding:18px; font-size:15px; font-weight:bold; color:${C.navy}; text-align:right; border-bottom:1px solid ${C.border}; white-space:nowrap;">
          ₹ ${(price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>`;
  }).join('');

  const body = `
    ${headingSection}

    <!-- Order Summary Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-top:30px; margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📄 ORDER DETAILS · ${orderId}
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tbody>${itemsRows}</tbody>
        <tfoot>
          <tr style="background:#f8fafc;">
            <td style="font-family:${FONT}; padding:18px 24px; font-size:15px; font-weight:bold; color:${C.navy};">Total</td>
            <td style="font-family:${FONT}; padding:18px 24px; text-align:right; white-space:nowrap;">
              <span style="font-size:28px; font-weight:bold; color:${C.green};">
                ₹ ${parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Shipping Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-bottom:32px; background:#ffffff;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📍 SHIPPING ADDRESS
      </div>
      <div style="padding:22px 24px; font-family:${FONT}; font-size:15px; color:${C.text}; line-height:1.6;">
        ${order.shippingAddress || '—'}
      </div>
    </div>

    <p style="font-family:${FONT}; font-size:13px; color:${C.text}; line-height:1.6; margin:0; text-align:center;">
      Questions? Contact us at
      <a href="mailto:${process.env.EMAIL_USER}" style="color:${C.green}; font-weight:bold; text-decoration:none;">${process.env.EMAIL_USER}</a>.
    </p>
  `;

  return sendEmail(to, subject, emailShell({ heading: 'Order Status Updated', body }));
};

/* ─────────────────────────────────────────────────────────
   Admin New Order Notification
   ───────────────────────────────────────────────────────── */
const sendAdminOrderNotificationEmail = async (adminEmail, order, items, user) => {
  const adminOrdNum = String(order.id).padStart(4, '0');
  const orderId     = `ORD-${adminOrdNum}`;
  const subject     = `New Order Received — ${orderId} | AURA Admin`;

  const itemsRows = items.map((item, i) => {
    const price = item.price || item.Product?.sellingPrice || 0;
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="font-family:${FONT}; padding:18px; font-size:15px; color:${C.text}; border-bottom:1px solid ${C.border};">
          <strong style="color:${C.navy};">${item.Product?.name || 'Product'}</strong>
        </td>
        <td style="font-family:${FONT}; padding:18px; font-size:15px; color:${C.text}; text-align:center; border-bottom:1px solid ${C.border};">${item.quantity}</td>
        <td style="font-family:${FONT}; padding:18px; font-size:15px; font-weight:bold; color:${C.navy}; text-align:right; border-bottom:1px solid ${C.border}; white-space:nowrap;">
          ₹ ${(price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
      </tr>`;
  }).join('');

  const headingSection = renderHeadingSection(
    '🛒',
    'NEW ORDER RECEIVED',
    'New Order Alert',
    'A new order has been placed. Please review and process it.'
  );

  const body = `
    ${headingSection}

    <!-- Order Details Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-top:30px; margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📄 ORDER DETAILS
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Customer', `${user.name || '—'}`)}
        ${infoRow('Email', user.email)}
        ${infoRow('Order ID', orderId)}
        ${infoRow('Total', `₹ ${parseFloat(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)}
        ${infoRow('Ship To', order.shippingAddress || '—')}
      </table>
    </div>

    <!-- Items Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        📦 ITEMS ORDERED
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr>
            <th style="font-family:${FONT}; padding:18px; font-size:13px; font-weight:bold; text-align:left; background:#f8fafc; color:${C.navy}; border-bottom:2px solid ${C.border};">Item</th>
            <th style="font-family:${FONT}; padding:18px; font-size:13px; font-weight:bold; text-align:center; background:#f8fafc; color:${C.navy}; border-bottom:2px solid ${C.border};">Qty</th>
            <th style="font-family:${FONT}; padding:18px; font-size:13px; font-weight:bold; text-align:right; background:#f8fafc; color:${C.navy}; border-bottom:2px solid ${C.border};">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
    </div>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px; margin-bottom:10px;">
      <tr>
        <td align="center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}admin/orders"
             style="display:inline-block; background:#16a34a; padding:18px 42px; border-radius:12px; font-family:${FONT}; font-size:17px; font-weight:bold; color:white; text-decoration:none; box-shadow:0 4px 12px rgba(22,163,74,0.2);">
            ⚙ Manage Order &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;

  return sendEmail(adminEmail, subject, emailShell({ heading: 'Admin Alert', body }));
};

/* ─────────────────────────────────────────────────────────
   Admin Password Reset
   ───────────────────────────────────────────────────────── */
const sendAdminPasswordResetEmail = async (to, otp) => {
  const subject = 'AURA Admin — Password Reset Code';

  const headingSection = renderHeadingSection(
    '🔒',
    'Admin Access',
    'Secure Password Reset',
    'Use the code below to reset your AURA Admin password. This code is valid for <strong>5 minutes</strong>.'
  );

  const body = `
    ${headingSection}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:30px; margin-bottom:32px;">
      <tr>
        <td align="center">
          <div style="display:inline-block; background:${C.bg}; border:2px solid ${C.border}; border-radius:18px; padding:20px 48px; box-shadow:0 8px 24px rgba(15,23,42,0.04);">
            <span style="font-family:${FONT}; font-size:44px; font-weight:900; letter-spacing:14px; color:${C.navy};">${otp}</span>
          </div>
        </td>
      </tr>
    </table>

    <p style="font-family:${FONT}; font-size:13px; color:${C.text}; line-height:1.6; margin:0; text-align:center;">
      This request was made from the AURA Admin panel. If you did not initiate this, please secure your account immediately.
    </p>
  `;

  return sendEmail(to, subject, emailShell({ heading: 'Admin Access', body }));
};

/* ─────────────────────────────────────────────────────────
   Contact Form Submission
   ───────────────────────────────────────────────────────── */
const sendContactFormEmail = async (adminEmail, { firstName, lastName, email, message }) => {
  const fullName = `${firstName} ${lastName || ''}`.trim();
  const subject  = `Contact Form — ${fullName} | AURA`;

  const headingSection = renderHeadingSection(
    '✉️',
    'Visitor Inquiry',
    'New Message Received',
    'A visitor has submitted the contact form. Their details and message are below.'
  );

  const body = `
    ${headingSection}

    <!-- Sender Details Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-top:30px; margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        👤 SENDER DETAILS
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow('Name', fullName)}
        ${infoRow('Email', `<a href="mailto:${email}" style="color:${C.green}; font-weight:bold; text-decoration:none;">${email}</a>`)}
      </table>
    </div>

    <!-- Message Card -->
    <div style="border:1px solid ${C.border}; border-radius:18px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,0.06); margin-bottom:32px;">
      <div style="background:${C.navy}; padding:16px 22px; color:white; font-family:${FONT}; font-size:18px; font-weight:bold; letter-spacing:0.5px;">
        ✉️ MESSAGE
      </div>
      <div style="padding:22px 24px; font-family:${FONT}; font-size:15px; color:${C.text}; line-height:1.8; white-space:pre-wrap;">
        ${message}
      </div>
    </div>
  `;

  return sendEmail(adminEmail, subject, emailShell({ heading: 'Contact Form', body }));
};

module.exports = {
  sendOTPEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendAdminOrderNotificationEmail,
  sendAdminPasswordResetEmail,
  sendContactFormEmail,
};
