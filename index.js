const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY;

app.use(express.json());
app.use(cors());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).send('Invalid username or password');
  bcrypt.compare(password, user.passwordHash, (err, match) => {
    if (!match) return res.status(401).send('Invalid username or password');
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  });
});

// 🔗 Link Routes
app.get('/links', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT url FROM links ORDER BY created_at DESC');
  res.json(result.rows.map(r => r.url));
});

app.post('/links', authenticateToken, async (req, res) => {
  const url = req.body.url?.trim();
  if (!url) return res.status(400).send('Missing URL');
  const normalized = url.toLowerCase().replace(/\/+$/, '');
  await pool.query('INSERT INTO links (url) VALUES ($1) ON CONFLICT (url) DO NOTHING', [normalized]);
  res.status(201).send('Link added');
});

app.delete('/links', authenticateToken, async (req, res) => {
  const url = req.body.url?.trim().toLowerCase().replace(/\/+$/, '');
  const result = await pool.query('DELETE FROM links WHERE url = $1', [url]);
  if (result.rowCount === 0) return res.status(404).send('Link not found');
  res.sendStatus(200);
});

// 🧵 Message Board Routes
app.get('/messages', async (req, res) => {
  const sort = req.query.sort === 'oldest' ? 'ASC' : 'DESC';
  const result = await pool.query(
    `SELECT * FROM messages ORDER BY created_at ${sort}`
  );
  res.json(result.rows);
});

app.post('/messages', async (req, res) => {
  const { content, parent_id = null } = req.body;
  if (!content) return res.status(400).send('Missing content');
  await pool.query(
    'INSERT INTO messages (content, parent_id) VALUES ($1, $2)',
    [content, parent_id]
  );
  res.status(201).send('Message posted');
});

app.post('/messages/:id/like', async (req, res) => {
  const { id } = req.params;
  await pool.query('UPDATE messages SET likes = likes + 1 WHERE id = $1', [id]);
  res.sendStatus(200);
});

app.delete('/messages/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM messages WHERE id = $1 OR parent_id = $1', [id]);
  res.sendStatus(200);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



