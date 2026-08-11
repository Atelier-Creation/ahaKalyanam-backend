const User = require("../Model/userModel");

const connection = require("../Config/config");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config(); // Load .env variables

const updateUserDetails = async (userId, updatedFields) => {
  try {
    if (!userId || Object.keys(updatedFields).length === 0) {
      throw new Error("User ID and updated fields are required.");
    }

    const setClause = Object.keys(updatedFields)
      .map((field) => `${field} = ?`)
      .join(", ");
    const values = [...Object.values(updatedFields), userId];

    const query = `UPDATE users SET ${setClause} WHERE user_id = ?`;

    const [result] = await connection.execute(query, values);

    console.log("Result:", result);

    if (result.affectedRows === 0) {
      console.log("❌ No user updated. Check the user ID.");
      return { result: false, message: "User not found" };
    }

    console.log("✅ User updated successfully!");
    return { result: true, message: "User updated successfully" };
  } catch (error) {
    console.error("❌ Error updating user:", error.message);
    return {
      result: false,
      message: "Error updating user",
      error: error.message,
    };
  }
};

const getQuickSearch = async (
  gender,
  min_age,
  max_age,
  religion,
  caste,
  sub_caste,
  marital_status
) => {
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
      gender,
      gender,
      min_age,
      min_age,
      max_age,
      max_age,
      religion,
      religion,
      caste,
      caste,
      sub_caste,
      sub_caste,
      marital_status,
      marital_status,
    ]);

    if (results.length === 0) {
      return {
        status: 401,
        message: "No profile found for this filter",
      };
    }

    return {
      status: 200,
      message: "Quick search results",
      data: results,
    };
  } catch (error) {
    console.error("❌ Error in quick search:", error.message);
    return {
      status: 500,
      message: "Database error",
      error: error.message,
    };
  }
};

const loginCheck = async (email, password) => {
  const LOGIN_USER = `SELECT * FROM users WHERE mail_id = ?`;

  try {
    const [results] = await connection.execute(LOGIN_USER, [email]);

    if (results.length === 0) {
      console.warn(`⚠️  Login failed — no user found for email: ${email}`);
      return { status: 401, error: "Invalid email or account deactivated" };
    }

    // ⚠️ If duplicates exist, warn in logs (should not happen after the createUser fix)
    if (results.length > 1) {
      console.error(`❌ DUPLICATE USERS DETECTED for email: ${email} (count: ${results.length}). Fix the database!`);
    }

    const user = results[0];

    console.log(`🔐 Login attempt for: ${email} | Stored hash prefix: ${user.password?.slice(0, 7)}`);

    // ✅ Check if demo account has expired
    if (user.is_demo && user.expiry_date) {
      const now = new Date();
      const expiry = new Date(user.expiry_date);
      if (now > expiry) {
        console.warn(`⚠️  Demo access expired for email: ${email}`);
        return { status: 403, error: "Demo access has expired. Please contact support." };
      }
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`⚠️  Password mismatch for email: ${email}`);
      return { status: 401, error: "Invalid email or password" };
    }

    const token = jwt.sign(
      { user_id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "6h" }
    );

    console.log(`✅ Login successful for: ${email} | role: ${user.role}`);
    return {
      status: 200,
      message: "Login successful",
      token: token,
    };
  } catch (error) {
    console.error("❌ Error during login:", error.message);
    return { status: 500, error: "Server error" };
  }
};

