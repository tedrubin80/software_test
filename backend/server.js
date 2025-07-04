// TestLab Backend Server
// Run with: node server.js

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: { error: 'Too many analysis requests, please try again later.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // limit login attempts
    message: { error: 'Too many login attempts, please try again later.' }
});

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'testlab.db'));

// Initialize database tables
db.serialize(() => {
    // Admin users table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // API credentials table
    db.run(`CREATE TABLE IF NOT EXISTS api_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        api_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Usage analytics table
    db.run(`CREATE TABLE IF NOT EXISTS usage_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        analysis_type TEXT NOT NULL,
        code_length INTEGER,
        issues_found INTEGER,
        response_time INTEGER,
        success BOOLEAN,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create default admin if none exists
    db.get("SELECT COUNT(*) as count FROM admins", (err, row) => {
        if (row.count === 0) {
            const defaultPassword = bcrypt.hashSync('admin123', 10);
            db.run("INSERT INTO admins (username, password_hash) VALUES (?, ?)", 
                ['admin', defaultPassword], function(err) {
                if (err) {
                    console.error('Error creating default admin:', err);
                } else {
                    console.log('🔐 Default admin created: username=admin, password=admin123');
                    console.log('⚠️  PLEASE CHANGE THE DEFAULT PASSWORD IMMEDIATELY!');
                }
            });
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'TestLab Backend'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TestLab Backend Server running on port ${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/api/admin`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
