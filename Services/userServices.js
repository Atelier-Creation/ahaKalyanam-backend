const User = require('../Model/userModel');

const connection = require('../Config/config');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load .env variables
require("dotenv").config(); // Load .env variables




const updateUserDetails = async (userId, updatedFields) => {
  try {
    // updatedFields.updated_at = new Date(); 

    // Update user details  
    const result = await User.update(updatedFields, {
      where: { user_id: userId },
    });

    console.log('Result:', result);

    if (result[0] === 0) {
      console.log('❌ No user updated. Check the user ID.');
      return { result: false, message: 'User not found' };
    }

    console.log('✅ User updated successfully!');
    return { result: true, message: 'User updated successfully' };
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return { result: false, message: 'Error updating user' };
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

  console.log("This is a quick search function!");
  console.log(gender, min_age, max_age, religion, caste, sub_caste, marital_status);

  return new Promise((resolve, reject) => {
      connection.query(
          QUICK_SEARCH, 
          [
            gender, gender,
            min_age, min_age,
            max_age, max_age,
            religion, religion,
            caste, caste,
            sub_caste, sub_caste,
            marital_status, marital_status
          ], // ✅ Fixed missing min_age & max_age
          (err, results) => {
              if (err) {
                  return reject({ status: 500, error: "Database error" }); // ✅ Fixed `status_is`
              }

              if (results.length === 0) {
                reject({
                  status: 401,
                  message: "No profile found for this filter",
              }); // ✅ Better error message
              }

              resolve({
                  status: 200,
                  message: "Quick search results",
                  data: results
              });
          }
      );
  });
};




const loginCheck = async (email, password) => {

    const LOGIN_USER = `SELECT * FROM users WHERE mail_id = ?`;
    console.log("The error is: ", password);
    
    return new Promise((resolve, reject) => {
      connection.query(LOGIN_USER, [email], async (err, results) => {
        if (err) {
          return reject({ status: 500, error: 'Database error' });
        }
  
          if (results.length === 0) {
          return reject({ status: 401, error: 'Invalid email or account deactivated' });
        }
  
        const user = results[0];
  
        try {
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return reject({ status: 401, error: 'Invalid email or password' });
          }

          console.log(user);
          console.log(process.env.JWT_SECRET);


          const token = jwt.sign(
            { user_id: user.id, role: user.role },  // Payload
            process.env.JWT_SECRET,                 // Secret Key (should be stored securely)
            { expiresIn: '6h' }                     // Options (expiry time, etc.)
        );
        console.log("The token is: ", token);
  
          resolve({
            status: 200,
            message: 'Login successful',
            token: token
          });
  
        } catch (error) {
          reject({ status: 500, error: 'Server error' });
        }
      });
    });
  };


  const 
  createUser = async (name, email, phone, password, gender) => {

    const role = gender === "Female" ? "moderator" : "user";

    const CREATE_USER = `
INSERT INTO users (name, mail_id, password, phone, register_number, gender, role)
VALUES (?, ?, ?, ?, 
  CONCAT('REG-', UPPER(SUBSTRING(MD5(RAND()), 1, 6))), 
  ?, ?);
`;


    const SELECT_USER = `SELECT * FROM users WHERE mail_id = ?`;

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // ✅ Hash password correctly

        return new Promise((resolve, reject) => {
            connection.query(CREATE_USER, [name, email, hashedPassword, phone, gender, role], (err, result) => {
                if (err) {
                    reject(new Error('Error inserting data: ' + err.message)); // ✅ Improved error handling
                } else {
                    const userId = result.insertId;
                    connection.query(SELECT_USER, [email], (err, user_role_result) => {
                        if (err) {
                            reject(new Error('Error fetching user data: ' + err.message));
                        } else {


                          const user = user_role_result[0];

                          console.log(user.id);
                          console.log(user.role);

                          
                          const token = jwt.sign(
                            { user_id: user.id, 
                              role: user.role },  // Payload
                            process.env.JWT_SECRET,                 // Secret Key (should be stored securely)
                            { expiresIn: '6h' }                     // Options (expiry time, etc.)
                        );
                          
                            resolve({
                                status: 200,
                                message: 'User registered successfully!',
                                token: token,
                                user_id: user.id,
                            });
                        }
                    });
                }
            });
        });

    } catch (err) {
        throw new Error('Error hashing password: ' + err.message);
    }
};




