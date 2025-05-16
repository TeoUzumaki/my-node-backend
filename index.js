const dotenv = require('dotenv');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Use Heroku's dynamic port or fallback to 3000 locally
const SECRET_KEY = process.env.SECRET_KEY;

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());
app.use(cors());

// Add a root route to test
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// Example users (in a real app, you would use a database)
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

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }

  // Check if the username exists
  const user = users.find(u => u.username === username);
  console.log("User found:", user);  // Log the user found

  if (!user) {
    return res.status(401).send('Invalid username or password');
  }

  // Asynchronously check if the password matches
  bcrypt.compare(password, user.passwordHash, (err, passwordMatch) => {
    if (err) {
      return res.status(500).send('Error processing password');
    }

    console.log("Password match:", passwordMatch);  // Log the result of password comparison

    if (!passwordMatch) {
      return res.status(401).send('Invalid username or password');
    }

    // Generate a JWT token
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });

    // Respond with the token
    res.json({ token });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});







