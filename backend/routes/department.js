const express = require('express');
const router = express.Router();
const pool = require('../db'); // Adjust path if needed

// List all students in a department
router.get('/:departmentId/students', async (req, res) => {
  const departmentId = parseInt(req.params.departmentId);
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE department_code = $1',
      [departmentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Yearly stats summary
router.get('/:departmentId/years/summary', async (req, res) => {
  const departmentId = parseInt(req.params.departmentId);
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
      [departmentId]
    );
    res.json({ years: result.rows }); // Now returns { years: [...] }
  } catch (err) {
    console.error('Year summary error:', err);
    res.status(500).json({ error: 'Failed to fetch year summary' });
  }
});

module.exports = router;
