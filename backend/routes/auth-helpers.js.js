// File Location: testlab/backend/routes/auth-helpers.js
// Helper functions for authentication

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// JWT secret - should match your main server configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify admin token helper
function verifyAdminToken(token) {
    try {
        if (!token) return false;
        
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if user is admin
        return decoded.role === 'admin' || decoded.isAdmin === true;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

// Create admin token
function createAdminToken(username) {
    return jwt.sign(
        { 
            username, 
            role: 'admin',
            isAdmin: true,
            timestamp: Date.now()
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

// For simple session-based auth (if not using JWT)
function verifyAdminSession(sessionId, sessions) {
    if (!sessionId || !sessions) return false;
    
    const session = sessions.get ? sessions.get(sessionId) : sessions[sessionId];
    if (!session) return false;
    
    // Check if session is expired
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) {
        return false;
    }
    
    return session.isAdmin === true;
}

module.exports = {
    verifyAdminToken,
    createAdminToken,
    verifyAdminSession,
    JWT_SECRET
};