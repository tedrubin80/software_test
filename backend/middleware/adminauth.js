// FILE LOCATION: /backend/middleware/adminAuth.js
// Authentication middleware for admin routes

const crypto = require('crypto');

// In production, store this in environment variables
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || crypto.createHash('sha256').update('testlab2024').digest('hex');
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production';

// Simple in-memory session store (use Redis or similar in production)
const sessions = new Map();

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Verify password
function verifyPassword(password) {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    return hash === ADMIN_PASSWORD_HASH;
}

// Authentication middleware
function requireAuth(req, res, next) {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(sessionToken);
    
    // Check if session is expired (24 hours)
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionToken);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    // Refresh session timestamp
    session.lastAccess = Date.now();
    req.user = session.user;
    next();
}

// Login endpoint
async function login(req, res) {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Verify credentials
    if (username !== ADMIN_USERNAME || !verifyPassword(password)) {
        // Add delay to prevent brute force
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionToken = generateSessionToken();
    sessions.set(sessionToken, {
        user: username,
        createdAt: Date.now(),
        lastAccess: Date.now()
    });
    
    // Set cookie and return token
    res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ 
        success: true, 
        sessionToken,
        message: 'Login successful' 
    });
}

// Logout endpoint
function logout(req, res) {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (sessionToken) {
        sessions.delete(sessionToken);
    }
    
    res.clearCookie('sessionToken');
    res.json({ success: true, message: 'Logged out successfully' });
}

// Check session endpoint
function checkSession(req, res) {
    const sessionToken = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!sessionToken || !sessions.has(sessionToken)) {
        return res.json({ authenticated: false });
    }
    
    const session = sessions.get(sessionToken);
    
    // Check if session is expired
    if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
        sessions.delete(sessionToken);
        return res.json({ authenticated: false });
    }
    
    res.json({ 
        authenticated: true,
        user: session.user 
    });
}

// Clean up expired sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        if (now - session.createdAt > 24 * 60 * 60 * 1000) {
            sessions.delete(token);
        }
    }
}, 60 * 60 * 1000); // Run every hour

module.exports = {
    requireAuth,
    login,
    logout,
    checkSession
};