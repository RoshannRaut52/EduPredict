const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.college = user;
    next();
  });
};

// GET Colleges
router.get('/colleges', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT code, name FROM colleges ORDER BY name ASC'
    );
    res.json({ colleges: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch colleges', details: error.message });
  }
});

// GET Departments by College
router.get('/colleges/:collegeCode/departments', async (req, res) => {
  try {
    const collegeCode = Number(req.params.collegeCode);
    const result = await pool.query(
      'SELECT code, name FROM departments WHERE college_code = $1 ORDER BY name ASC',
      [collegeCode]
    );
    res.json({ departments: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments', details: error.message });
  }
});

// Submit Student Registration Request
router.post('/submit', async (req, res) => {
  try {
    const { name, email, contact, college_code, department_code, password } = req.body;
    if (!name || !email || !contact || !college_code || !department_code || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const cc = Number(college_code);
    const dc = Number(department_code);

    // College exists?
    const collegeResult = await pool.query(
      'SELECT code FROM colleges WHERE code = $1',
      [cc]
    );
    if (collegeResult.rows.length === 0)
      return res.status(404).json({ error: 'Invalid college code' });

    // Department exists and belongs to college?
    const deptResult = await pool.query(
      'SELECT code FROM departments WHERE code = $1 AND college_code = $2',
      [dc, cc]
    );
    if (deptResult.rows.length === 0)
      return res.status(404).json({ error: 'Invalid department or does not belong to this college' });

    // Check for duplicate request/student
    const existingRequest = await pool.query(
      'SELECT * FROM student_requests WHERE college_code = $1 AND email = $2',
      [cc, email]
    );
    if (existingRequest.rows.length > 0)
      return res.status(400).json({ error: 'Registration request already exists for this email' });

    const existingStudent = await pool.query(
      'SELECT roll_no FROM students WHERE email = $1',
      [email]
    );
    if (existingStudent.rows.length > 0)
      return res.status(400).json({ error: 'Student with this email already exists' });

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert registration request
    const result = await pool.query(
      `INSERT INTO student_requests
        (college_code, department_code, name, email, contact, password_hash, status, requested_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        RETURNING *`,
      [cc, dc, name, email, contact, password_hash]
    );
    res.status(201).json({
      message: 'Registration request submitted successfully! Please wait for college approval.',
      request: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit registration request', details: error.message });
  }
});

// Get All Pending Requests
router.get('/:collegeCode/pending', authenticateToken, async (req, res) => {
  try {
    const collegeCode = Number(req.params.collegeCode);
    if (collegeCode !== req.college.college_code)
      return res.status(403).json({ error: 'Access denied' });

    const result = await pool.query(
      `SELECT 
          sr.id, sr.name, sr.email, sr.contact, sr.requested_at,
          d.name as department_name, sr.department_code
        FROM student_requests sr
        JOIN departments d ON sr.department_code = d.code
        WHERE sr.college_code = $1 AND sr.status = 'pending'
        ORDER BY sr.requested_at DESC`,
      [collegeCode]
    );
    res.json({ requests: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests', details: error.message });
  }
});

// Approve Student Request
router.post('/:collegeCode/approve/:requestId', authenticateToken, async (req, res) => {
  try {
    const collegeCode = Number(req.params.collegeCode);
    const requestId = Number(req.params.requestId);
    const { roll_no, year } = req.body;

    if (collegeCode !== req.college.college_code)
      return res.status(403).json({ error: 'Access denied' });

    if (!roll_no || !year)
      return res.status(400).json({ error: 'Roll number and year are required' });

    // Get request details
    const requestResult = await pool.query(
      'SELECT * FROM student_requests WHERE id = $1 AND college_code = $2 AND status = $3',
      [requestId, collegeCode, 'pending']
    );
    if (requestResult.rows.length === 0)
      return res.status(404).json({ error: 'Request not found or already processed' });
    const request = requestResult.rows[0];

    await pool.query('BEGIN');
    try {
      // Insert student
      const studentResult = await pool.query(
        `INSERT INTO students
          (department_code, roll_no, name, email, contact, year, password_hash, alert_status, created_at, college_code)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, NOW(), $8)
          RETURNING roll_no, name, email`,
        [
          request.department_code,
          roll_no,
          request.name,
          request.email,
          request.contact,
          year,
          request.password_hash,
          request.college_code
        ]
      );

      // Update student's total count
      await pool.query(
        'UPDATE colleges SET total_student = total_student + 1 WHERE code = $1',
        [request.college_code]
      );

      // Change request status
      await pool.query(
        `UPDATE student_requests
          SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1, roll_no = $2, year = $3
          WHERE id = $4`,
        [req.college.email, roll_no, year, requestId]
      );

      await pool.query('COMMIT');
      res.json({
        message: 'Student request approved successfully',
        student: studentResult.rows[0]
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve request', details: error.message });
  }
});

// Reject Student Request
router.post('/:collegeCode/reject/:requestId', authenticateToken, async (req, res) => {
  try {
    const collegeCode = Number(req.params.collegeCode);
    const requestId = Number(req.params.requestId);

    if (collegeCode !== req.college.college_code)
      return res.status(403).json({ error: 'Access denied' });

    const result = await pool.query(
      `UPDATE student_requests 
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1
        WHERE id = $2 AND college_code = $3 AND status = 'pending'
        RETURNING id, name, email`,
      [req.college.email, requestId, collegeCode]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Request not found or already processed' });

    res.json({
      message: 'Student request rejected',
      request: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject request', details: error.message });
  }
});

module.exports = router;
