require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

//connection to collegeDashboard.js
const collegeDashboard = require('./collegeDashboard');

const app = express();

// Mount its routes
app.use('/api/college', collegeDashboard);

// ==============================
// 🔹 PostgreSQL Connection
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://database_8suu_user:JhWakO3g5BhqleKSRSd87yFw3tOpf5xF@dpg-d3imcvadbo4c73fs18rg-a.oregon-postgres.render.com/database_8suu?sslmode=require"
  
});



// ==============================
// 🔹 Middlewares
// ==============================
app.use(cors({ origin: "https://edu-predict-sih.vercel.app" })); // adjust origin if running locally
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================
// 🔹 Root
// ==============================
app.get('/', (req, res) => {
  res.send('EduPredict API is running.');
});



// ====================================================
// 🏫 COLLEGE REGISTRATION & LOGIN (Already Working)
// ====================================================
app.post('/api/colleges/register', async (req, res) => {
  const aided = req.body.aided === 'true';
  try {
    const {
      name, code, address, city, state, pincode,
      email, phone, principal_name,
      college_type, category, aided, password
    } = req.body;

    if (!name || !code || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO colleges (name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id,name,email,code`,
      [name, code, address, city, state, pincode, email, phone, principal_name, college_type, category, aided, password_hash]
    );

    res.status(201).json({ message: "College Registered", college: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'College code or email already exists.' });
    } else {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// ========================================
// COLLEGE LOGIN
// ========================================
app.post('/api/college/login', async (req, res) => {
  try {
    console.log('📥 Login request:', req.body);

    const { code, email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Query database
    const result = await pool.query(
      'SELECT * FROM colleges WHERE email = $1',
      [email]
    );

    console.log('📊 Query result:', result.rows.length, 'colleges found');

    if (result.rows.length === 0) {
      console.log('❌ No college found with email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const college = result.rows[0];
    
    // Verify password
    const valid = await bcrypt.compare(password, college.password_hash);

    if (!valid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        college_id: college.id, 
        email: college.email, 
        code: college.code 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password_hash, ...collegeData } = college;

    console.log('✅ Login successful for:', email);
    console.log('✅ Token generated:', token.substring(0, 20) + '...');

    // ✅ IMPORTANT: Return JSON with token and college
    return res.status(200).json({ 
      token: token,
      college: collegeData 
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json({ 
      error: 'Server error',
      message: err.message 
    });
  }
});


// ====================================================
// 🎓 STUDENT REGISTRATION & LOGIN (Already Working)
// ====================================================

// 🟢 Register

// Student Registration Route
app.post('/register/student', async (req, res) => {
  try {
    const { roll_no, name, email, contact, college_code, course, password, confirm_password } = req.body;

    // Validate all required fields
    if (!roll_no || !name || !email || !contact || !college_code || !password || !confirm_password) {
      return res.status(400).json({ message: 'All required fields must be filled.' });
    }

    // Password match check
    if (password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Roll number uniqueness check
    const duplicateRoll = await pool.query('SELECT 1 FROM students WHERE roll_no = $1', [roll_no]);
    if (duplicateRoll.rowCount > 0) {
      return res.status(409).json({ message: 'Roll number already registered.' });
    }

    // Email uniqueness check
    const duplicateEmail = await pool.query('SELECT 1 FROM students WHERE email = $1', [email]);
    if (duplicateEmail.rowCount > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert student (add more fields as needed)
    const result = await pool.query(
      `INSERT INTO students (roll_no, name, email, contact, college_code, course, password_hash, year, semester)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, roll_no, name, email, college_code`,
      [roll_no, name, email, contact, college_code, course, hashedPassword, 1, 1]
    );

    res.status(201).json({ message: '✅ Registration successful!', student: result.rows[0] });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = app;


// 🟡 Login
app.post('/login/student', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const result = await pool.query(
      'SELECT * FROM students WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email.' });
    }

    const student = result.rows[0];
    const valid = await bcrypt.compare(password, student.password_hash);

    if (!valid) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    const { password_hash, ...studentData } = student;
    res.json({ message: '✅ Login successful!', student: studentData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});




// ====================================================
// 👨‍👩‍👧 PARENT REGISTRATION & LOGIN (NEWLY ADDED)
// ====================================================

// 🟢 Register Parent
app.post('/register/parent', async (req, res) => {
  try {
    const { name, email, phone, student_email, relationship, password, confirm_password } = req.body;

    if (!name || !email || !phone || !student_email || !relationship || !password || !confirm_password) {
      return res.status(400).json({ message: 'All required fields must be filled.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Check if student exists
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE email = $1',
      [student_email]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student with this email not found.' });
    }

    const student_id = studentResult.rows[0].id;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO parents (name, email, phone, student_id, relationship, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, relationship`,
      [name, email, phone, student_id, relationship, hashedPassword]
    );

    res.status(201).json({ message: '✅ Parent registration successful!', parent: result.rows[0] });
  } catch (err) {
    console.error('Parent registration error:', err);
    if (err.code === '23505') {
      res.status(409).json({ message: 'Email already registered.' });
    } else {
      res.status(500).json({ message: 'Server error.' });
    }
  }
});

// 🟡 Login Parent
app.post('/login/parent', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const result = await pool.query(
      `SELECT p.*, s.name as student_name 
       FROM parents p 
       LEFT JOIN students s ON p.student_id = s.id 
       WHERE p.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email.' });
    }

    const parent = result.rows[0];
    const valid = await bcrypt.compare(password, parent.password_hash);

    if (!valid) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    const { password_hash, ...parentData } = parent;
    res.json({ message: '✅ Login successful!', parent: parentData });
  } catch (err) {
    console.error('Parent login error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});



// ====================================================
// 🚀 Start Server
// ====================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


// registration and login for teacher

app.post('/register/teacher', async (req, res) => {
  try {
    const { name, email, subject, department, password, confirm_password } = req.body;

    // Field validations
    if (!name || !email || !subject || !department || !password || !confirm_password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Check for duplicate email
    const emailCheck = await pool.query(
      'SELECT 1 FROM teachers WHERE email = $1',
      [email]
    );
    if (emailCheck.rowCount > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert teacher
    const insertRes = await pool.query(
      `INSERT INTO teachers
        (name, email, password_hash, subject, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING teacher_id, name, email, subject, department, created_at`,
      [name, email, password_hash, subject, department]
    );
    res.status(201).json({ message: "✅ Registration successful!", teacher: insertRes.rows[0] });

  } catch (err) {
    console.error('Teacher registration error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});


// login

app.post('/api/teacher/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Query by email only
    const result = await pool.query(
      `SELECT * FROM teachers WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email.' });
    }

    const teacher = result.rows[0];
    const valid = await bcrypt.compare(password, teacher.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Remove password_hash from response
    const { password_hash, ...teacherData } = teacher;
    res.json(teacherData);

  } catch (err) {
    console.error('Teacher login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

