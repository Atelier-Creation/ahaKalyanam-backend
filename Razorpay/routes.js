const express = require("express");
const multer = require("multer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "rzp_test_FaDMhj1BABXeNp",
  key_secret: "WSfCaTByiOPQYfMwn2zNszaA",
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); 
  },
  filename: function (req, file, cb) {
    const sanitizedFilename = file.originalname.replace(/\s+/g, "-");
    cb(null, Date.now() + "-" + sanitizedFilename); 
  },
});


const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB file limit
});
const connection = require("./Config/config");

const {
  loginCheck,
  createUser,
  getAllProfile,
  getProfile,
  getViewProfile,
  resetUserPassword,
  updateProfile,
  addUserInterests,
  getQuickSearch,
  getProfileById,
} = require("./Services/userServices");
const { authenticateToken, authorizeRoles } = require("./Auth/middleware");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ error: "Name and email are required" });
  }
  loginCheck(email, password)
    .then((result) => {
      res.status(200).send({ message: result });
    })
    .catch((err) => {
      res.status(500).send({ error: err.message });
    });
});

router.post(
  "/create-order",
  authenticateToken,
  authorizeRoles("moderator","user"),
  (req, res) => {
    const amount = 50000; // ₹500 in paise
    const currency = "INR";
    const receipt = "order_rcptid_" + Math.floor(Math.random() * 1000000);

    const options = {
      amount: amount,
      currency: currency,
      receipt: receipt,
    };

    razorpay.orders
      .create(options)
      .then((order) => {
        res.status(200).send({ order }); // Send order back to frontend
      })
      .catch((err) => {
        console.error("Error creating Razorpay order:", err);
        res.status(500).send({ error: "Failed to create Razorpay order" });
      });
  }
);

router.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const key_secret = process.env.RAZORPAY_SECRET || "WSfCaTByiOPQYfMwn2zNszaA";

  const generated_signature = crypto
    .createHmac("sha256", key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generated_signature === razorpay_signature) {
    res.status(200).json({ verified: true });
  } else {
    res.status(400).json({ verified: false, error: "Invalid signature" });
  }
});



// verify payment using Razorpay's payment signature

router.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing payment details" });
  }

  try {
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || razorpay.key_secret)
      .update(sign)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.status(200).json({ message: "Payment verified successfully." });
    } else {
      return res.status(400).json({ message: "Invalid signature. Verification failed." });
    }
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ message: "Server error during verification." });
  }
});

// Promote user to moderator based on register number
router.post("/promote-to-moderator", async (req, res) => {
  const { register_number } = req.body;

  if (!register_number) {
    return res.status(400).send({ error: "Register number is required" });
  }

  try {
    const [users] = await connection.execute(
      `SELECT * FROM users WHERE id = ?`,
      [register_number]
    );

    if (users.length === 0) {
      return res.status(404).send({ error: "User not found" });
    }

    const user = users[0];

    if (user.role === "moderator") {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
      return res.status(200).send({ message: "User is already a moderator", token });
    }

    if (user.role !== "user") {
      return res
        .status(400)
        .send({ message: "Only users can be promoted to moderators" });
    }

    await connection.execute(
      `UPDATE users SET role = 'moderator' WHERE id = ?`,
      [register_number]
    );
    const newToken = jwt.sign({ id: user.id, role: "moderator" }, JWT_SECRET, { expiresIn: "1h" });
    return res.status(200).send({
      message: `User with register number ${register_number} has been promoted to moderator.`,
      token: newToken,
    });
  } catch (err) {
    return res.status(500).send({ error: "Database error: " + err.message });
  }
});

router.post("/createUser", (req, res) => {
  const { name, email, phone, password, gender } = req.body;

  console.log(req.body);

  createUser(name, email, phone, password, gender)
    .then((result) => {
      res.status(200).send({ message: result });
    })
    .catch((err) => {
      res.status(500).send({ error: err.message });
    });
});

