const mariadb = require('mariadb');
const { ApiError } = require('../utils/errorHandler');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process. env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit:  5,
  supportBigNumbers: true,
  bigNumberStrings: false,
  insertIdAsNumber: true
});

async function getConnection() {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new ApiError(503, 'Database connection failed', {
      details: error.message
    });
  }
}

// Handle pool errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Add BigInt serializer globally
BigInt.prototype.toJSON = function() {
  return Number(this);
};

console.log('Database pool created successfully');

module.exports = { getConnection, pool };
