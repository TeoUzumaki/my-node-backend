const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
require('dotenv').config();

// ✅ Use SendGrid SMTP instead of Gmail
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey', // <-- literally the word "apikey"
    pass: process.env.SENDGRID_API_KEY // from SendGrid dashboard
  }
});

async function sendLoginNotification(username, timestamp, ipRaw) {
  const ipList = ipRaw.split(',').map(ip => ip.trim());
  const publicIp = ipList.find(
    ip => !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('192.168')
  );

  let locationInfo = 'unknown location';

  if (publicIp) {
    try {
      const response = await fetch(`http://ip-api.com/json/${publicIp}`);
      const data = await response.json();

      if (data.status === 'success') {
        locationInfo = `${data.city}, ${data.regionName}, ${data.country} (ISP: ${data.isp})`;
      }
    } catch (error) {
      console.error('🌐 Failed to fetch IP location:', error.message);
    }
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM, // must be a verified sender in SendGrid
    to: process.env.EMAIL_TO,     // your destination inbox
    subject: `🔐 Login Alert: ${username}`,
    text: `User "${username}" logged in at ${timestamp}
IP: ${publicIp || ipRaw}
Location: ${locationInfo}`
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent:', info.response || info.messageId);
  } catch (error) {
    console.error('❌ Email failed to send:', error);
  }
}

module.exports = sendLoginNotification;