//POST Endpoint to Save Form Data
router.post(
  "/registerProfile",
  authenticateToken,
  authorizeRoles("moderator", "admin"),
  upload.fields([{ name: "image_1" }, { name: "image_2" }]),
  async (req, res) => {
    // console.log("Uploaded Files:", req.files);
    // console.log("Request Body:", req.body);

    try {
      const cleanedBody = Object.fromEntries(
        Object.entries(req.body).map(([key, value]) => [
          key.trim(),
          value.toString().trim(),
        ])
      );

      const safeValue = (val) => {
        if (val === undefined || val === "") return null;
        if (typeof val === "string" && val.toLowerCase() === "null")
          return null;
        return val;
      };

      const {
        name,
        gender,
        city,
        date_of_birth,
        time_of_birth,
        place,
        father_name,
        mother_name,
        father_job,
        mother_job,
        no_of_siblings,
        siblings_marital_status,
        marital_status,
        mother_tongue,
        blood_group,
        diet,
        disability,
        complexion,
        caste,
        sub_caste,
        religion,
        gowthram,
        star,
        raasi,
        padam,
        laknam,
        job,
        place_of_job,
        qualification,
        permanent_address,
        present_address,
        contact_person,
        contact_number,
        partner_qualification,
        partner_job,
        partner_job_availability,
        partner_diet,
        partner_marital_status,
        partner_caste,
        partner_sub_caste,
        other_assets,
        own_house,
        created_by,
        linked_to,
        other_details,
        dasa_balance,
        horoscope,
      } = cleanedBody;

      const age = parseInt(cleanedBody.age) || null;
      const height = cleanedBody.height || null;
      const weight = parseFloat(cleanedBody.weight) || null;
      const income_per_month = parseFloat(cleanedBody.income_per_month) || null;
      const partner_income = parseFloat(cleanedBody.partner_income) || null;
      const preferred_age = parseInt(cleanedBody.preferred_age) || null;
      const horoscope_required =
        cleanedBody.horoscope_required === "true" ? 1 : 0;

      const image_1 = req.files?.image_1?.[0]?.path || null;
      const image_2 = req.files?.image_2?.[0]?.path || null;

      const createdBy = created_by ? parseInt(created_by, 10) : null;
      const linkedTo = linked_to ? parseInt(linked_to, 10) : null;

      const [userCheck] = await connection.execute(
        "SELECT 1 FROM user_profiles WHERE created_by = ? LIMIT 1",
        [createdBy]
      );

      if (req.user.role === "moderator" && userCheck.length > 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Moderators can only create one profile.",
          });
      }

      const query = `
        INSERT INTO user_profiles (
          name, age, gender, city, date_of_birth, time_of_birth, place,
          father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
          marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
          caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
          qualification, permanent_address, present_address, contact_person, contact_number,
          partner_qualification, partner_job, partner_job_availability, partner_income,
          preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
          partner_sub_caste, image_1, image_2, created_by, linked_to,
          other_details, horoscope, dasa_balance, other_assets, own_house
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        safeValue(name),
        age,
        safeValue(gender),
        safeValue(city),
        safeValue(date_of_birth),
        safeValue(time_of_birth),
        safeValue(place),
        safeValue(father_name),
        safeValue(mother_name),
        safeValue(father_job),
        safeValue(mother_job),
        safeValue(no_of_siblings),
        safeValue(siblings_marital_status),
        safeValue(marital_status),
        safeValue(mother_tongue),
        height,
        weight,
        safeValue(blood_group),
        safeValue(diet),
        safeValue(disability),
        safeValue(complexion),
        safeValue(caste),
        safeValue(sub_caste),
        safeValue(religion),
        safeValue(gowthram),
        safeValue(star),
        safeValue(raasi),
        safeValue(padam),
        safeValue(laknam),
        safeValue(job),
        safeValue(place_of_job),
        income_per_month,
        safeValue(qualification),
        safeValue(permanent_address),
        safeValue(present_address),
        safeValue(contact_person),
        safeValue(contact_number),
        safeValue(partner_qualification),
        safeValue(partner_job),
        safeValue(partner_job_availability),
        partner_income,
        preferred_age,
        safeValue(partner_diet),
        horoscope_required,
        safeValue(partner_marital_status),
        safeValue(partner_caste),
        safeValue(partner_sub_caste),
        image_1,
        image_2,
        createdBy,
        linkedTo,
        safeValue(other_details),
        JSON.stringify(horoscope || {}),
        safeValue(dasa_balance),
        safeValue(other_assets),
        safeValue(own_house),
      ];

      const [result] = await connection.execute(query, values);
      console.log(result);
      
      res.json({ success: true, status: 200, data: { id: result.insertId } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Error saving data" });
    }
  }
);

router.post(
  "/reset-password",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    const { mail_id, new_password } = req.body;

    if (!mail_id || !new_password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "user_id and new_password are required",
        });
    }

    // Hash the new password
    bcrypt
      .hash(new_password, 10)
      .then((hashedPassword) => {
        return resetUserPassword(mail_id, hashedPassword);
      })
      .then((response) => {
        res.status(200).json(response);
      })
      .catch((error) => {
        console.error("Reset password error:", error);
        res.status(500).json(error);
      });
  }
);

router.post("/change-role", async (req, res) => {
  const { user_id, new_role } = req.body;

  if (!user_id || !new_role) {
    return res.status(400).send({ error: "User ID and new role are required" });
  }

  const UPDATE_ROLE = `UPDATE users SET role = ? WHERE id = ?`;

  try {
    const [result] = await connection.execute(UPDATE_ROLE, [new_role, user_id]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ error: "User not found or role unchanged" });
    }

    res.status(200).send({
      message: `User with ID ${user_id} has been updated to ${new_role}.`,
    });
  } catch (err) {
    res.status(500).send({ error: "Error updating role: " + err.message });
  }
});


//  router.post("/registerProfile",authenticateToken,authorizeRoles("moderator", "admin"),upload.fields([{ name: "image_1" }, { name: "image_2" }]),async (req, res) => {
//     console.log("➡️  /registerProfile route hit");
//     console.log("Uploaded Files:", req.files);
//     console.log("Request Body:", req.body);
//     try {
//       console.log("Uploaded Files:", req.files);
//       console.log("Request Body:", req.body);

//       // ✅ 1. Clean and trim input values
//       const cleanedBody = Object.fromEntries(
//         Object.entries(req.body).map(([key, val]) => [key.trim(), val?.toString().trim()])
//       );

//       const safeValue = (val) => (val === undefined || val === "") ? null : val;

//       // ✅ 2. Destructure values with fallback defaults
//       const {
//         name, gender, city, date_of_birth, time_of_birth, place,
//         father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//         marital_status, mother_tongue, blood_group, diet, disability, complexion,
//         caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job,
//         qualification, permanent_address, present_address, contact_person, contact_number,
//         partner_qualification, partner_job, partner_job_availability,
//         partner_diet, partner_marital_status, partner_caste,
//         partner_sub_caste, created_by, linked_to, horoscope, dasa_balance,
//         other_assets, own_house
//       } = cleanedBody;

// // ✅ 3. Parse numerics
// const age = parseInt(cleanedBody.age) || null;
// const height = parseFloat(cleanedBody.height) || null;
// const weight = parseFloat(cleanedBody.weight) || null;
// const income_per_month = parseFloat(cleanedBody.income_per_month) || null;
// const partner_income = parseFloat(cleanedBody.partner_income) || null;
// const preferred_age = parseInt(cleanedBody.preferred_age) || null;

// const horoscope_required = cleanedBody.horoscope_required === "true" ? 1 : 0;

// // ✅ 4. File uploads
// const image_1 = req.files?.image_1?.[0]?.path || null;
// const image_2 = req.files?.image_2?.[0]?.path || null;

// // ✅ 5. Convert created_by & linked_to
// const createdBy = created_by ? parseInt(created_by, 10) : null;
// const linkedTo = linked_to ? parseInt(linked_to, 10) : null;

// // ✅ 6. Check if moderator already created a profile
// const [userCheck] = await connection.execute(
//   "SELECT 1 FROM user_profiles WHERE created_by = ? LIMIT 1",
//   [createdBy]
// );

// if (req.user.role === "moderator" && userCheck.length > 0) {
//   return res.status(400).json({ success: false, message: "Moderators can only create one profile." });
// }

//       // ✅ 7. Insert user profile
//       const insertQuery = `
//         INSERT INTO user_profiles (
//           name, age, gender, city, date_of_birth, time_of_birth, place,
//           father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//           marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
//           caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
//           qualification, permanent_address, present_address, contact_person, contact_number,
//           partner_qualification, partner_job, partner_job_availability, partner_income,
//           preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
//           partner_sub_caste, image_1, image_2, created_by, linked_to, horoscope, dasa_balance,
//           other_assets, own_house
//         )
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//       `;

//       const values = [
//         name, age, gender, city, date_of_birth, time_of_birth, place,
//         father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//         marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
//         caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
//         qualification, permanent_address, present_address, contact_person, contact_number,
//         safeValue(partner_qualification), safeValue(partner_job), partner_job_availability, safeValue(partner_income),
//         safeValue(preferred_age), partner_diet, horoscope_required, partner_marital_status, partner_caste,
//         partner_sub_caste, image_1, image_2, createdBy, linkedTo, JSON.stringify(horoscope || {}), dasa_balance,
//         other_assets, own_house
//       ];
//       console.log({values});

//       const [result] = await connection.execute(insertQuery, values);
//       console.log({result});

//       return res.status(201).json({ success: true, data: { id: result.insertId } });

//     } catch (error) {
//       console.error("Error inserting profile:", error);
//       return res.status(500).json({ success: false, message: "Server error", error });
//     }
//   }
// );

router.get("/allprofiles", async (req, res) => {
  try {
    const result = await getAllProfile(); // Call the function
    res.status(200).json({ message: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/add-interests", authenticateToken, async (req, res) => {
  const { user_id, liked_profile_id } = req.body;
  console.log(user_id, liked_profile_id);
  
    addUserInterests(user_id, liked_profile_id)
    .then((result) => {
      res.status(200).send({ message: result });
    })
    .catch((err) => {
      res.status(500).send({ error: err.message });
    });
});

router.get("/profile/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the URL

  try {
    const result = await getProfile(id); // Call the function to fetch the profile
    res.status(200).json({
      status: 200,
      message: "Profile fetched successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
});
router.get("/profilebyuserid/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the URL

  try {
    const result = await getProfileById(id); // Call the function to fetch the profile
    res.status(200).json({
      status: 200,
      message: "Profile fetched successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
});

router.get("/view-profile/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the URL

  try {
    const result = await getViewProfile(id); // Call the function to fetch the profile
    res.status(200).json({
      status: 200,
      message: "Profile fetched successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
});

router.put(
  "/profile/:id",
  upload.fields([{ name: "image_1" }, { name: "image_2" }]),
  async (req, res) => {
    try {
      const userId = req.params.id;
      let updatedFields = { ...req.body };

      // Check if files are uploaded and handle each one safely
      if (req.files?.image_1 && req.files.image_1[0]?.path) {
        const newImagePath1 = req.files.image_1[0].path.replace(
          "uploads\\",
          "uploads/"
        );

        // Only update if it's a new image or not previously assigned
        if (updatedFields.image_1 !== newImagePath1) {
          updatedFields.image_1 = newImagePath1;
        }
      }

      if (req.files?.image_2 && req.files.image_2[0]?.path) {
        const newImagePath2 = req.files.image_2[0].path.replace(
          "uploads\\",
          "uploads/"
        );

        // Only update if it's a new image or not previously assigned
        if (updatedFields.image_2 !== newImagePath2) {
          updatedFields.image_2 = newImagePath2;
        }
      }

      // Perform the update operation
      const result = await updateProfile(userId, updatedFields);

      if (result.result.affectedRows > 0) {
        return res
          .status(200)
          .json({
            status: 200,
            message: "Profile updated successfully",
            data: result,
          });
      } else {
        return res
          .status(404)
          .json({ message: "No changes detected or profile not updated" });
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      res
        .status(500)
        .json({ message: "Error updating profile", error: err.message });
    }
  }
);

// router.post("/like-profile", (req, res) => {
//     const { user_liked_id } = req.body;
//     const user_id = req.user.id; // Extract from authenticated user token

//     if (!user_liked_id) {
//         return res.status(400).json({ status: 400, error: "user_liked_id is required" });
//     }

//     const INSERT_LIKE = `INSERT INTO user_likes (user_id, user_liked_id) VALUES (?, ?)`;

//     connection.query(INSERT_LIKE, [user_id, user_liked_id], (err, result) => {
//         if (err) {
//             return res.status(500).json({ status: 500, error: "Database error: " + err.message });
//         }
//         res.status(200).json({ status: 200, message: "Profile liked successfully!" });
//     });
// });

// Get all liked profiles for a user

router.post("/logout", async (req, res) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(400)
      .json({ message: "Authorization header missing or invalid" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(400).json({ message: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const expiryDate = new Date(decoded.exp * 1000); // JWT exp is in seconds

    // Insert token into blacklist
    const [results] = await connection.execute(
      "INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)",
      [token, expiryDate]
    );

    return res.status(200).json({
      status: 200,
      message: "Logged out successfully",
      data: results,
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res
      .status(401)
      .json({ message: "Invalid token", error: err.message });
  }
});

router.get("/quick_search", async (req, res) => {
  const {
    gender,
    min_age,
    max_age,
    religion,
    caste,
    sub_caste,
    marital_status,
  } = req.query;

  const filters = {
    gender: gender === "" ? null : gender,
    min_age: min_age === "" ? null : parseInt(min_age),
    max_age: max_age === "" ? null : parseInt(max_age),
    religion: religion === "" ? null : religion,
    caste: caste === "" ? null : caste,
    sub_caste: sub_caste === "" ? null : sub_caste,
    marital_status: marital_status === "" ? null : marital_status,
  };

  console.log("Filters:", filters); // Log the filters to see what is being passed

  try {
    const result = await getQuickSearch(
      filters.gender,
      filters.min_age,
      filters.max_age,
      filters.religion,
      filters.caste,
      filters.sub_caste,
      filters.marital_status
    );
    res.status(200).json({
      status: 200,
      message: "Profile fetched successfully",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
});

router.get(
  "/user-interest-profiles/:id",
  authenticateToken,
  async (req, res) => {
    // const user_id = req.user.id; // Extract user ID from token
    const { id } = req.params;
console.log(id);

    const GET_LIKED_PROFILES = `
 SELECT 
  up.id,
  up.name,
  up.city,
  up.age,
  up.image_1,
  u.role
FROM user_profiles up
JOIN user_liked_profiles ul ON ul.liked_profiles = up.id
JOIN users u ON up.linked_to = u.id
WHERE ul.user_id = ?
ORDER BY ul.liked_at DESC;

    `;
    try {
      const [results] = await connection.execute(GET_LIKED_PROFILES, [id]);
      console.log(results);
      
      res
        .status(200)
        .json({
          status: 200,
          message: "Liked profiles fetched successfully!",
          data: results,
        });
    } catch (err) {
      res
        .status(500)
        .json({ status: 500, error: "Database error: " + err.message });
    }
  }
);

module.exports = router;
