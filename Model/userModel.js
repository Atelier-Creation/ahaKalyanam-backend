const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../Config/sequelizeQueries'); // Database connection

const User = sequelize.define('User', {
  reg_no: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
    },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false
    },
  user_mail: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
    },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: false
    }, 
    user_role: {
        type: DataTypes.STRING,
        allowNull: false,
    },

}, {
  timestamps: false, // Adds `createdAt` & `updatedAt`
  tableName: 'userDetails'
});

module.exports = User;
