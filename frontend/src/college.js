const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db'); // PostgreSQL connection

// ========== COLLEGE LOGIN ==========
router.post('/api/college/login', async (req, res) => {
  try {
    const { code, email, password } = req.body;

    // Validate input
    if (!code || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Find college by code and email
    const result = await pool.query(
      'SELECT * FROM colleges WHERE college_code = $1 AND email = $2 AND is_active = TRUE',
      [code, email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const college = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, college.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get or create statistics for this college
    await pool.query('SELECT update_college_statistics($1)', [college.id]);

    // Fetch latest statistics
    const statsResult = await pool.query(
      'SELECT * FROM college_statistics WHERE college_id = $1',
      [college.id]
    );

    const stats = statsResult.rows[0] || {
      total_students: 0,
      at_risk_students: 0,
      dropout_students: 0,
      saved_students: 0,
      notifications_to_parents: 0,
      notifications_to_teachers: 0
    };

    // Generate JWT token
    const token = jwt.sign(
      { 
        collegeId: college.id, 
        email: college.email, 
        role: 'college'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send response with college data + statistics
    res.json({
      success: true,
      token,
      college: {
        id: college.id,
        name: college.college_name,
        code: college.college_code,
        email: college.email,
        logo_url: college.logo_url,
        total_students: stats.total_students,
        at_risk_students: stats.at_risk_students,
        dropout_students: stats.dropout_students,
        saved_students: stats.saved_students,
        notifications_to_parents: stats.notifications_to_parents,
        notifications_to_teachers: stats.notifications_to_teachers
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ========== GET COLLEGE DASHBOARD DATA ==========
router.get('/api/college/dashboard', authenticateToken, async (req, res) => {
  try {
    const collegeId = req.user.collegeId;

    // Update statistics
    await pool.query('SELECT update_college_statistics($1)', [collegeId]);

    // Fetch college info
    const collegeResult = await pool.query(
      'SELECT id, college_name, college_code, email, logo_url FROM colleges WHERE id = $1',
      [collegeId]
    );

    const college = collegeResult.rows[0];

    // Fetch statistics
    const statsResult = await pool.query(
      'SELECT * FROM college_statistics WHERE college_id = $1',
      [collegeId]
    );

    const stats = statsResult.rows[0];

    // Fetch department-wise breakdown
    const deptResult = await pool.query(`
      SELECT 
        d.department_name,
        d.department_code,
        COUNT(s.id) as student_count,
        SUM(CASE WHEN s.prediction = 'High' THEN 1 ELSE 0 END) as at_risk_count
      FROM departments d
      LEFT JOIN students s ON s.department_id = d.id
      WHERE d.college_id = $1 AND d.is_active = TRUE
      GROUP BY d.id, d.department_name, d.department_code
      ORDER BY d.department_name
    `, [collegeId]);

    res.json({
      college: {
        id: college.id,
        name: college.college_name,
        code: college.college_code,
        email: college.email,
        logo_url: college.logo_url
      },
      statistics: {
        total_students: stats.total_students,
        at_risk_students: stats.at_risk_students,
        dropout_students: stats.dropout_students,
        saved_students: stats.saved_students,
        notifications_to_parents: stats.notifications_to_parents,
        notifications_to_teachers: stats.notifications_to_teachers
      },
      departments: deptResult.rows
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

module.exports = router;
