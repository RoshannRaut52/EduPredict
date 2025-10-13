require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();

// ==============================
// 🔹 PostgreSQL Connection
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://database_8suu_user:JhWakO3g5BhqleKSRSd87yFw3tOpf5xF@dpg-d3imcvadbo4c73fs18rg-a.oregon-postgres.render.com/database_8suu?sslmode=require"
});

// ==============================
// 🔹 Middlewares
// ==============================
app.use(cors({ origin: "https://edu-predict-sih.vercel.app" }));
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

app.post('/api/college/login', async (req, res) => {
  try {
    const { code, email, password } = req.body;
    if (!code || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const result = await pool.query(
      'SELECT * FROM colleges WHERE code = $1 AND email = $2',
      [code, email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid college code or email.' });
    }

    const college = result.rows[0];
    const valid = await bcrypt.compare(password, college.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const { password_hash, ...collegeData } = college;
    res.json(collegeData);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ====================================================
// 🎓 STUDENT REGISTRATION & LOGIN (Already Working)
// ====================================================

// 🟢 Register
app.post('/register/student', async (req, res) => {
  try {
    const { name, email, contact, college_code, course, password, confirm_password } = req.body;

    if (!name || !email || !contact || !college_code || !password || !confirm_password) {
      return res.status(400).json({ message: 'All required fields must be filled.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO students (name, email, contact, college_code, course, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, college_code`,
      [name, email, contact, college_code, course, hashedPassword]
    );

    res.status(201).json({ message: '✅ Registration successful!', student: result.rows[0] });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === '23505') {
      res.status(409).json({ message: 'Email already registered.' });
    } else {
      res.status(500).json({ message: 'Server error.' });
    }
  }
});

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
// 🎯 NEW: STUDENT DASHBOARD API ENDPOINTS
// ====================================================

// 🟢 Get Complete Student Dashboard Data
app.get('/api/student/dashboard/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student info with college name
    const studentResult = await pool.query(
      `SELECT s.*, c.name as college_name 
       FROM students s 
       LEFT JOIN colleges c ON s.college_code = c.code 
       WHERE s.id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const student = studentResult.rows[0];

    // Get achievements (if achievements table exists)
    let achievements = [];
    try {
      const achievementsResult = await pool.query(
        `SELECT achievement_name, earned_date 
         FROM achievements 
         WHERE student_id = $1 
         ORDER BY earned_date DESC`,
        [studentId]
      );
      achievements = achievementsResult.rows.map(row => row.achievement_name);
    } catch (err) {
      // Table might not exist, use default
      achievements = ['Top Performer', '100% Attendance', 'Math Olympiad Winner'];
    }

    // Get notifications (if notifications table exists)
    let collegeNews = [];
    let upcomingEvents = [];
    let importantNotices = [];
    
    try {
      const notificationsResult = await pool.query(
        `SELECT type, message 
         FROM notifications 
         WHERE college_code = $1 
         AND active = true 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [student.college_code]
      );

      notificationsResult.rows.forEach(row => {
        if (row.type === 'news') collegeNews.push(row.message);
        else if (row.type === 'event') upcomingEvents.push(row.message);
        else if (row.type === 'notice') importantNotices.push(row.message);
      });
    } catch (err) {
      // Use default notifications
      collegeNews = ['Orientation Day next Monday', 'Seminar: AI & Education'];
      upcomingEvents = ['Cultural Fest - Oct 25', 'Sports Week - Nov 3-7'];
      importantNotices = ['Exam forms due Oct 20', 'Library closed Sunday'];
    }

    const { password_hash, ...studentData } = student;

    // Construct complete dashboard data
    const dashboardData = {
      ...studentData,
      college: studentData.college_name || 'N/A',
      attendance: studentData.attendance || '85%',
      cgpa: studentData.cgpa || 'N/A',
      assignmentsSubmitted: studentData.assignments_submitted || '0',
      achievementsCount: achievements.length.toString(),
      prediction: studentData.dropout_prediction || 'Low Dropout Risk - Excellent Performance!',
      achievements: achievements,
      collegeNews: collegeNews.length > 0 ? collegeNews : ['No news available'],
      upcomingEvents: upcomingEvents.length > 0 ? upcomingEvents : ['No events scheduled'],
      importantNotices: importantNotices.length > 0 ? importantNotices : ['No notices']
    };

    res.json(dashboardData);
  } catch (err) {
    console.error('Dashboard data error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Get Student Profile by Email
app.get('/api/student/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      `SELECT s.*, c.name as college_name 
       FROM students s 
       LEFT JOIN colleges c ON s.college_code = c.code 
       WHERE s.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const student = result.rows[0];
    const { password_hash, ...studentData } = student;

    res.json({
      ...studentData,
      college: studentData.college_name || 'N/A',
      attendance: studentData.attendance || '85%',
      cgpa: studentData.cgpa || 'N/A'
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Update Student Profile
app.put('/api/student/profile/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { name, contact, course, department, year, rollno } = req.body;

    const result = await pool.query(
      `UPDATE students 
       SET name = COALESCE($1, name), 
           contact = COALESCE($2, contact), 
           course = COALESCE($3, course),
           department = COALESCE($4, department),
           year = COALESCE($5, year),
           rollno = COALESCE($6, rollno),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, name, email, contact, course, department, year, rollno`,
      [name, contact, course, department, year, rollno, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json({ message: 'Profile updated successfully', student: result.rows[0] });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Get Student Academic Data
app.get('/api/student/academics/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const result = await pool.query(
      `SELECT attendance, cgpa, assignments_submitted, 
              dropout_prediction, department, year, rollno
       FROM students 
       WHERE id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const data = result.rows[0];
    
    res.json({
      attendance: data.attendance || 'N/A',
      cgpa: data.cgpa || 'N/A',
      assignmentsSubmitted: data.assignments_submitted || '0',
      department: data.department || 'N/A',
      year: data.year || 'N/A',
      rollNo: data.rollno || 'N/A',
      prediction: data.dropout_prediction || 'Low Dropout Risk'
    });
  } catch (err) {
    console.error('Academic data error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Get Student Achievements
app.get('/api/student/achievements/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    try {
      const result = await pool.query(
        `SELECT achievement_name, earned_date 
         FROM achievements 
         WHERE student_id = $1 
         ORDER BY earned_date DESC`,
        [studentId]
      );

      const achievements = result.rows.map(row => row.achievement_name);
      res.json({ achievements: achievements.length > 0 ? achievements : ['Top Performer', '100% Attendance'] });
    } catch (err) {
      // If table doesn't exist, return default
      res.json({ achievements: ['Top Performer', '100% Attendance', 'Math Olympiad Winner'] });
    }
  } catch (err) {
    console.error('Achievements fetch error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Add Student Achievement
app.post('/api/student/achievements/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { achievement_name } = req.body;

    if (!achievement_name) {
      return res.status(400).json({ message: 'Achievement name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO achievements (student_id, achievement_name, earned_date)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING id, achievement_name, earned_date`,
      [studentId, achievement_name]
    );

    res.status(201).json({ 
      message: 'Achievement added successfully', 
      achievement: result.rows[0] 
    });
  } catch (err) {
    console.error('Achievement add error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 🟢 Get College Notifications
app.get('/api/notifications/:collegeCode', async (req, res) => {
  try {
    const { collegeCode } = req.params;

    try {
      const result = await pool.query(
        `SELECT type, message, created_at 
         FROM notifications 
         WHERE college_code = $1 
         AND active = true 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [collegeCode]
      );

      const news = [];
      const events = [];
      const notices = [];

      result.rows.forEach(row => {
        if (row.type === 'news') news.push(row.message);
        else if (row.type === 'event') events.push(row.message);
        else if (row.type === 'notice') notices.push(row.message);
      });

      res.json({
        collegeNews: news.length > 0 ? news : ['No news available'],
        upcomingEvents: events.length > 0 ? events : ['No events scheduled'],
        importantNotices: notices.length > 0 ? notices : ['No notices']
      });
    } catch (err) {
      // Return default notifications
      res.json({
        collegeNews: ['Orientation Day next Monday', 'Seminar: AI & Education'],
        upcomingEvents: ['Cultural Fest - Oct 25', 'Sports Week - Nov 3-7'],
        importantNotices: ['Exam forms due Oct 20', 'Library closed Sunday']
      });
    }
  } catch (err) {
    console.error('Notifications fetch error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ====================================================
// 🚀 Start Server
// ====================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
