const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

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
  }
];

console.log('Users loaded:', users);

// In-memory storage for user links
const userLinks = {}; // e.g. { "teo": ["https://reddit.com/..."], ... }

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

// Route to get Reddit links for authenticated user
app.get('/links', authenticateToken, (req, res) => {
  const username = req.user.username;
  res.json(userLinks[username] || []);
});

// Route to post a new Reddit link for authenticated user
app.post('/links', authenticateToken, (req, res) => {
  const username = req.user.username;
  const { url } = req.body;

  if (!url) return res.status(400).send('Missing URL');

  if (!userLinks[username]) {
    userLinks[username] = [];
  }

  userLinks[username].push(url);
  res.status(201).send('Link added');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
