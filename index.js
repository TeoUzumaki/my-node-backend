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

// Save current sharedLinks to links.json
function saveLinks() {
  try {
    fs.writeFileSync(LINKS_FILE, JSON.stringify(sharedLinks, null, 2), 'utf-8');
    console.log('links.json saved');
  } catch (err) {
    console.error('Error saving links.json:', err);
  }
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

// Login route (unchanged)
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

// Get all links (shared)
app.get('/links', authenticateToken, (req, res) => {
  res.json(sharedLinks);
});

// Add a new link (shared)
app.post('/links', authenticateToken, (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  if (!sharedLinks.includes(url)) {
    sharedLinks.push(url);
    saveLinks();
  }

  res.status(201).send('Link added');
});

// Delete a link (shared)
app.delete('/links', authenticateToken, (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  const index = sharedLinks.indexOf(url);
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