const getAllProfile = async () => {
  const GET_ALL_USERS = `SELECT * FROM user_profiles;`;

  try {
      const users = await new Promise((resolve, reject) => {
          connection.query(GET_ALL_USERS, (err, result) => {
              if (err) {
                  reject(new Error("Error fetching users: " + err.message));
              } else {
                  resolve(result); // Return fetched users
              }
          });
      });

      return users; // Return users instead of using `res`
  } catch (err) {
      throw new Error(err.message); // Throw error so it can be caught in the route handler
  }
};




  const getProfile = async (register_id) => {
    console.log("This is log function");
    const GET_USER_PROFILE = `SELECT * FROM user_profiles WHERE id = ?`;

    return new Promise((resolve, reject) => {
        connection.query(GET_USER_PROFILE, [register_id], (err, result) => {
            if (err) {
                reject(new Error("Error fetching user: " + err));
            } else if (result.length === 0) {
                reject(new Error("User not found"));
            } else {
                resolve(result[0]); // Return first matching user
            }
        });
    });
};


const getViewProfile = async (register_id) => {
  console.log("This is log function");
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
  return new Promise((resolve, reject) => {
      connection.query(GET_USER_PROFILE, [register_id], (err, result) => {
          if (err) {
              reject(new Error("Error fetching user: " + err));
          } else if (result.length === 0) {
              reject(new Error("User not found"));
          } else {
              resolve(result[0]); // Return first matching user
          }
      });
  });
};


const resetUserPassword = (user_id, new_password_hash) => {
  const RESET_PASSWORD_QUERY = "UPDATE users SET password = ? WHERE mail_id = ?";

  return new Promise((resolve, reject) => {
    connection.query(RESET_PASSWORD_QUERY, [new_password_hash, user_id], (error, results) => {
      if (error) {
        reject({ success: false, message: "Error resetting password", error });
      } else if (results.affectedRows === 0) {
        reject({ success: false, message: "User not found" });
      } else {
        resolve({ success: true, message: "Password reset successfully" });
      }
    });
  });
};





const addUserInterests = async (user_id, liked_profile_id) => {
  const ADD_USER_INTERESTS = "INSERT INTO user_liked_profiles(user_id, liked_profiles) VALUES (?, ?)";

  return new Promise((resolve, reject) => {
    connection.query(ADD_USER_INTERESTS, [user_id, liked_profile_id], (error, results) => {
      if (error) {
        reject({ success: false, message: "Error adding liked profile", error });
      } else {
        resolve({ success: true, message: "Liked profile added successfully", inserted_id: results.insertId });
      }
    });
  });
};




const updateProfile = async (userId, updatedFields) => {
  console.log("This is log function");
  const validFields = Object.keys(updatedFields).filter(field => updatedFields[field] !== undefined);

  console.log("The valid fields are: ", userId);
  
  if (validFields.length === 0) {
      throw new Error("No valid fields provided for update.");
  }

  const updateQuery = `UPDATE user_profiles SET ${validFields.map(field => `${field} = ?`).join(', ')} WHERE linked_to = ?`;
  const values = [...validFields.map(field => updatedFields[field]), userId];

  return new Promise((resolve, reject) => {
      connection.query(updateQuery, values, (err, result) => {
          if (err) {
              reject(new Error("Error updating user profile: " + err));
          } else if (result.affectedRows === 0) {
              reject(new Error("User not found or no changes made."));
          } else {
              resolve({ userId, updatedFields });
          }
      });
  });
};


module.exports = { updateUserDetails, loginCheck, createUser, resetUserPassword, getAllProfile, getProfile, getViewProfile, updateProfile, addUserInterests, getQuickSearch};
