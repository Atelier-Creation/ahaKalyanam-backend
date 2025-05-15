const User = require('../Model/userModel');

const connection = require('../Config/config');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load .env variables


const updateUserDetails = async (userId, updatedFields) => {
  try {
    if (!userId || Object.keys(updatedFields).length === 0) {
      throw new Error("User ID and updated fields are required.");
    }

    const setClause = Object.keys(updatedFields)
      .map(field => `${field} = ?`)
      .join(', ');
    const values = [...Object.values(updatedFields), userId];

    const query = `UPDATE users SET ${setClause} WHERE user_id = ?`;

    const [result] = await connection.execute(query, values);

    console.log('Result:', result);

    if (result.affectedRows === 0) {
      console.log('❌ No user updated. Check the user ID.');
      return { result: false, message: 'User not found' };
    }

    console.log('✅ User updated successfully!');
    return { result: true, message: 'User updated successfully' };

  } catch (error) {
    console.error('❌ Error updating user:', error.message);
    return { result: false, message: 'Error updating user', error: error.message };
  }
};


const getQuickSearch = async (gender, min_age, max_age, religion, caste, sub_caste, marital_status) => {
  const QUICK_SEARCH = `
    SELECT * FROM user_profiles 
    WHERE (? IS NULL OR gender = ?)
      AND (? IS NULL OR age >= ?)
      AND (? IS NULL OR age <= ?)
      AND (? IS NULL OR religion = ?)
      AND (? IS NULL OR caste = ?)
      AND (? IS NULL OR sub_caste = ?)
      AND (? IS NULL OR marital_status = ?)
  `;

  try {
    const [results] = await connection.execute(QUICK_SEARCH, [
      gender, gender,
      min_age, min_age,
      max_age, max_age,
      religion, religion,
      caste, caste,
      sub_caste, sub_caste,
      marital_status, marital_status
    ]);

    if (results.length === 0) {
      return {
        status: 401,
        message: "No profile found for this filter"
      };
    }

    return {
      status: 200,
      message: "Quick search results",
      data: results
    };

  } catch (error) {
    console.error('❌ Error in quick search:', error.message);
    return {
      status: 500,
      message: "Database error",
      error: error.message
    };
  }
};




const loginCheck = async (email, password) => {
  const LOGIN_USER = `SELECT * FROM users WHERE mail_id = ?`;

  try {
    const [results] = await connection.execute(LOGIN_USER, [email]);

    if (results.length === 0) {
      return { status: 401, error: 'Invalid email or account deactivated' };
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { status: 401, error: 'Invalid email or password' };
    }

    const token = jwt.sign(
      { user_id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '6h' }
    );

    return {
      status: 200,
      message: 'Login successful',
      token: token
    };

  } catch (error) {
    console.error('❌ Error during login:', error.message);
    return { status: 500, error: 'Server error' };
  }
};



const createUser = async (name, email, phone, password, gender) => {
  const role = gender === "Female" ? "moderator" : "user";
  
  const CREATE_USER = `
    INSERT INTO users (name, mail_id, password, phone, register_number, gender, role)
    VALUES (?, ?, ?, ?, 
      CONCAT('REG-', UPPER(SUBSTRING(MD5(RAND()), 1, 6))), 
      ?, ?);
  `;

  const SELECT_USER = `SELECT * FROM users WHERE mail_id = ?`;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.execute(CREATE_USER, [
      name, email, hashedPassword, phone, gender, role
    ]);

    const [user] = await connection.execute(SELECT_USER, [email]);

    if (!user || user.length === 0) {
      throw new Error("User creation failed or user not found after registration.");
    }

    const token = jwt.sign(
      { user_id: user[0].id, role: user[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '6h' }
    );

    return {
      status: 200,
      message: 'User registered successfully!',
      token: token,
      user_id: user[0].id,
    };

  } catch (err) {
    console.error('❌ Error during user creation:', err.message);
    throw new Error('Error during user creation: ' + err.message);
  }
};





const getAllProfile = async () => {
  const GET_ALL_USERS = `SELECT * FROM user_profiles;`;

  try {
    const [users] = await connection.execute(GET_ALL_USERS);  // Using await with execute

    if (users.length === 0) {
      throw new Error("No users found.");
    }

    return users;
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    throw new Error("Error fetching users: " + err.message);
  }
};





