const bcrypt = require('bcrypt');
const pool = require('./db');

async function setupAdmin() {
  try {
    const name = 'Super Admin';
    const email = 'admin@edupredict.com';
    const password = 'admin123';
    
    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO admins (name, email, password_hash) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (email) DO NOTHING 
       RETURNING id, name, email, created_at`,
      [name, email, password_hash]
    );

    if (result.rows.length > 0) {
      console.log('✅ Admin created successfully!');
      console.log('📧 Email:', email);
      console.log('🔑 Password:', password);
    } else {
      console.log('ℹ️ Admin already exists.');
    }

    process.exit();
  } catch (err) {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
  }
}

setupAdmin();