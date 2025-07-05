// File Location: testlab/backend/server.js
// Updated backend server with AI routing integration

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const aiRoutingAdmin = require('./routes/ai-routing-admin');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Session storage
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Make sessions available to routes
app.locals.sessions = sessions;

// Database setup
const db = new sqlite3.Database('./testlab.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table ready');
            createDefaultAdmin();
        }
    });

    // API keys table
    db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT UNIQUE NOT NULL,
            key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating api_keys table:', err);
        else console.log('API keys table ready');
    });

    // Settings table
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating settings table:', err);
        else console.log('Settings table ready');
    });

    // Initialize AI routing tables
    initAIRoutingTables();
}

// Create AI routing tables
function initAIRoutingTables() {
    db.serialize(() => {
        // AI routing statistics table
        db.run(`
            CREATE TABLE IF NOT EXISTS ai_routing_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT NOT NULL,
                category VARCHAR(50),
                selected_model VARCHAR(50),
                confidence REAL,
                response_time INTEGER,
                user_satisfaction INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating ai_routing_stats table:', err);
            else console.log('✅ AI routing stats table ready');
        });

        // AI routing config history table
        db.run(`
            CREATE TABLE IF NOT EXISTS ai_routing_config_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_json TEXT NOT NULL,
                changed_by VARCHAR(100),
                change_summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating ai_routing_config_history table:', err);
            else console.log('✅ AI routing config history table ready');
        });

        // Create indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_routing_stats_category ON ai_routing_stats(category)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_routing_stats_model ON ai_routing_stats(selected_model)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_routing_stats_created ON ai_routing_stats(created_at)`);
    });
}

// Create default admin user
function createDefaultAdmin() {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    db.get("SELECT * FROM users WHERE username = ?", [defaultUsername], async (err, row) => {
        if (err) {
            console.error('Error checking for admin user:', err);
        } else if (!row) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
                [defaultUsername, hashedPassword, 'admin'], function(err) {
                if (err) {
                    console.error('Error creating default admin:', err);
                } else {
                    console.log('🔐 Default admin created: username=admin');
                    console.log('⚠️  PLEASE CHANGE THE DEFAULT PASSWORD IMMEDIATELY!');
                }
            });
        }
    });
}

// Helper function to generate session ID
function generateSessionId() {
    return uuidv4();
}

// Authentication middleware
function requireAuth(req, res, next) {
    const sessionId = req.cookies.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(sessionId);
    if (new Date() > new Date(session.expiresAt)) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    req.session = session;
    next();
}

// AI Routing Admin Routes
app.use(aiRoutingAdmin);

// Proxy for Python AI Service
app.use('/api/ai/query', createProxyMiddleware({
    target: 'http://localhost:3003',
    changeOrigin: true,
    logLevel: 'debug',
    onError: (err, req, res) => {
        console.error('AI Service Proxy Error:', err);
        res.status(503).json({ 
            error: 'AI Service temporarily unavailable',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
            suggestion: 'Please ensure the AI routing service is running on port 3003'
        });
    },
    onProxyReq: (proxyReq, req, res) => {
        // Forward any authentication headers
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }
    }
}));

// Proxy for other AI endpoints
app.use('/api/ai', createProxyMiddleware({
    target: 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: {
        '^/api/ai': '/api/ai'
    }
}));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'TestLab Backend'
    });
});

// AI Health check
app.get('/api/ai/health-check', async (req, res) => {
    try {
        // Check if AI service is running
        const axios = require('axios');
        const aiServiceHealth = await axios.get('http://localhost:3003/api/ai/health')
            .then(r => r.data)
            .catch(() => null);
        
        res.json({
            aiServiceAvailable: !!aiServiceHealth,
            aiServiceStatus: aiServiceHealth || 'Not running',
            configPath: path.join(__dirname, 'config/routing_config.yaml'),
            dataPath: path.join(__dirname, '../data')
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT * FROM users WHERE username = ? AND role = 'admin'", [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create session
        const sessionId = generateSessionId();
        sessions.set(sessionId, {
            userId: user.id,
            username: user.username,
            role: user.role,
            isAdmin: true,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + SESSION_DURATION)
        });
        
        // Update last login
        db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
        
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: SESSION_DURATION
        });
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            } 
        });
    });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// Get API keys (admin only)
app.get('/api/admin/api-keys', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all("SELECT service, key FROM api_keys", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Mask API keys for security
        const maskedKeys = rows.map(row => ({
            service: row.service,
            key: row.key ? '••••••' + row.key.slice(-4) : null
        }));
        
        res.json({ apiKeys: maskedKeys });
    });
});

// Update API key (admin only)
app.post('/api/admin/api-keys', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { service, key } = req.body;
    
    db.run(`
        INSERT OR REPLACE INTO api_keys (service, key, updated_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [service, key], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update API key' });
        }
        res.json({ success: true });
    });
});

// Get statistics (admin only)
app.get('/api/admin/stats', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const stats = {
        totalUsers: 0,
        totalQueries: 0,
        aiRoutingStats: {}
    };
    
    // Get user count
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (!err) stats.totalUsers = row.count;
        
        // Get AI routing stats
        db.get("SELECT COUNT(*) as count FROM ai_routing_stats", (err, row) => {
            if (!err) stats.totalQueries = row.count;
            
            // Get model usage
            db.all(`
                SELECT selected_model, COUNT(*) as count 
                FROM ai_routing_stats 
                GROUP BY selected_model
            `, (err, rows) => {
                if (!err) {
                    rows.forEach(row => {
                        stats.aiRoutingStats[row.selected_model] = row.count;
                    });
                }
                
                res.json(stats);
            });
        });
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TestLab Backend Server running on port ${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/api/admin`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 AI routing: http://localhost:${PORT}/api/ai`);
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close();
    process.exit(0);
});

module.exports = app;