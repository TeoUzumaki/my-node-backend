const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

app.use(express.json());
app.use(cors());

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

// Path to your links.json file
const LINKS_FILE = path.join(__dirname, 'links.json');

// Shared links array (loaded from links.json)
let sharedLinks = [];

// Load links from links.json on server start
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = fs.readFileSync(LINKS_FILE, 'utf-8');
      sharedLinks = JSON.parse(data);
      console.log(`Loaded ${sharedLinks.length} links from links.json`);
    } else {
      sharedLinks = [];
      console.log('links.json not found, starting with empty links array');
    }
  } catch (err) {
    console.error('Error loading links.json:', err);
    sharedLinks = [];
  }
}

// Save current sharedLinks to links.json (async with callback to catch errors)
function saveLinks() {
  fs.writeFile(LINKS_FILE, JSON.stringify(sharedLinks, null, 2), 'utf-8', (err) => {
    if (err) {
      console.error('Error saving links.json:', err);
    } else {
      console.log('links.json saved successfully');
    }
  });
}

// Load links immediately on startup
loadLinks();

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

    console.log("Password match:", passwordMatch);

    if (!passwordMatch) {
      return res.status(401).send('Invalid username or password');
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

    res.json({ token });
  });
});

// Get all links (shared)
app.get('/links', authenticateToken, (req, res) => {
  res.json(sharedLinks);
});

// Add a new link (shared)
app.post('/links', authenticateToken, (req, res) => {
  let { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);
  console.log('Adding link:', normalizedUrl);

  const normalizedLinks = sharedLinks.map(link => normalizeUrl(link));

  if (!normalizedLinks.includes(normalizedUrl)) {
    sharedLinks.push(normalizedUrl);
    saveLinks();
    console.log('Link added and saved.');
  } else {
    console.log('Link already exists, not adding.');
  }

  res.status(201).send('Link added');
});

// Delete a link (shared)
app.delete('/links', authenticateToken, (req, res) => {
  let { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);
  console.log('Deleting link:', normalizedUrl);

  const normalizedLinks = sharedLinks.map(link => normalizeUrl(link));
  const index = normalizedLinks.indexOf(normalizedUrl);

  if (index === -1) {
    console.log('Link not found.');
    return res.status(404).send('Link not found');
  }

  sharedLinks.splice(index, 1);
  saveLinks();
  console.log('Link deleted and saved.');

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

