const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.college = user;
    next();
  });
};

// ========================================
// GET DASHBOARD DATA
// ========================================
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const collegeCode = req.college.college_code;

    const collegeResult = await pool.query(
      'SELECT code, name, email, principal_name FROM colleges WHERE code = $1',
      [collegeCode]
    );

    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = collegeResult.rows[0];

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
router.get('/:collegeCode/departments', authenticateToken, async (req, res) => {
  try {
    // ✅ Convert to number since code is INT
    const collegeCode = parseInt(req.params.collegeCode);

    // ✅ Compare numbers
    if (collegeCode !== req.college.college_code) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT d.id, d.name, d.code, d.created_at
       FROM departments d
       WHERE d.college_code = $1
       ORDER BY d.name ASC`,
      [collegeCode]
    );

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
router.post('/:collegeCode/departments', authenticateToken, async (req, res) => {
  try {
    const collegeCode = parseInt(req.params.collegeCode);
    const { name, code } = req.body; // ✅ Accept code from frontend

    console.log('📥 Add department request:', { collegeCode, name, code, user: req.college });

    if (collegeCode !== req.college.college_code) {
      console.error('❌ Unauthorized: College code mismatch');
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const existing = await pool.query(
      'SELECT * FROM departments WHERE college_code = $1 AND LOWER(name) = LOWER($2)',
      [collegeCode, name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    // ✅ Use provided code or NULL
    const deptCode = code ? parseInt(code) : null;

    const result = await pool.query(
      `INSERT INTO departments (college_code, name, code, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, code, created_at`,
      [collegeCode, name.trim(), deptCode]
    );

    console.log('✅ Department added:', result.rows[0]);

    res.status(201).json({
      message: 'Department added successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('❌ Error adding department:', err);
    return res.status(500).json({ error: 'Failed to add department', details: err.message });
  }
});


// ========================================
// DELETE DEPARTMENT
// ========================================
router.delete('/:collegeCode/departments/:departmentId', authenticateToken, async (req, res) => {
  try {
    // ✅ Convert to number since code is INT
    const collegeCode = parseInt(req.params.collegeCode);
    const departmentId = parseInt(req.params.departmentId);

    // ✅ Compare numbers
    if (collegeCode !== req.college.college_code) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 AND college_code = $2 RETURNING *',
      [departmentId, collegeCode]
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
