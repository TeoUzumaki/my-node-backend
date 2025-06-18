const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function sendLoginNotification(username, timestamp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `🔐 Login Alert: ${username}`,
    text: `User "${username}" logged in at ${timestamp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ Email failed to send:', error);
    } else {
      console.log('📧 Email sent:', info.response);
    }
  });
}

module.exports = sendLoginNotification;
