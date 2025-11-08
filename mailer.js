const fetch = require('node-fetch');
require('dotenv').config();

// Helper function to lookup IP location using ipinfo.io
async function lookupIp(ipRaw) {
  try {
    const tokenPart = process.env.IPINFO_TOKEN ? `?token=${process.env.IPINFO_TOKEN}` : '';
    const res = await fetch(`https://ipinfo.io/${ipRaw}/json${tokenPart}`);
    const data = await res.json();

    if (data && data.city) {
      return `${data.city}, ${data.region}, ${data.country} (ISP: ${data.org || 'Unknown ISP'})`;
    } else {
      console.warn(`⚠️ IP lookup failed for ${ipRaw}: No city in response`);
      return 'Unknown location';
    }
  } catch (err) {
    console.warn(`⚠️ IP lookup request failed for ${ipRaw}: ${err.message}`);
    return 'Unknown location';
  }
}

async function sendLoginNotification(username, timestamp, ipRaw) {
  // Handle multiple IPs (from proxies)
  const ipList = ipRaw.split(',').map(ip => ip.trim());
  const publicIp = ipList.find(ip => !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('192.168'));

  // Get location info
  let locationInfo = 'Unknown location';
  if (publicIp) {
    locationInfo = await lookupIp(publicIp);
  }

  // Build the email
  const emailData = {
    from: "Login Bot <onboarding@resend.dev>",
    to: process.env.EMAIL_TO,
    subject: `🔐 Login Alert: ${username}`,
    text: `User "${username}" logged in at ${timestamp}\nIP: ${publicIp || ipRaw}\nLocation: ${locationInfo}`
  };

  // Send via Resend
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
