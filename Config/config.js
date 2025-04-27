const mysql = require('mysql2');
require("dotenv").config();
const { Sequelize, DataTypes } = require('sequelize');



const connection = mysql.createConnection({
  host:"139.59.56.128",
  user:"ahamat",
  password: "AtelierCreation@2019A",
  database: "ahamat"
});


connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database');
});



module.exports = connection; //Export the connection to be used in other files.       