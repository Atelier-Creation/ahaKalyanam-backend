const connection = require("../Config/config");
const bcrypt = require("bcrypt");

/**
 * Generates a random alphanumeric password of specified length
 */
function generatePassword(length = 8) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

/**
 * Creates a temporary demo user
 */
const generateDemoUser = async (name, email, phone) => {
  const rawPassword = generatePassword();
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  
  // Using the same structure as createUser in userServices.js
  const CREATE_DEMO_USER = `
    INSERT INTO users (name, mail_id, password, phone, register_number, gender, role, is_demo, expiry_date)
    VALUES (?, ?, ?, ?, 
      CONCAT('DEMO-', UPPER(SUBSTRING(MD5(RAND()), 1, 6))), 
      'Other', 'user', 1, DATE_ADD(NOW(), INTERVAL 7 DAY));
  `;

  try {
    const [result] = await connection.execute(CREATE_DEMO_USER, [
      name,
      email,
      hashedPassword,
      phone,
    ]);

    return {
      success: true,
      email: email,
      password: rawPassword,
      user_id: result.insertId,
      message: "Demo user created successfully for 7 days access."
    };
  } catch (error) {
    console.error("❌ Error creating demo user:", error.message);
    throw new Error("Error creating demo user: " + error.message);
  }
};

module.exports = {
  generateDemoUser,
};
