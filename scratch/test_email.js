const fs = require('fs');
const path = require('path');

// Mock nodemailer transporter so it doesn't try to send
const nodemailer = require('nodemailer');
nodemailer.createTransport = () => ({
  sendMail: async (options) => {
    console.log("HTML length:", options.html.length);
    fs.writeFileSync(path.join(__dirname, 'output.html'), options.html);
    console.log("Saved generated HTML to scratch/output.html");
    return { messageId: 'test-id' };
  }
});

// Now import emailHelper (it will use the mocked transport)
const { sendAdminOrderNotificationEmail } = require('../utils/emailHelper');

const order = {
  id: 7,
  totalAmount: 1500.00,
  shippingAddress: '123 Main St, Chennai'
};
const items = [
  {
    quantity: 1,
    price: 1500.00,
    Product: {
      name: 'Premium Leather Bag',
      sellingPrice: 1500.00
    }
  }
];
const user = {
  name: 'Sridhar J',
  email: 'jayamproj@gmail.com'
};

sendAdminOrderNotificationEmail('admin@example.com', order, items, user)
  .then(() => console.log("Done"))
  .catch(console.error);
