const { Pool } = require('pg');
require('dotenv').config();

console.log('🚀 Connecting to Render PostgreSQL...');

// Use your Render PostgreSQL database
const pool = new Pool({
  connectionString: 'postgresql://roshan:I7u6c6YSS0VS7Bd19jVoRvTo5abKwkzz@dpg-d9gfc4f41pts738ovr9g-a.oregon-postgres.render.com/edupredict_jzzn',
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Render PostgreSQL connection error:', err.message);
    console.error('Please check your database credentials');
  } else {
    console.log('✅ Connected to Render PostgreSQL successfully!');
    release();
  }
});

module.exports = pool;