const createUser = async (name, email, phone, password, gender) => {
  const role = gender === "Female" ? "moderator" : "user";

  const CHECK_EMAIL = `SELECT id FROM users WHERE mail_id = ? LIMIT 1`;
  const CREATE_USER = `
    INSERT INTO users (name, mail_id, password, phone, register_number, gender, role)
    VALUES (?, ?, ?, ?, 
      CONCAT('REG-', UPPER(SUBSTRING(MD5(RAND()), 1, 6))), 
      ?, ?);
  `;

  const SELECT_USER = `SELECT * FROM users WHERE mail_id = ?`;

  try {
    // ✅ Block duplicate registrations — root cause of login-after-reset bug
    const [existing] = await connection.execute(CHECK_EMAIL, [email]);
    if (existing.length > 0) {
      console.warn(`⚠️  Duplicate registration attempt for email: ${email}`);
      throw new Error("A user with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await connection.execute(CREATE_USER, [
      name,
      email,
      hashedPassword,
      phone,
      gender,
      role,
    ]);

    const [user] = await connection.execute(SELECT_USER, [email]);

    if (!user || user.length === 0) {
      throw new Error(
        "User creation failed or user not found after registration."
      );
    }

    const token = jwt.sign(
      {
        user_id: user[0].id,
        role: user[0].role,
        name: user[0].name,
        email: user[0].mail_id,
        phone: user[0].phone,
      },
      process.env.JWT_SECRET,
      { expiresIn: "6h" }
    );

    return {
      status: 200,
      message: "User registered successfully!",
      token: token,
      user_id: user[0].id,
    };
  } catch (err) {
    console.error("❌ Error during user creation:", err.message);
    throw new Error("Error during user creation: " + err.message);
  }
};

const getAllProfile = async () => {
  const GET_ALL_USERS = `SELECT * FROM user_profiles ORDER BY RAND();`;

  try {
    const [users] = await connection.execute(GET_ALL_USERS); // Using await with execute

    if (users.length === 0) {
      throw new Error("No users found.");
    }

    return users;
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    throw new Error("Error fetching users: " + err.message);
  }
};

const getRegistrationCounts = async () => {
  const GET_REGISTRATION_COUNTS = `
    SELECT
      COUNT(*) AS total,

      SUM(
        CASE 
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'male'
          THEN 1 ELSE 0 
        END
      ) AS male,

      SUM(
        CASE 
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'female'
          THEN 1 ELSE 0 
        END
      ) AS female,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'male'
            AND LOWER(TRIM(COALESCE(CAST(married AS CHAR), '')))
                IN ('1', 'true', 'yes')
          THEN 1 ELSE 0
        END
      ) AS marriedMale,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'female'
            AND LOWER(TRIM(COALESCE(CAST(married AS CHAR), '')))
                IN ('1', 'true', 'yes')
          THEN 1 ELSE 0
        END
      ) AS marriedFemale,

      -- Remarriage counts based on [மறுமணம் ] suffix in name
      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'male'
            AND COALESCE(name, '') LIKE '%[மறுமணம் %'
          THEN 1 ELSE 0
        END
      ) AS remarriageMale,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'female'
            AND COALESCE(name, '') LIKE '%[மறுமணம் %'
          THEN 1 ELSE 0
        END
      ) AS remarriageFemale

    FROM user_profiles;
  `;


  const GET_CASTE_COUNTS = `
    SELECT
      TRIM(caste) AS caste,

      COUNT(*) AS total,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'male'
          THEN 1 ELSE 0
        END
      ) AS male,

      SUM(
        CASE
          WHEN LOWER(TRIM(COALESCE(gender, ''))) = 'female'
          THEN 1 ELSE 0
        END
      ) AS female

    FROM user_profiles

    WHERE caste IS NOT NULL
      AND TRIM(caste) != ''

    GROUP BY TRIM(caste)

    ORDER BY total DESC, caste ASC;
  `;

  try {
    const [rows] = await connection.execute(
      GET_REGISTRATION_COUNTS
    );

    const [casteRows] = await connection.execute(
      GET_CASTE_COUNTS
    );

    const counts = rows[0] || {};

    return {
      total: Number(counts.total) || 0,

      male: Number(counts.male) || 0,
      female: Number(counts.female) || 0,

      marriedMale: Number(counts.marriedMale) || 0,
      marriedFemale: Number(counts.marriedFemale) || 0,

      remarriageMale: Number(counts.remarriageMale) || 0,
      remarriageFemale: Number(counts.remarriageFemale) || 0,

      castes: casteRows.map((row) => ({
        caste: row.caste,
        total: Number(row.total) || 0,
        male: Number(row.male) || 0,
        female: Number(row.female) || 0,
      })),
    };

  } catch (err) {
    console.error(
      "Error fetching registration counts:",
      err.message
    );

    throw new Error(
      "Error fetching registration counts: " + err.message
    );
  }
};

