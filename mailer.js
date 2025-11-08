const fetch = require('node-fetch');
require('dotenv').config();

async function sendLoginNotification(username, timestamp, ipRaw) {
  const ipList = ipRaw.split(',').map(ip => ip.trim());
  const publicIp = ipList.find(ip => !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('192.168'));

  let locationInfo = 'unknown location';

  if (publicIp) {
    try {
      const response = await fetch(`https://ipwho.is/${publicIp}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          locationInfo = `${data.city}, ${data.region}, ${data.country} (ISP: ${data.connection.isp})`;
        }
      }
    } catch (error) {
      console.error('🌐 Failed to fetch IP location:', error.message);
    }
  }

  // Construct email content
  const emailData = {
    from: process.env.EMAIL_USER, // e.g. "Your App <you@yourdomain.com>"
    to: process.env.EMAIL_TO,
    subject: `🔐 Login Alert: ${username}`,
    text: `User "${username}" logged in at ${timestamp}\nIP: ${publicIp || ipRaw}\nLocation: ${locationInfo}`
  };

  // Send via Resend API
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Email failed to send via Resend:', errorText);
    } else {
      console.log('📧 Email sent via Resend!');
    }
  } catch (error) {
    console.error('❌ Error sending email via Resend:', error.message);
  }
}

module.exports = sendLoginNotification;
