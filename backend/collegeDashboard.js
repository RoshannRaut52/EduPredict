const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ========================================
// DATABASE CONNECTION
// ========================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
router.use(cors());
router.use(express.json());

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.college = decoded;
    next();
  });
};

// ========================================
// COLLEGE REGISTRATION
// ========================================
router.post('/register', async (req, res) => {
  try {
    const { name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password } = req.body;

    if (!name || !code || !email || !password)
      return res.status(400).json({ error: 'Required fields missing' });

    const existing = await pool.query('SELECT * FROM colleges WHERE code = $1', [code]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'College code already exists' });

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO colleges (name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, name, email, code`,
      [name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password_hash]
    );

    res.status(201).json({ message: 'College registered successfully', college: result.rows[0] });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// COLLEGE LOGIN
// ========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT * FROM colleges WHERE email = $1', [email]);

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const college = result.rows[0];
    const valid = await bcrypt.compare(password, college.password_hash);

    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { college_id: college.id, email: college.email, code: college.code },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password_hash, ...collegeData } = college;

    res.json({ token, college: collegeData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// COLLEGE DASHBOARD
// ========================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const collegeId = req.college.college_id;

    const collegeResult = await pool.query(
      'SELECT id, name, code, email, principal_name FROM colleges WHERE id = $1',
      [collegeId]
    );

    if (collegeResult.rows.length === 0)
      return res.status(404).json({ error: 'College not found' });

    const college = collegeResult.rows[0];

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN risk_level = 'high' OR risk_level = 'medium' THEN 1 ELSE 0 END) as at_risk_students,
        SUM(CASE WHEN status = 'dropout' THEN 1 ELSE 0 END) as dropout_students,
        SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) as saved_students
      FROM students 
      WHERE college_id = $1
    `, [collegeId]);

    const stats = statsResult.rows[0] || {};
    res.json({ college, stats });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ========================================
// EXPORT ROUTER
// ========================================
module.exports = router;