const getProfilesPaginated = async (page = 1, limit = 10, search = "") => {
  const offset = (page - 1) * limit;

  try {
    let whereClause = "";
    const params = [];

    if (search) {
      // Search across multiple columns
      whereClause = `WHERE  CAST(id AS CHAR) LIKE ? OR name LIKE ? OR caste LIKE ? OR gender LIKE ? OR contact_number LIKE ?`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Fetch total count (with search applied if any)
    const [countResult] = await connection.execute(
      `SELECT COUNT(*) as total FROM user_profiles ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Fetch paginated profiles
    const [profiles] = await connection.execute(
      `SELECT * FROM user_profiles ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    return { total, page: parseInt(page), limit: parseInt(limit), profiles };
  } catch (err) {
    console.error("❌ Error fetching paginated profiles:", err.message);
    throw new Error("Error fetching profiles: " + err.message);
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
  const RESET_PASSWORD_QUERY =
    "UPDATE users SET password = ? WHERE mail_id = ?";

  try {
    const [results] = await connection.execute(RESET_PASSWORD_QUERY, [
      new_password_hash,
      user_id,
    ]);

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
    const [existing] = await connection.execute(CHECK_EXISTENCE, [
      user_id,
      liked_profile_id,
    ]);

    if (existing.length > 0) {
      return {
        success: false,
        message: "Interest already sent previously.",
      };
    }

    const [results] = await connection.execute(ADD_USER_INTERESTS, [
      user_id,
      liked_profile_id,
    ]);

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
  // ✅ Filter only valid (non-empty) fields
  const validFields = Object.keys(updatedFields).filter((field) => {
    return (
      updatedFields[field] !== undefined &&
      updatedFields[field] !== null &&
      updatedFields[field] !== ""
    );
  });

  if (validFields.length === 0) {
    throw new Error("No valid fields provided for update.");
  }

  // ✅ Clean & normalize field values
  validFields.forEach((field) => {
    // Handle array values (like from form-data)
    if (Array.isArray(updatedFields[field])) {
      updatedFields[field] = updatedFields[field][0];
    }

    // Convert empty strings for numeric fields to null
    if (
      [
        "income_per_month",
        "partner_income",
        "weight",
        "age",
        "height",
        "no_of_siblings",
      ].includes(field) &&
      updatedFields[field] === ""
    ) {
      updatedFields[field] = null;
    }

    // Convert text to boolean (if applicable)
    if (field === "horoscope_required") {
      updatedFields[field] = updatedFields[field] === "Must" ? 1 : 0;
    }

    // Convert 'true'/'false' string to boolean
    if (field === "married") {
      updatedFields[field] =
        updatedFields[field] === 1 || updatedFields[field] === "1" ? 1 : 0;
    }
  });

  // ✅ Build the SQL query dynamically
  const updateQuery = `
    UPDATE user_profiles 
    SET ${validFields.map((field) => `${field} = ?`).join(", ")} 
    WHERE linked_to = ?
  `;

  // ✅ Prepare parameterized values (prevents SQL injection)
  const values = [...validFields.map((field) => updatedFields[field]), userId];

  try {
    const [result] = await connection.execute(updateQuery, values);

    if (result.affectedRows === 0) {
      throw new Error("No rows affected. User not found or no changes made.");
    }

    return { userId, updatedFields, result };
  } catch (error) {
    console.error("Error updating user profile:", error.message);
    throw new Error("Error updating user profile: " + error.message);
  }
};

module.exports = {
  updateUserDetails,
  loginCheck,
  createUser,
  getProfileById,
  resetUserPassword,
  getAllProfile,
  getRegistrationCounts,
  getProfile,
  getViewProfile,
  updateProfile,
  addUserInterests,
  getQuickSearch,
  getProfilesPaginated,
};
