const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendLoginNotification(username, timestamp, ipRaw) {
  const ipList = ipRaw.split(',').map(ip => ip.trim());
  const publicIp = ipList.find(ip => !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('192.168'));

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
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `🔐 Login Alert: ${username}`,
    text: `User "${username}" logged in at ${timestamp}\nIP: ${publicIp || ipRaw}\nLocation: ${locationInfo}`
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

