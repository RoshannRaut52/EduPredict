const express = require('express');
const router = express.Router();

router.get('/:departmentId/students', async (req, res) => {
  const departmentId = parseInt(req.params.departmentId);
  const result = await pool.query(
    'SELECT * FROM students WHERE department_id = $1',
    [departmentId]
  );
  res.json(result.rows);
});

module.exports = router;