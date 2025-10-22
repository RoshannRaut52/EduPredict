const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT Secret
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

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.college = decoded;
    next();
  });
};

// ========================================
// COLLEGE REGISTRATION
// ========================================
app.post('/api/college/register', async (req, res) => {
  try {
    const { name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password } = req.body;

    if (!name || !code || !email || !password) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if college code already exists
    const existing = await pool.query('SELECT * FROM colleges WHERE code = $1', [code]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'College code already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert college
    const result = await pool.query(
      `INSERT INTO colleges (name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
app.post('/api/college/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM colleges WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const college = result.rows[0];
    const valid = await bcrypt.compare(password, college.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
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
app.get('/api/college/dashboard', authenticateToken, async (req, res) => {
  try {
    const collegeId = req.college.college_id;

    // Fetch college info
    const collegeResult = await pool.query(
      'SELECT id, name, code, email, principal_name FROM colleges WHERE id = $1',
      [collegeId]
    );

    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = collegeResult.rows[0];

    // Fetch student statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN risk_level = 'high' OR risk_level = 'medium' THEN 1 ELSE 0 END) as at_risk_students,
        SUM(CASE WHEN status = 'dropout' THEN 1 ELSE 0 END) as dropout_students,
        SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) as saved_students
      FROM students 
      WHERE college_id = $1
    `, [collegeId]);

    const stats = statsResult.rows[0] || {
      total_students: 0,
      at_risk_students: 0,
      dropout_students: 0,
      saved_students: 0
    };

    // Fetch notification counts
    const notifResult = await pool.query(`
      SELECT 
        SUM(CASE WHEN recipient_type = 'parent' THEN 1 ELSE 0 END) as notifications_to_parents,
        SUM(CASE WHEN recipient_type = 'teacher' THEN 1 ELSE 0 END) as notifications_to_teachers
      FROM notifications 
      WHERE college_id = $1
    `, [collegeId]);

    const notifs = notifResult.rows[0] || {
      notifications_to_parents: 0,
      notifications_to_teachers: 0
    };

    res.json({
      ...college,
      total_students: parseInt(stats.total_students) || 0,
      at_risk_students: parseInt(stats.at_risk_students) || 0,
      dropout_students: parseInt(stats.dropout_students) || 0,
      saved_students: parseInt(stats.saved_students) || 0,
      notifications_to_parents: parseInt(notifs.notifications_to_parents) || 0,
      notifications_to_teachers: parseInt(notifs.notifications_to_teachers) || 0
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ========================================
// DEPARTMENTS MANAGEMENT
// ========================================

// Get all departments
app.get('/api/college/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;

    // Verify college ownership
    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT d.id, d.name, d.code, d.created_at,
              COUNT(DISTINCT s.id) as student_count,
              COUNT(DISTINCT t.id) as teacher_count
       FROM departments d
       LEFT JOIN students s ON s.department_id = d.id
       LEFT JOIN teachers t ON t.department_id = d.id
       WHERE d.college_id = $1
       GROUP BY d.id, d.name, d.code, d.created_at
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

      dept.years = yearStats.rows.map(y => ({
        year: `${y.year}${y.year === 1 ? 'st' : y.year === 2 ? 'nd' : y.year === 3 ? 'rd' : 'th'} Year`,
        total: parseInt(y.total) || 0,
        saved: parseInt(y.saved) || 0,
        risk: parseInt(y.risk) || 0
      }));
    }

    res.json({
      departments: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Add new department
app.post('/api/college/:collegeId/departments', authenticateToken, async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { name } = req.body;

    if (parseInt(collegeId) !== req.college.college_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Check if department already exists
    const existing = await pool.query(
      'SELECT * FROM departments WHERE college_id = $1 AND LOWER(name) = LOWER($2)',
      [collegeId, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Department already exists' });
    }

    // Generate department code (first 4 letters uppercase)
    const code = name.substring(0, 4).toUpperCase().replace(/\s/g, '');

    const result = await pool.query(
      `INSERT INTO departments (college_id, name, code, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [collegeId, name.trim(), code]
    );

    res.status(201).json({
      message: 'Department added successfully',
      department: result.rows[0]
    });

  } catch (err) {
    console.error('Error adding department:', err);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

// Delete department
app.delete('/api/college/:collegeId/departments/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { collegeId, departmentId } = req.params;

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

    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 AND college_id = $2 RETURNING *',
      [departmentId, collegeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ message: 'Department deleted successfully' });

  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});