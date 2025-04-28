const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: "rzp_test_FaDMhj1BABXeNp",
  key_secret: "WSfCaTByiOPQYfMwn2zNszaA",
});




const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Ensure 'uploads/' directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const jwt = require('jsonwebtoken');


const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB file limit
});
const connection = require('./Config/config');



const {loginCheck, createUser,getAllProfile, getProfile,getViewProfile,resetUserPassword,  updateProfile, addUserInterests, getQuickSearch} = require ('./Services/userServices');
const {authenticateToken, authorizeRoles } = require('./Auth/middleware')
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
const router = express.Router();


router.post('/login', (req, res) => {

    const { email, password } = req.body;

    if(!email || !password) {
        return res.status(400).send({ error: 'Name and email are required'});
    }
     loginCheck(email, password).then(result => {
        res.status(200).send({ message: result });
      })
      .catch(err => {
        res.status(500).send({ error: err.message });
      });
});



router.post("/create-order", authenticateToken,authorizeRoles('moderator'), (req, res) => {
  const amount = 50000; // ₹500 in paise
  const currency = "INR";
  const receipt = "order_rcptid_" + Math.floor(Math.random() * 1000000);

  const options = {
    amount: amount,
    currency: currency,
    receipt: receipt,
  };

  razorpay.orders.create(options)
    .then(order => {
      res.status(200).send({ order }); // Send order back to frontend
    })
    .catch(err => {
      console.error("Error creating Razorpay order:", err);
      res.status(500).send({ error: "Failed to create Razorpay order" });
    });
});



// Promote user to moderator based on register number
router.post('/promote-to-moderator', (req, res) => {
  const { register_number } = req.body;

  if (!register_number) {
    return res.status(400).send({ error: 'Register number is required' });
  }

  const SELECT_USER = `SELECT * FROM users WHERE id = ?`;
  const UPDATE_ROLE = `UPDATE users SET role = 'moderator' WHERE id = ?`;

  connection.query(SELECT_USER, [register_number], (err, results) => {
    if (err) {
      return res.status(500).send({ error: 'Database error: ' + err.message });
    }

    if (results.length === 0) {
      return res.status(404).send({ error: 'User not found' });
    }

    const user = results[0];

    if (user.role === 'moderator') {
      return res.status(200).send({ message: 'User is already a moderator' });
    }

    if (user.role !== 'user') {
      return res.status(400).send({ message: 'Only users can be promoted to moderators' });
    }

    connection.query(UPDATE_ROLE, [register_number], (err, result) => {
      if (err) {
        return res.status(500).send({ error: 'Error updating role: ' + err.message });
      }

      res.status(200).send({ message: `User with register number ${register_number} has been promoted to moderator.` });
    });
  });
});







router.post('/createUser', (req, res) => {
    const { name, email, phone,  password, gender} = req.body;

    console.log(req.body);

    createUser(name, email, phone, password, gender).then(result => {
        res.status(200).send({ message: result });
      }).catch(err => {
        res.status(500).send({ error: err.message });
      });
      
});

// **POST Endpoint to Save Form Data**
// router.post(
//     "/registerProfile",
//     upload.fields([{ name: "image_1" }, { name: "image_2" }]),
//     async (req, res) => {
//         console.log("Uploaded Files:", req.files);
//         console.log("Request Body:", req.body);
//       try {

  
        

//         const cleanedBody = Object.fromEntries(
//             Object.entries(req.body).map(([key, value]) => [key.trim(), value.toString().trim()])
//           );

//           const {
//             name, age, gender, city, date_of_birth, time_of_birth, place,
//             father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//             marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
//             caste, sub_caste, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
//             qualification, permanent_address, present_address, contact_person, contact_number,
//             partner_qualification, partner_job, partner_job_availability, partner_income,
//             preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
//             partner_sub_caste, user_id, linked_to
//           } = cleanedBody;

//           // File Handling
//         const image_1 = req.files?.image_1?.[0]?.path || null;
//         const image_2 = req.files?.image_2?.[0]?.path || null;
  
//         // SQL Query
//         const query = `
//         INSERT INTO user_profiles (
//               name, age, gender, city, date_of_birth, time_of_birth, place,
//     father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//     marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
//     caste, sub_caste, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
//     qualification, permanent_address, present_address, contact_person, contact_number,
//     partner_qualification, partner_job, partner_job_availability, partner_income,
//     preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
//     partner_sub_caste, image_1, image_2, created_by, linked_to
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  
//         const values = [
//         name, age, gender, city, date_of_birth, time_of_birth, place,
//         father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
//         marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
//         caste, sub_caste, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
//         qualification, permanent_address, present_address, contact_person, contact_number,
//         partner_qualification, partner_job, partner_job_availability, partner_income,
//         preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
//         partner_sub_caste, image_1, image_2, user_id, linked_to
//       ];
  
//         // Execute Query
//         const [result] = await connection.promise().query(query, values);
//         res.json({ success: true, data: { id: result.insertId } });
//       } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: "Error saving data" });
//       }
//     }
//   );


