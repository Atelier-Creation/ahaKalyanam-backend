const mysql = require('mysql2/promise');
require("dotenv").config();

// Create a Promise-based pool
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, 
  queueLimit: 0
});

// Retry logic to reconnect if the initial connection fails
const handleReconnect = async (retries, delay) => {
  let attempts = 0;

  while (attempts < retries) {
    try {
      console.log(`Attempting to connect to the database... (Attempt ${attempts + 1} of ${retries})`);
      
      // Try executing a simple query to check the connection
      await connection.execute('SELECT 1');
      console.log('Database connection successful!');
      return; // Exit the loop if connection is successful
    } catch (error) {
      console.error('Error connecting to the database:', error.message);

      if (attempts >= retries - 1) {
        console.error('Max retries reached, unable to connect to the database.');
        process.exit(1); // Exit if max retries are reached
      }

      // Retry after delay
      attempts++;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay)); // Wait for delay
    }
  }
};

// Test database connection with retry mechanism
const testConnection = async () => {
  await handleReconnect(5, 2000); // Retry 5 times with a 2-second delay between each retry
};

testConnection();

module.exports = connection;