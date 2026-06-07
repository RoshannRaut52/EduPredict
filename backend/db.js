const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 only - THIS FIXES THE IPv6 ISSUE
dns.setDefaultResultOrder('ipv4first');

console.log('🚀 Connecting to Supabase (permanent database)...');

const pool = new Pool({
  host: 'db.eufhkibqqfswyhmnfchg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '123Roshan123@#',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  // Force TCP keepalive
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Supabase connection error:', err.message);
  } else {
    console.log('✅ Connected to Supabase successfully!');
    release();
  }
});

module.exports = pool;