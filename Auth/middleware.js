require("dotenv").config();
const jwt = require('jsonwebtoken');
const connection = require("../Config/config");

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
    console.log("JWT Token middleware hit");
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ error: 'Access denied, invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const [results] = await connection.execute(
            "SELECT * FROM token_blacklist WHERE token = ?",
            [token]
        );

        console.log("Token blacklist results:", results);

        if (results.length > 0) {
            return res.status(401).json({ message: "Token has been logged out" });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            req.user = user;
            console.log("Decoded user from JWT:", req.user);
            next();
        });
    } catch (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error: " + err.message });
    }
}

// Middleware to authorize roles
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        console.log("authorizeRoles middleware hit");
        console.log("User role in request:", req.user?.role); // Log user role
        console.log("Allowed roles:", allowedRoles); // Log allowed roles

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            console.log("Access denied: Role mismatch"); // Debugging line
            return res.status(403).json({ message: "Forbidden: You do not have permission to access this resource." });
        }

        console.log("Access granted, moving to next middleware.");
        next();
    };
}



module.exports = { authenticateToken, authorizeRoles };