const getProfile = async (register_id) => {
  const GET_USER_PROFILE = `SELECT * FROM user_profiles WHERE id = ?`;

  try {
    const [result] = await connection.execute(GET_USER_PROFILE, [register_id]);

    if (result.length === 0) {
      throw new Error("User not found");
    }

    return result[0]; // Return the first matching user
  } catch (err) {
    console.error("❌ Error fetching user:", err.message);
    throw new Error("Error fetching user: " + err.message);
  }
};
const getProfileById = async (register_id) => {
  const GET_USER_PROFILE = `SELECT * FROM user_profiles WHERE linked_to = ?`;

  try {
    const [result] = await connection.execute(GET_USER_PROFILE, [register_id]);

    if (result.length === 0) {
      throw new Error("User not found");
    }

    return result[0]; // Return the first matching user
  } catch (err) {
    console.error("❌ Error fetching user:", err.message);
    throw new Error("Error fetching user: " + err.message);
  }
};

const getViewProfile = async (register_id) => {
  const GET_USER_PROFILE = `
    SELECT 
      up.*, 
      u.mail_id, 
      u.password,
      u.role
    FROM user_profiles up
    JOIN users u ON up.linked_to = u.id
    WHERE up.id = ?;
  `;

  try {
    const [result] = await connection.execute(GET_USER_PROFILE, [register_id]);

    if (result.length === 0) {
      throw new Error("User not found");
    }

    return result[0]; // Return the first matching user
  } catch (err) {
    console.error("❌ Error fetching user:", err.message);
    throw new Error("Error fetching user: " + err.message);
  }
};


const resetUserPassword = async (user_id, new_password_hash) => {
  const RESET_PASSWORD_QUERY = "UPDATE users SET password = ? WHERE mail_id = ?";

  try {
    const [results] = await connection.execute(RESET_PASSWORD_QUERY, [new_password_hash, user_id]);

    if (results.affectedRows === 0) {
      throw new Error("User not found");
    }

    return { success: true, message: "Password reset successfully" };
  } catch (error) {
    console.error("❌ Error resetting password:", error.message);
    throw { success: false, message: "Error resetting password", error };
  }
};






const addUserInterests = async (user_id, liked_profile_id) => {
  const CHECK_EXISTENCE = `
    SELECT 1 FROM user_liked_profiles WHERE user_id = ? AND liked_profiles = ?
  `;

  const ADD_USER_INTERESTS = `
    INSERT INTO user_liked_profiles(user_id, liked_profiles) VALUES (?, ?)
  `;

  try {
    const [existing] = await connection.execute(CHECK_EXISTENCE, [user_id, liked_profile_id]);

    if (existing.length > 0) {
      return {
        success: false,
        message: "Interest already sent previously."
      };
    }

    const [results] = await connection.execute(ADD_USER_INTERESTS, [user_id, liked_profile_id]);

    return {
      success: true,
      message: "Liked profile added successfully",
      inserted_id: results.insertId,
    };
  } catch (error) {
    console.error("❌ Error adding liked profile:", error.message);
    throw {
      success: false,
      message: "Error adding liked profile",
      error,
    };
  }
};






const updateProfile = async (userId, updatedFields) => {

  const validFields = Object.keys(updatedFields).filter(field => {
    return updatedFields[field] !== undefined && updatedFields[field] !== null && updatedFields[field] !== '';
  });


  if (validFields.length === 0) {

    throw new Error("No valid fields provided for update.");
  }

  // Handle potential array values and empty strings for numeric fields
  validFields.forEach(field => {
    if (Array.isArray(updatedFields[field])) {
      updatedFields[field] = updatedFields[field][0];  // Take the first element if it's an array
    }

    // Set empty strings to null for numeric fields like income and height
    if ((field === 'income_per_month' || field === 'partner_income' || field === 'weight' || field === 'age' || field === 'height' || field === 'no_of_siblings') && updatedFields[field] === '') {
      updatedFields[field] = null;
    }

    if (field === 'horoscope_required') {
      updatedFields[field] = updatedFields[field] === 'Must' ? 1 : 0;  // Convert 'Must' to 1, otherwise 0
    }
  });

  // Prepare SQL query
  const updateQuery = `UPDATE user_profiles SET ${validFields.map(field => `${field} = ?`).join(', ')} WHERE linked_to = ?`;

  // Prepare values for the query (the valid fields + userId)
  const values = [...validFields.map(field => updatedFields[field]), userId];


  try {
    const [result] = await connection.execute(updateQuery, values);

    if (result.affectedRows === 0) {
      throw new Error("No rows affected. User not found or no changes made.");
    }
    return { userId, updatedFields, result};
  } catch (error) {
    console.error("Error updating user profile:", error.message); 
    throw new Error("Error updating user profile: " + error.message);
  }
};






module.exports = { updateUserDetails, loginCheck, createUser,getProfileById, resetUserPassword, getAllProfile, getProfile, getViewProfile, updateProfile, addUserInterests, getQuickSearch};
