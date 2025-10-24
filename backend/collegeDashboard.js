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
// GET ALL DEPARTMENTS (with year-wise stats)
// ========================================
router.get('/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;

    console.log('Fetching departments for college:', collegeId);

    // Verify college ownership
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

    // Get year-wise student stats for each department
    for (let dept of result.rows) {
      const yearStats = await pool.query(`
        SELECT 
          year,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) as saved,
          SUM(CASE WHEN risk_level IN ('high', 'medium') THEN 1 ELSE 0 END) as risk
        FROM students
        WHERE department_id = $1
        GROUP BY year
        ORDER BY year
      `, [dept.id]);

      // Create year stats map
      const yearMap = {};
      yearStats.rows.forEach(y => {
        yearMap[y.year] = {
          year: `${y.year}${y.year === 1 ? 'st' : y.year === 2 ? 'nd' : y.year === 3 ? 'rd' : 'th'} Year`,
          total: parseInt(y.total) || 0,
          saved: parseInt(y.saved) || 0,
          risk: parseInt(y.risk) || 0
        };
      });

      // Fill in missing years with zeros
      dept.years = [1, 2, 3, 4].map(year => 
        yearMap[year] || {
          year: `${year}${year === 1 ? 'st' : year === 2 ? 'nd' : year === 3 ? 'rd' : 'th'} Year`,
          total: 0,
          saved: 0,
          risk: 0
        }
      );
    }

    console.log('Departments fetched successfully:', result.rows.length);

    res.json({
      departments: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error fetching departments:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch departments',
      message: err.message 
    });
  }
});

// ========================================
// ADD NEW DEPARTMENT
// ========================================
router.post('/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { name } = req.body;

    console.log('Add Department Request:', { 
      collegeId, 
      name, 
      authenticated_college_id: req.college.college_id 
    });

    // Verify college ownership
    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate department name
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Check if department already exists
    const existing = await pool.query(
      'SELECT * FROM departments WHERE college_id = $1 AND LOWER(name) = LOWER($2)',
      [collegeId, name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    // Generate department code (first 4 letters, uppercase, no spaces)
    const code = name.trim().substring(0, 4).toUpperCase().replace(/\s/g, '');

    // Insert department
    const result = await pool.query(
      `INSERT INTO departments (college_id, name, code, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, code, created_at`,
      [collegeId, name.trim(), code]
    );

    console.log('Department added successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Department added successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('Error adding department:', err);
    return res.status(500).json({ 
      error: 'Failed to add department',
      message: err.message 
    });
  }
});

// ========================================
// DELETE DEPARTMENT
// ========================================
router.delete('/:collegeId/departments/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { collegeId, departmentId } = req.params;

    console.log('Delete Department Request:', { collegeId, departmentId });

    // Verify college ownership
    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if department has students
    const studentCheck = await pool.query(
      'SELECT COUNT(*) as count FROM students WHERE department_id = $1',
      [departmentId]
    );

    if (parseInt(studentCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete department with existing students. Please reassign or remove students first.'
      });
    }

    // Check if department has teachers
    const teacherCheck = await pool.query(
      'SELECT COUNT(*) as count FROM teachers WHERE department_id = $1',
      [departmentId]
    );

    if (parseInt(teacherCheck.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete department with existing teachers. Please reassign or remove teachers first.'
      });
    }

    // Delete department
    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 AND college_id = $2 RETURNING *',
      [departmentId, collegeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    console.log('Department deleted successfully:', result.rows[0]);

    res.json({ 
      message: 'Department deleted successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('Error deleting department:', err);
    return res.status(500).json({ 
      error: 'Failed to delete department',
      message: err.message 
    });
  }
});

// ========================================
// EXPORT ROUTER
// ========================================
module.exports = router;
