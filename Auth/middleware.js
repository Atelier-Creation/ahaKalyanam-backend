require("dotenv").config();
const jwt = require('jsonwebtoken');
const connection = require("../Config/config");

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
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

        if (results.length > 0) {
            return res.status(401).json({ message: "Token has been logged out" });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }

            req.user = user;
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

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: You do not have permission to access this resource." });
        }
        next();
    };
}



module.exports = { authenticateToken, authorizeRoles };
