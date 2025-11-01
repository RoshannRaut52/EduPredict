const express = require('express');
const router = express.Router();
const pool = require('../db'); // Adjust path if needed

// List all students in a department
router.get('/:departmentCode/students', async (req, res) => {
  const departmentCode = parseInt(req.params.departmentCode);
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE department_code = $1',
      [departmentCode]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Yearly stats summary
router.get('/:departmentCode/years/summary', async (req, res) => {
  const departmentCode = parseInt(req.params.departmentCode);
  try {
    const result = await pool.query(
      `SELECT year, 
         COUNT(*) AS total,
         SUM(CASE WHEN alert_status = 0 THEN 1 ELSE 0 END) AS saved,
         SUM(CASE WHEN alert_status = 1 THEN 1 ELSE 0 END) AS risk
       FROM students 
       WHERE department_code = $1
       GROUP BY year
       ORDER BY year ASC`,
      [departmentCode]
    );
    res.json({ years: result.rows }); // Now returns { years: [...] }
  } catch (err) {
    console.error('Year summary error:', err);
    res.status(500).json({ error: 'Failed to fetch year summary' });
  }
});

//student List
router.get('/:departmentCode/students', async (req, res) => {
  const departmentCode = req.params.departmentCode;
  const year = req.query.year; // Get year from query param

  try {
    let query = 'SELECT * FROM students WHERE department_code = $1';
    let params = [departmentCode];

    if (year) {
      query += ' AND year = $2';
      params.push(year);
    }

    const result = await pool.query(query, params);

    // Optionally get department name (recommended for your sidebar)
    const deptResult = await pool.query(
      'SELECT name FROM departments WHERE code = $1',
      [departmentCode]
    );
    const departmentName = deptResult.rows[0]?.name || '';

    res.json({
      students: result.rows,
      department_name: departmentName,
    });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

module.exports = router;
