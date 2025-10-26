const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
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
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.college = user;
    next();
  });
};

// ========================================
// GET ALL COLLEGES (PUBLIC - NO AUTH)
// ========================================
router.get('/colleges', async (req, res) => {
  try {
    console.log('📥 Request: GET all colleges');
    
    const result = await pool.query(
      'SELECT code, name FROM colleges ORDER BY name ASC'
    );

    console.log(`✅ Found ${result.rows.length} colleges`);

    res.json({
      colleges: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error fetching colleges:', error);
    res.status(500).json({ error: 'Failed to fetch colleges', details: error.message });
  }
});

// ========================================
// GET DEPARTMENTS BY COLLEGE CODE (PUBLIC)
// ========================================
router.get('/colleges/:collegeCode/departments', async (req, res) => {
  try {
    const collegeCode = parseInt(req.params.collegeCode);
    console.log('📥 Request: GET departments for college:', collegeCode);

    const result = await pool.query(
      'SELECT id, name FROM departments WHERE college_code = $1 ORDER BY name ASC',
      [collegeCode]
    );

    console.log(`✅ Found ${result.rows.length} departments`);

    res.json({
      departments: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

// ========================================
// SUBMIT STUDENT REGISTRATION REQUEST
// ========================================
router.post('/submit', async (req, res) => {
  try {
    const { name, email, contact, college_code, department_id, password } = req.body;

    console.log('📥 Student registration request:', { name, email, college_code, department_id });

    // Validation
    if (!name || !email || !contact || !college_code || !department_id || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify college exists
    const collegeResult = await pool.query(
      'SELECT code, name FROM colleges WHERE code = $1',
      [parseInt(college_code)]
    );

    if (collegeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid college code' });
    }

    // Verify department exists and belongs to college
    const deptResult = await pool.query(
      'SELECT id, name FROM departments WHERE id = $1 AND college_code = $2',
      [parseInt(department_id), parseInt(college_code)]
    );

    if (deptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid department or department does not belong to this college' });
    }

    // Check if already requested with this email
    const existingRequest = await pool.query(
      'SELECT id FROM student_requests WHERE college_code = $1 AND email = $2',
      [parseInt(college_code), email]
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Registration request already exists for this email' });
    }

    // Check if already a student with this email
    const existingStudent = await pool.query(
      'SELECT id FROM students WHERE email = $1',
      [email]
    );

    if (existingStudent.rows.length > 0) {
      return res.status(400).json({ error: 'Student with this email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert registration request
    const result = await pool.query(
      `INSERT INTO student_requests 
       (college_code, department_id, name, email, contact, password_hash, status, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING id, name, email, requested_at`,
      [parseInt(college_code), parseInt(department_id), name, email, contact, password_hash]
    );

    console.log('✅ Student request submitted:', result.rows[0]);

    res.status(201).json({
      message: 'Registration request submitted successfully! Please wait for college approval.',
      request: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error submitting student request:', error);
    res.status(500).json({ error: 'Failed to submit registration request', details: error.message });
  }
});

// ========================================
// GET ALL PENDING REQUESTS FOR A COLLEGE
// ========================================
router.get('/:collegeCode/pending', authenticateToken, async (req, res) => {
  try {
    const collegeCode = parseInt(req.params.collegeCode);

    if (collegeCode !== req.college.college_code) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT 
         sr.id, sr.name, sr.email, sr.contact, sr.requested_at,
         d.name as department_name, sr.department_id
       FROM student_requests sr
       JOIN departments d ON sr.department_id = d.id
       WHERE sr.college_code = $1 AND sr.status = 'pending'
       ORDER BY sr.requested_at DESC`,
      [collegeCode]
    );

    console.log(`✅ Found ${result.rows.length} pending requests`);

    res.json({
      requests: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests', details: error.message });
  }
});

// ========================================
// APPROVE STUDENT REQUEST
// ========================================
router.post('/:collegeCode/approve/:requestId', authenticateToken, async (req, res) => {
  try {
    const collegeCode = parseInt(req.params.collegeCode);
    const requestId = parseInt(req.params.requestId);
    const { roll_no, year } = req.body;

    console.log('📥 Approve request:', { collegeCode, requestId, roll_no, year });

    if (collegeCode !== req.college.college_code) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!roll_no || !year) {
      return res.status(400).json({ error: 'Roll number and year are required' });
    }

    // Get request details
    const requestResult = await pool.query(
      'SELECT * FROM student_requests WHERE id = $1 AND college_code = $2 AND status = $3',
      [requestId, collegeCode, 'pending']
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const request = requestResult.rows[0];

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Insert into students table
      const studentResult = await pool.query(
        `INSERT INTO students 
         (department_id, roll_no, name, email, contact, year, password_hash, alert_status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'safe', NOW())
         RETURNING id, roll_no, name, email`,
        [request.department_id, roll_no, request.name, request.email, request.contact, year, request.password_hash]
      );

      // Update request status
      await pool.query(
        `UPDATE student_requests 
         SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1, roll_no = $2, year = $3
         WHERE id = $4`,
        [req.college.email, roll_no, year, requestId]
      );

      await pool.query('COMMIT');

      console.log('✅ Student approved and added:', studentResult.rows[0]);

      res.json({
        message: 'Student request approved successfully',
        student: studentResult.rows[0]
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Error approving request:', error);
    res.status(500).json({ error: 'Failed to approve request', details: error.message });
  }
});

// ========================================
// REJECT STUDENT REQUEST
// ========================================
router.post('/:collegeCode/reject/:requestId', authenticateToken, async (req, res) => {
  try {
    const collegeCode = parseInt(req.params.collegeCode);
    const requestId = parseInt(req.params.requestId);

    if (collegeCode !== req.college.college_code) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `UPDATE student_requests 
       SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
       WHERE id = $2 AND college_code = $3 AND status = 'pending'
       RETURNING id, name, email`,
      [req.college.email, requestId, collegeCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    console.log('✅ Student request rejected:', result.rows[0]);

    res.json({
      message: 'Student request rejected',
      request: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error rejecting request:', error);
    res.status(500).json({ error: 'Failed to reject request', details: error.message });
  }
});

module.exports = router;
