require("dotenv").config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false, // Disable logging SQL queries in console
});

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Sequelize Connected to the database');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
})();

module.exports = sequelize;