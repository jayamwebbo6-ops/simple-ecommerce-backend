const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error("CRITICAL: EMAIL_USER or EMAIL_PASS is not defined in .env");
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // use SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends a generic email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email body in HTML format
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"AURA Luxe" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email send failed:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Sends an OTP email
 * @param {string} to - Recipient email
 * @param {string} otp - The OTP code
 */
const sendOTPEmail = async (to, otp) => {
  const subject = 'Your AURA Verification Code';
  const html = `
    <div style="font-family: 'Helvetica', sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0f172a; margin: 0; font-size: 28px; letter-spacing: -1px;">AURA</h1>
      </div>
      <p style="font-size: 16px; color: #64748b; line-height: 1.6;">Hello,</p>
      <p style="font-size: 16px; color: #64748b; line-height: 1.6;">Your verification code for AURA Luxe is below. Please enter it to complete your sign-in.</p>
      <div style="text-align: center; margin: 40px 0;">
        <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #10b981; background: #f0fdf4; padding: 20px 40px; border-radius: 16px; border: 2px solid #bbf7d0;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #94a3b8; text-align: center; margin-top: 40px;">This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
};

const sendOrderConfirmationEmail = async (to, order, items) => {
  const subject = `Order Confirmed - #${1000 + order.id}`;
  const itemsHtml = items.map(item => {
    const price = item.price || item.Product?.sellingPrice || 0;
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.Product?.name || 'Product'} (x${item.quantity})</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(price * item.quantity).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">Thank you for your order!</h2>
      <p>Your order <strong>#${1000 + order.id}</strong> has been received and is being processed.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 10px; font-weight: bold;">Total</td>
            <td style="padding: 10px; font-weight: bold; text-align: right;">$${order.totalAmount}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0;">Shipping Address:</h4>
        <p style="margin: 0; color: #475569;">${order.shippingAddress}</p>
      </div>
      <p style="margin-top: 30px; color: #64748b; font-size: 12px; text-align: center;">If you have any questions, please contact our support team.</p>
    </div>
  `;
  return sendEmail(to, subject, html);
};

const sendAdminOrderNotificationEmail = async (adminEmail, order, items, user) => {
  const subject = `New Order Received - #${1000 + order.id}`;
  const itemsHtml = items.map(item => {
    const price = item.price || item.Product?.sellingPrice || 0;
    return `<li>${item.Product?.name || 'Product'} (x${item.quantity}) - $${(price * item.quantity).toFixed(2)}</li>`;
  }).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a;">New Order Alert!</h2>
      <p>A new order has been placed by <strong>${user.name || user.email}</strong>.</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Order ID:</strong> #${1000 + order.id}</p>
        <p><strong>Total Amount:</strong> $${order.totalAmount}</p>
        <p><strong>Customer Email:</strong> ${user.email}</p>
      </div>
      <h4>Items:</h4>
      <ul>${itemsHtml}</ul>
      <h4>Shipping Address:</h4>
      <p>${order.shippingAddress}</p>
      <p style="margin-top: 30px;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/orders" style="background: #0f172a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Manage Order</a></p>
    </div>
  `;
  return sendEmail(adminEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendOrderConfirmationEmail,
  sendAdminOrderNotificationEmail
};
