const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');
const sendLoginNotification = require('./mailer'); // Email notification module

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// Normalize URLs to ensure consistent storage & comparison
function normalizeUrl(url) {
  let normalized = url.trim();

  // Add protocol if missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }

  // Remove trailing slashes for uniformity
  normalized = normalized.replace(/\/+$/, '');

  return normalized.toLowerCase();
}

// Users loaded from environment variables, passwords hashed at startup
const users = [
  {
    username: process.env.USER_1_USERNAME,
    passwordHash: bcrypt.hashSync(process.env.USER_1_PASSWORD, 10)
  },
  {
    username: process.env.USER_2_USERNAME,
    passwordHash: bcrypt.hashSync(process.env.USER_2_PASSWORD, 10)
  },
  {
    username: process.env.USER_3_USERNAME,
    passwordHash: bcrypt.hashSync(process.env.USER_3_PASSWORD, 10)
  }
];

console.log('Users loaded:', users.map(u => u.username));

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }

  const user = users.find(u => u.username === username);
  console.log("User found:", user ? username : null);

  if (!user) {
    return res.status(401).send('Invalid username or password');
  }

  bcrypt.compare(password, user.passwordHash, (err, passwordMatch) => {
    if (err) {
      return res.status(500).send('Error processing password');
    }

    if (!passwordMatch) {
      return res.status(401).send('Invalid username or password');
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

    // Get IP address
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ip = rawIp?.replace(/^.*:/, ''); // Removes IPv6 prefix if present

    const timestamp = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
    sendLoginNotification(username, timestamp, ip);

    res.json({ token });
  });
});

// Get all links (shared, public)
app.get('/links', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT url FROM links ORDER BY created_at DESC');
    const urls = result.rows.map(row => row.url);
    res.json(urls);
  } catch (err) {
    console.error('Error fetching links:', err);
    res.status(500).send('Server error');
  }
});

// Add a new link (shared, public)
app.post('/links', authenticateToken, async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);

  try {
    await pool.query(
      'INSERT INTO links (url) VALUES ($1) ON CONFLICT (url) DO NOTHING',
      [normalizedUrl]
    );
    res.status(201).send('Link added');
  } catch (err) {
    console.error('Error adding link:', err);
    res.status(500).send('Server error');
  }
});

// Delete a link (shared, public)
app.delete('/links', authenticateToken, async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);

  try {
    const result = await pool.query('DELETE FROM links WHERE url = $1', [normalizedUrl]);
    if (result.rowCount === 0) {
      return res.status(404).send('Link not found');
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Error deleting link:', err);
    res.status(500).send('Server error');
  }
});

// Health check route for frontend server status detection
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
