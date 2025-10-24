const express = require('express');
const { Pool } = require('pg');
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

// ✅ NO MIDDLEWARE HERE - they're in server.js

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.college = decoded;
    next();
  });
};

// ========================================
// COLLEGE DASHBOARD
// ✅ FIXED: /dashboard instead of /api/college/dashboard
// ========================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const collegeId = req.college.college_id;

    const collegeResult = await pool.query(
      'SELECT id, name, code, email, principal_name FROM colleges WHERE id = $1',
      [collegeId]
    );

    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = collegeResult.rows[0];

    // Return with dummy stats for now
    res.json({
      ...college,
      total_students: 0,
      at_risk_students: 0,
      dropout_students: 0,
      saved_students: 0,
      notifications_to_parents: 0,
      notifications_to_teachers: 0
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ========================================
// GET ALL DEPARTMENTS
// ========================================
router.get('/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;

    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT d.id, d.name, d.code, d.created_at
       FROM departments d
       WHERE d.college_id = $1
       ORDER BY d.name ASC`,
      [collegeId]
    );

    // Add year stats
    for (let dept of result.rows) {
      dept.years = [1, 2, 3, 4].map(year => ({
        year: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year`,
        total: 0,
        saved: 0,
        risk: 0
      }));
    }

    res.json({
      departments: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error fetching departments:', err);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// ========================================
// ADD NEW DEPARTMENT
// ========================================
router.post('/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { name } = req.body;

    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const existing = await pool.query(
      'SELECT * FROM departments WHERE college_id = $1 AND LOWER(name) = LOWER($2)',
      [collegeId, name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    const code = name.trim().substring(0, 4).toUpperCase().replace(/\s/g, '');

    const result = await pool.query(
      `INSERT INTO departments (college_id, name, code, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, code, created_at`,
      [collegeId, name.trim(), code]
    );

    res.status(201).json({
      message: 'Department added successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('Error adding department:', err);
    return res.status(500).json({ error: 'Failed to add department' });
  }
});

// ========================================
// DELETE DEPARTMENT
// ========================================
router.delete('/:collegeId/departments/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { collegeId, departmentId } = req.params;

    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 AND college_id = $2 RETURNING *',
      [departmentId, collegeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ 
      message: 'Department deleted successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('Error deleting department:', err);
    return res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