router.post('/reset-password',  authenticateToken,authorizeRoles('admin'),(req, res) => {
  const { mail_id, new_password } = req.body;

  if (!mail_id || !new_password) {
    return res.status(400).json({ success: false, message: "user_id and new_password are required" });
  }

  // Hash the new password
  bcrypt.hash(new_password, 10)
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
});



router.post('/change-role', (req, res) => {

    const { user_id, new_role } = req.body;

    if (!user_id || !new_role) {
        return res.status(400).send({ error: 'User ID and new role are required' });
    }

    const UPDATE_ROLE = `UPDATE users SET role = ? WHERE id = ?`;

    connection.query(UPDATE_ROLE, [new_role, user_id], (err, result) => {
        if (err) {
            return res.status(500).send({ error: 'Error updating role: ' + err.message });
        }

        res.status(200).send({ message: `User with ID ${user_id} has been updated to ${new_role}.` });
    });

 });

 router.post(
  "/registerProfile",
  authenticateToken,
  authorizeRoles('moderator', 'admin'),
  upload.fields([{ name: "image_1" }, { name: "image_2" }]),
  async (req, res) => {
    console.log("Uploaded Files:", req.files);
    console.log("Request Body:", req.body);

    try {
      // Trim and sanitize request body
      const cleanedBody = Object.fromEntries(
        Object.entries(req.body).map(([key, value]) => [key.trim(), value.toString().trim()])
      );


      const safeValue = (val) => {
        if (val === undefined || val === '') return null;
        return val;
      };

      
      // Extract values
      const {
        name, gender, city, date_of_birth, time_of_birth, place,
        father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
        marital_status, mother_tongue, blood_group, diet, disability, complexion,
        caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job,
        qualification, permanent_address, present_address, contact_person, contact_number,
        partner_qualification, partner_job, partner_job_availability,
        partner_diet, partner_marital_status, partner_caste,
        partner_sub_caste, created_by, linked_to, horoscope, dasa_balance,
        other_assets, own_house 
      } = cleanedBody;

      // Convert numeric values
      const age = cleanedBody.age ? parseInt(cleanedBody.age, 10) : null;
      const height = cleanedBody.height ? parseFloat(cleanedBody.height) : null;
      const weight = cleanedBody.weight ? parseFloat(cleanedBody.weight) : null;
      const income_per_month = cleanedBody.income_per_month ? parseFloat(cleanedBody.income_per_month) : null;
      const partner_income = cleanedBody.partner_income ? parseFloat(cleanedBody.partner_income) : null;
      const preferred_age = cleanedBody.preferred_age ? parseInt(cleanedBody.preferred_age, 10) : null;

      // Convert boolean fields correctly
      const horoscope_required = cleanedBody.horoscope_required === "true" ? 1 : 0;

      // Handle File Uploads
      const image_1 = req.files?.image_1?.[0]?.path || null;
      const image_2 = req.files?.image_2?.[0]?.path || null;

      // Ensure created_by and linked_to are numbers or NULL
      const createdBy = created_by ? parseInt(created_by, 10) : null;
      const linkedTo = linked_to ? parseInt(linked_to, 10) : null;

      console.log("Created By:", createdBy);
      console.log("Linked To:", linkedTo);



      

      // SQL Query (✅ Added `other_assets`, `own_house`)
      const query = `
        INSERT INTO user_profiles (
          name, age, gender, city, date_of_birth, time_of_birth, place,
          father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
          marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
          caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
          qualification, permanent_address, present_address, contact_person, contact_number,
          partner_qualification, partner_job, partner_job_availability, partner_income,
          preferred_age, partner_diet, horoscope_required, partner_marital_status, partner_caste,
          partner_sub_caste, image_1, image_2, created_by, linked_to, horoscope, dasa_balance,
          other_assets, own_house
        ) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Values array (✅ Added `other_assets`, `own_house`)
      const values = [
        name, age, gender, city, date_of_birth, time_of_birth, place,
        father_name, mother_name, father_job, mother_job, no_of_siblings, siblings_marital_status,
        marital_status, mother_tongue, height, weight, blood_group, diet, disability, complexion,
        caste, sub_caste, religion, gowthram, star, raasi, padam, laknam, job, place_of_job, income_per_month,
        qualification, permanent_address, present_address, contact_person, contact_number,
        safeValue(partner_qualification),  safeValue(partner_job),partner_job_availability,  safeValue(partner_income),
        safeValue(preferred_age), partner_diet, horoscope_required, partner_marital_status, partner_caste,
        partner_sub_caste, image_1, image_2, createdBy, linkedTo, JSON.stringify(horoscope), dasa_balance,
        other_assets, own_house
      ];

      const user_check_query = `SELECT * FROM user_profiles WHERE created_by = ?`;

      const [userCheck] = await connection.promise().query(user_check_query, [createdBy]);
      console.log(req.user.role);
      console.log(userCheck);

      if (req.user.role === 'moderator' && userCheck.length > 0) {
        console.log("The user is moderator !!!");
        res.json({ success: false, message: "User can't create more than one profile !!" });
      } else {
        const [result] = await connection.promise().query(query, values);
        res.json({ success: true, data: { id: result.insertId } });
      }

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Error saving data", error });
    }
  }
);

  
  

router.get('/allprofiles', async (req, res) => {
    try {
        const result = await getAllProfile(); // Call the function
        res.status(200).json({ message: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



router.post('/add-interests', authenticateToken, async(req, res)=>{

    const{user_id, liked_profile_id} = req.body;

    addUserInterests(user_id, liked_profile_id).then(result => {
        res.status(200).send({ message: result });
      }).catch(err => {
        res.status(500).send({ error: err.message });
      });
})


router.get('/profile/:id', async (req, res) => {
    const { id } = req.params;  // Get the ID from the URL

    try {
        const result = await getProfile(id); // Call the function to fetch the profile
        res.status(200).json({ 
            status: 200,
            message: "Profile fetched successfully",
            data: result 
        });
    } catch (err) {
        res.status(500).json({ 
            status: 500, 
            error: err.message 
        });
    }
});



router.get('/view-profile/:id', async (req, res) => {
  const { id } = req.params;  // Get the ID from the URL

  try {
      const result = await getViewProfile(id); // Call the function to fetch the profile
      res.status(200).json({ 
          status: 200,
          message: "Profile fetched successfully",
          data: result 
      });
  } catch (err) {
      res.status(500).json({ 
          status: 500, 
          error: err.message 
      });
  }
});


router.put('/profile/:id', 
  upload.fields([{ name: "image_1" }, { name: "image_2" }]), 
  async (req, res) => {
    try {
        const userId = req.params.id;
        let updatedFields = { ...req.body };

        // Check if files are uploaded
        if (req.files?.image_1 && req.files.image_1[0]?.path) {
            updatedFields.image_1 = req.files.image_1[0].path.replace('uploads\\', 'uploads/'); // Convert path to use forward slashes
        }

        if (req.files?.image_2 && req.files.image_2[0]?.path) {
            updatedFields.image_2 = req.files.image_2[0].path.replace('uploads\\', 'uploads/');
        }

        // Perform the update operation
        const result = await updateProfile(userId, updatedFields);

        if (result.result.affectedRows > 0) {
               return res.status(200).json({  status: 200, message: "Profile updated successfully", data: result });
        } else {
            return res.status(404).json({ message: "No changes detected or profile not updated" });
        }

    } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).json({ message: "Error updating profile", error: err.message });
    }
});


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
        const authHeader = req.header('Authorization');
        const token = authHeader.split(' ')[1]; // Extract token from Authorization header
  console.log("Token:", token);

    if (!token) return res.status(400).json({ message: "Token missing" });
    console.log("Token:", token);


    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // or process.env.JWT_SECRET
      console.log("Decoded Token:", decoded);  // ✅ Print the decoded token object
      const expiryDate = new Date(decoded.exp * 1000); // Convert to milliseconds


      connection.query("INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)", [token, expiryDate], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 500, error: "Database error: " + err.message });
        }
        res.status(200).json({ status: 200, message: "Logged out successfully!", data: results });
    });

  } catch (err) {
      return res.status(401).json({ message: "Invalid token", error: err.message });
  }

  });


router.get("/quick_search", async (req, res) =>{

  const {gender, min_age, max_age, religion, caste, sub_caste, marital_status} = req.query;



  const filters = {
    gender: gender === '' ? null : gender,
    min_age: min_age === '' ? null : parseInt(min_age),
    max_age: max_age === '' ? null : parseInt(max_age),
    religion: religion === '' ? null : religion,
    caste: caste === '' ? null : caste,
    sub_caste: sub_caste === '' ? null : sub_caste,
    marital_status: marital_status === '' ? null : marital_status,
  };

  console.log("Filters:", filters); // Log the filters to see what is being passed

  try{
    const result  = await getQuickSearch(filters.gender,  filters.min_age, filters.max_age, filters.religion, filters.caste, filters.sub_caste, filters.marital_status);
    res.status(200).json({ 
      status: 200,
      message: "Profile fetched successfully",
      data: result 
        });
      } catch (err) {
        res.status(500).json({ 
            status: 500, 
            error: err.message 
        }); 
      }


} )

router.get("/user-interest-profiles/:id",authenticateToken,  (req, res) => {
    // const user_id = req.user.id; // Extract user ID from token
    const {id} = req.params;

    const GET_LIKED_PROFILES = `
    SELECT up.id, up.linked_to, up.name, up.city, up.age, up.image_1 
    FROM user_profiles up
    JOIN user_liked_profiles ul ON ul.liked_profiles = up.linked_to
    WHERE ul.user_id = ?
    ORDER BY ul.liked_at DESC;
    `;

    connection.query(GET_LIKED_PROFILES, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ status: 500, error: "Database error: " + err.message });
        }
        res.status(200).json({ status: 200, message: "Liked profiles fetched successfully!", data: results });
    });
});

module.exports = router;
