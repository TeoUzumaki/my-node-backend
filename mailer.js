const https = require('https');
require('dotenv').config();

// Helper function to fetch IP location from ipapi.co
function lookupIp(ipRaw) {
  return new Promise((resolve) => {
    const options = {
      host: 'ipapi.co',
      port: 443,
      path: `/${ipRaw}/json/`,
      headers: { 'User-Agent': 'nodejs-ipapi-v1.02' }
    };

    https.get(options, (resp) => {
      let body = '';

      resp.on('data', (chunk) => {
        body += chunk;
      });

      resp.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data && data.city) {
            resolve(`${data.city}, ${data.region}, ${data.country_name} (ISP: ${data.org || 'Unknown ISP'})`);
          } else {
            resolve('Unknown location');
          }
        } catch (err) {
          console.error('⚠️ Failed to parse IP data:', err.message);
          resolve('Unknown location');
        }
      });
    }).on('error', (err) => {
      console.error('⚠️ IP lookup request failed:', err.message);
      resolve('Unknown location');
    });
  });
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


