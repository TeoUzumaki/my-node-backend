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

console.log('Users loaded:', users);

const LINKS_FILE = path.join(__dirname, 'links.json');

let sharedLinks = [];

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

function saveLinks() {
  try {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(sharedLinks, null, 2), 'utf-8');
    console.log('links.json saved');
  } catch (err) {
    console.error('Error saving links.json:', err);
  }
}

// URL normalization helper
function normalizeUrl(url) {
  let normalized = url.trim();

  if (/^www\./i.test(normalized)) {
    normalized = 'http://' + normalized;
  } else if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }

  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.toLowerCase();

  return normalized;
}

loadLinks();

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

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }

  const user = users.find(u => u.username === username);
  console.log("User found:", user);

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

app.get('/links', authenticateToken, (req, res) => {
  // Return normalized links
  const normalizedLinks = sharedLinks.map(link => normalizeUrl(link));
  res.json(normalizedLinks);
});

app.post('/links', authenticateToken, (req, res) => {
  let { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);

  const normalizedLinks = sharedLinks.map(link => normalizeUrl(link));

  if (!normalizedLinks.includes(normalizedUrl)) {
    sharedLinks.push(normalizedUrl);
    saveLinks();
  }

  res.status(201).send('Link added');
});

app.delete('/links', authenticateToken, (req, res) => {
  let { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  const normalizedUrl = normalizeUrl(url);

  const normalizedLinks = sharedLinks.map(link => normalizeUrl(link));
  const index = normalizedLinks.indexOf(normalizedUrl);

  if (index === -1) {
    return res.status(404).send('Link not found');
  }

  sharedLinks.splice(index, 1);
  saveLinks();

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

