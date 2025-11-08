const fetch = require('node-fetch');
require('dotenv').config();

// Function to lookup IP location with a fallback API
async function lookupIp(ipRaw) {
  try {
    // Primary lookup: ipapi.co
    const primary = await fetch(`https://ipapi.co/${ipRaw}/json/`);
    const data = await primary.json();

    if (data.error || !data.city) {
      throw new Error("Primary IP lookup failed or hit limit");
    }

    return `${data.city}, ${data.region}, ${data.country_name} (ISP: ${data.org || 'Unknown ISP'})`;
  } catch (err) {
    console.warn("⚠️ Primary IP lookup failed:", err.message);

    // Backup lookup: ipwho.is
    try {
      const backup = await fetch(`https://ipwho.is/${ipRaw}`);
      const data2 = await backup.json();

      if (!data2.success) throw new Error("Backup lookup failed");

      return `${data2.city}, ${data2.region}, ${data2.country} (ISP: ${data2.connection?.isp || 'Unknown ISP'})`;
    } catch (err2) {
      console.warn("⚠️ Backup IP lookup failed:", err2.message);
      return "Unknown location";
    }
  }
}

async function sendLoginNotification(username, timestamp, ipRaw) {
  // Handle multiple IPs (e.g., from proxies)
  const ipList = ipRaw.split(',').map(ip => ip.trim());
  const publicIp = ipList.find(ip => !ip.startsWith('10.') && !ip.startsWith('172.') && !ip.startsWith('192.168'));

  // Get location info with fallback
  let locationInfo = 'unknown location';
  if (publicIp) {
    locationInfo = await lookupIp(publicIp);
  }

  // Build the email content
  const emailData = {
    from: "Login Bot <onboarding@resend.dev>", // Safe Resend sender
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
