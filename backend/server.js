// FILE LOCATION: /backend/server.js
// This is the backend API server

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'https://*.railway.app'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());

// Configuration file path
const CONFIG_PATH = path.join(__dirname, 'config.json');
const SETUP_LOCK_PATH = path.join(__dirname, '.setup-complete');

// Global configuration and connections
let config = {
    isSetup: false,
    database: { type: 'none' },
    admin: {},
    ai: {}
};

let db = null;
let redisClient = null;
let analyzers = {};

// Check if setup is complete
async function checkSetupStatus() {
    try {
        await fs.access(SETUP_LOCK_PATH);
        // Setup lock exists, load configuration
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        config = JSON.parse(configData);
        config.isSetup = true;
        await initializeServices();
        return true;
    } catch (error) {
        // Setup not complete
        return false;
    }
}

// Initialize services based on configuration
async function initializeServices() {
    // Initialize database
    if (config.database.type === 'mysql') {
        const mysql = require('mysql2/promise');
        try {
            db = await mysql.createConnection({
                host: config.database.mysql.host,
                port: config.database.mysql.port,
                user: config.database.mysql.user,
                password: config.database.mysql.password,
                database: config.database.mysql.database,
                ssl: config.database.mysql.ssl ? { rejectUnauthorized: false } : undefined
            });
            console.log('✅ Connected to MySQL');
            await initializeDatabase();
        } catch (error) {
            console.error('MySQL connection error:', error);
        }
    } else if (config.database.type === 'sqlite') {
        const sqlite3 = require('sqlite3').verbose();
        const { open } = require('sqlite');
        try {
            db = await open({
                filename: path.join(__dirname, 'testlab.db'),
                driver: sqlite3.Database
            });
            console.log('✅ Connected to SQLite');
            await initializeDatabase();
        } catch (error) {
            console.error('SQLite connection error:', error);
        }
    }

    // Initialize Redis if configured
    if (config.database.redis) {
        const redis = require('redis');
        try {
            redisClient = redis.createClient({
                url: config.database.redis.url,
                socket: {
                    tls: config.database.redis.tls,
                    rejectUnauthorized: false
                }
            });
            await redisClient.connect();
            console.log('✅ Connected to Redis');
        } catch (error) {
            console.error('Redis connection error:', error);
        }
    }

    // Initialize code analyzers
    await initializeAnalyzers();
}

// Initialize database schema
async function initializeDatabase() {
    const queries = {
        mysql: [
            `CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS api_keys (
                id VARCHAR(36) PRIMARY KEY,
                service VARCHAR(50) NOT NULL,
                api_key TEXT NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS analysis_history (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                code_hash VARCHAR(64),
                analysis_type VARCHAR(50),
                analyzer VARCHAR(50),
                result JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`
        ],
        sqlite: [
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                service TEXT NOT NULL,
                api_key TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS analysis_history (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                code_hash TEXT,
                analysis_type TEXT,
                analyzer TEXT,
                result TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`
        ]
    };

    const dbType = config.database.type;
    if (queries[dbType]) {
        for (const query of queries[dbType]) {
            if (dbType === 'mysql') {
                await db.execute(query);
            } else {
                await db.exec(query);
            }
        }
    }
}

// Initialize code analyzers
async function initializeAnalyzers() {
    // Built-in analyzers (no AI required)
    try {
        const { ESLintAnalyzer } = require('./analyzers/eslint-analyzer');
        analyzers.eslint = new ESLintAnalyzer();
        console.log('✅ ESLint analyzer loaded');
    } catch (error) {
        console.log('❌ ESLint analyzer not available');
    }

    try {
        const { HTMLHintAnalyzer } = require('./analyzers/htmlhint-analyzer');
        analyzers.htmlhint = new HTMLHintAnalyzer();
        console.log('✅ HTMLHint analyzer loaded');
    } catch (error) {
        console.log('❌ HTMLHint analyzer not available');
    }

    try {
        const { StylelintAnalyzer } = require('./analyzers/stylelint-analyzer');
        analyzers.stylelint = new StylelintAnalyzer();
        console.log('✅ Stylelint analyzer loaded');
    } catch (error) {
        console.log('❌ Stylelint analyzer not available');
    }

    try {
        const { AccessibilityAnalyzer } = require('./analyzers/accessibility-analyzer');
        analyzers.accessibility = new AccessibilityAnalyzer();
        console.log('✅ Accessibility analyzer loaded');
    } catch (error) {
        console.log('❌ Accessibility analyzer not available');
    }

    // AI analyzers (if configured)
    if (config.ai?.claude?.apiKey) {
        try {
            const { ClaudeAnalyzer } = require('./analyzers/claude-analyzer');
            analyzers.claude = new ClaudeAnalyzer(config.ai.claude.apiKey);
            console.log('✅ Claude analyzer loaded');
        } catch (error) {
            console.log('❌ Claude analyzer not available');
        }
    }

    if (config.ai?.chatgpt?.apiKey) {
        try {
            const { ChatGPTAnalyzer } = require('./analyzers/chatgpt-analyzer');
            analyzers.chatgpt = new ChatGPTAnalyzer(config.ai.chatgpt.apiKey);
            console.log('✅ ChatGPT analyzer loaded');
        } catch (error) {
            console.log('❌ ChatGPT analyzer not available');
        }
    }
}

// Session management (works with any database or in-memory)
const sessions = new Map(); // Fallback to in-memory if no database

async function createSession(userId) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (db && config.database.type === 'mysql') {
        await db.execute(
            'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
            [uuidv4(), userId, token, expiresAt]
        );
    } else if (db && config.database.type === 'sqlite') {
        await db.run(
            'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
            [uuidv4(), userId, token, expiresAt.toISOString()]
        );
    } else {
        // In-memory fallback
        sessions.set(token, { userId, expiresAt });
    }

    // Cache in Redis if available
    if (redisClient) {
        await redisClient.setEx(`session:${token}`, 86400, JSON.stringify({ userId, expiresAt }));
    }

    return token;
}

async function validateSession(token) {
    // Check Redis first
    if (redisClient) {
        try {
            const cached = await redisClient.get(`session:${token}`);
            if (cached) {
                const session = JSON.parse(cached);
                if (new Date(session.expiresAt) > new Date()) {
                    return session;
                }
            }
        } catch (error) {
            console.error('Redis session lookup error:', error);
        }
    }

    // Check database
    if (db && config.database.type === 'mysql') {
        const [sessions] = await db.execute(
            'SELECT user_id FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );
        if (sessions.length > 0) {
            return { userId: sessions[0].user_id };
        }
    } else if (db && config.database.type === 'sqlite') {
        const session = await db.get(
            'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")',
            [token]
        );
        if (session) {
            return { userId: session.user_id };
        }
    } else {
        // In-memory fallback
        const session = sessions.get(token);
        if (session && new Date(session.expiresAt) > new Date()) {
            return session;
        }
    }

    return null;
}

// Setup routes (available before initialization)
app.get('/api/setup/status', async (req, res) => {
    res.json({ isSetup: config.isSetup });
});

app.post('/api/setup/test-mysql', async (req, res) => {
    const mysql = require('mysql2/promise');
    const { host, port, user, password, database, ssl } = req.body;

    try {
        const connection = await mysql.createConnection({
            host,
            port: parseInt(port),
            user,
            password,
            database,
            ssl: ssl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: 5000
        });

        await connection.ping();
        await connection.end();

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/setup/test-redis', async (req, res) => {
    const redis = require('redis');
    const { url, tls } = req.body;

    try {
        const client = redis.createClient({
            url,
            socket: {
                tls,
                rejectUnauthorized: false,
                connectTimeout: 5000
            }
        });

        await client.connect();
        await client.ping();
        await client.quit();

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/setup/complete', async (req, res) => {
    if (config.isSetup) {
        return res.status(400).json({ success: false, error: 'Setup already complete' });
    }

    try {
        const setupData = req.body;

        // Hash admin password
        const hashedPassword = await bcrypt.hash(setupData.admin.password, 10);
        
        // Prepare configuration
        const newConfig = {
            database: setupData.database,
            admin: {
                username: setupData.admin.username,
                passwordHash: hashedPassword,
                email: setupData.admin.email,
                sessionSecret: setupData.admin.sessionSecret
            },
            ai: setupData.ai
        };

        // Save configuration
        await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
        
        // Create setup lock file
        await fs.writeFile(SETUP_LOCK_PATH, new Date().toISOString());

        // Update global config and initialize
        config = { ...newConfig, isSetup: true };
        await initializeServices();

        // Create admin user in database
        if (db) {
            const userId = uuidv4();
            
            if (config.database.type === 'mysql') {
                await db.execute(
                    'INSERT INTO users (id, username, password_hash, email, role) VALUES (?, ?, ?, ?, ?)',
                    [userId, config.admin.username, hashedPassword, config.admin.email, 'admin']
                );
            } else if (config.database.type === 'sqlite') {
                await db.run(
                    'INSERT INTO users (id, username, password_hash, email, role) VALUES (?, ?, ?, ?, ?)',
                    [userId, config.admin.username, hashedPassword, config.admin.email, 'admin']
                );
            }

            // Save AI keys if provided
            if (setupData.ai.claude?.apiKey) {
                const keyId = uuidv4();
                if (config.database.type === 'mysql') {
                    await db.execute(
                        'INSERT INTO api_keys (id, service, api_key) VALUES (?, ?, ?)',
                        [keyId, 'claude', setupData.ai.claude.apiKey]
                    );
                } else if (config.database.type === 'sqlite') {
                    await db.run(
                        'INSERT INTO api_keys (id, service, api_key) VALUES (?, ?, ?)',
                        [keyId, 'claude', setupData.ai.claude.apiKey]
                    );
                }
            }

            if (setupData.ai.chatgpt?.apiKey) {
                const keyId = uuidv4();
                if (config.database.type === 'mysql') {
                    await db.execute(
                        'INSERT INTO api_keys (id, service, api_key) VALUES (?, ?, ?)',
                        [keyId, 'chatgpt', setupData.ai.chatgpt.apiKey]
                    );
                } else if (config.database.type === 'sqlite') {
                    await db.run(
                        'INSERT INTO api_keys (id, service, api_key) VALUES (?, ?, ?)',
                        [keyId, 'chatgpt', setupData.ai.chatgpt.apiKey]
                    );
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Authentication middleware
async function requireAuth(req, res, next) {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(token);
    if (!session) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.userId = session.userId;
    next();
}

// Regular API routes
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        isSetup: config.isSetup
    });
});

app.get('/status', (req, res) => {
    const services = {
        claude: !!analyzers.claude,
        chatgpt: !!analyzers.chatgpt,
        eslint: !!analyzers.eslint,
        htmlhint: !!analyzers.htmlhint,
        stylelint: !!analyzers.stylelint,
        accessibility: !!analyzers.accessibility
    };

    res.json({
        services,
        analyzers: Object.keys(analyzers),
        timestamp: new Date().toISOString()
    });
});

// Authentication endpoints
app.post('/auth/login', async (req, res) => {
    if (!config.isSetup) {
        return res.status(503).json({ error: 'System not configured. Please run setup.' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    let user = null;

    // Check database first
    if (db && config.database.type === 'mysql') {
        const [users] = await db.execute(
            'SELECT id, password_hash FROM users WHERE username = ?',
            [username]
        );
        if (users.length > 0) {
            user = users[0];
        }
    } else if (db && config.database.type === 'sqlite') {
        user = await db.get(
            'SELECT id, password_hash FROM users WHERE username = ?',
            [username]
        );
    } else {
        // No database - check against config
        if (username === config.admin.username) {
            user = {
                id: 'admin',
                password_hash: config.admin.passwordHash
            };
        }
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent brute force
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = await createSession(user.id);

    res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
        success: true,
        sessionToken,
        message: 'Login successful'
    });
});

app.post('/auth/logout', async (req, res) => {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;

    if (token) {
        // Remove from Redis
        if (redisClient) {
            await redisClient.del(`session:${token}`);
        }

        // Remove from database
        if (db && config.database.type === 'mysql') {
            await db.execute('DELETE FROM sessions WHERE token = ?', [token]);
        } else if (db && config.database.type === 'sqlite') {
            await db.run('DELETE FROM sessions WHERE token = ?', [token]);
        } else {
            sessions.delete(token);
        }
    }

    res.clearCookie('sessionToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/auth/check', async (req, res) => {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;

    if (!token) {
        return res.json({ authenticated: false });
    }

    const session = await validateSession(token);
    res.json({
        authenticated: !!session,
        userId: session?.userId
    });
});

// Analysis endpoints
app.post('/analyze/:analyzer', async (req, res) => {
    const { analyzer } = req.params;
    const { code, analysisTypes = [], depth = 'thorough' } = req.body;

    if (!analyzers[analyzer]) {
        return res.status(404).json({
            error: `Analyzer '${analyzer}' not available`,
            availableAnalyzers: Object.keys(analyzers)
        });
    }

    try {
        const result = await analyzers[analyzer].analyze(code, {
            types: analysisTypes,
            depth
        });

        // Save to history if user is authenticated and database exists
        const token = req.headers['x-session-token'] || req.cookies?.sessionToken;
        const session = token ? await validateSession(token) : null;

        if (session && db) {
            const historyId = uuidv4();
            const codeHash = crypto.createHash('sha256').update(code).digest('hex');

            if (config.database.type === 'mysql') {
                await db.execute(
                    'INSERT INTO analysis_history (id, user_id, code_hash, analysis_type, analyzer, result) VALUES (?, ?, ?, ?, ?, ?)',
                    [historyId, session.userId, codeHash, analysisTypes.join(','), analyzer, JSON.stringify(result)]
                );
            } else if (config.database.type === 'sqlite') {
                await db.run(
                    'INSERT INTO analysis_history (id, user_id, code_hash, analysis_type, analyzer, result) VALUES (?, ?, ?, ?, ?, ?)',
                    [historyId, session.userId, codeHash, analysisTypes.join(','), analyzer, JSON.stringify(result)]
                );
            }
        }

        res.json(result);
    } catch (error) {
        console.error(`Analysis error (${analyzer}):`, error);
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
});

// Admin endpoints (protected)
app.get('/admin/config', requireAuth, async (req, res) => {
    const safeConfig = {
        database: {
            type: config.database.type,
            hasRedis: !!config.database.redis
        },
        analyzers: Object.keys(analyzers),
        ai: {
            claudeEnabled: !!config.ai?.claude?.apiKey,
            chatgptEnabled: !!config.ai?.chatgpt?.apiKey
        }
    };

    res.json(safeConfig);
});

app.get('/admin/history', requireAuth, async (req, res) => {
    if (!db) {
        return res.json({ history: [] });
    }

    try {
        let history = [];

        if (config.database.type === 'mysql') {
            const [rows] = await db.execute(
                'SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
                [req.userId]
            );
            history = rows;
        } else if (config.database.type === 'sqlite') {
            history = await db.all(
                'SELECT * FROM analysis_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
                [req.userId]
            );
        }

        res.json({ history });
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Initialize and start server
(async () => {
    const isSetup = await checkSetupStatus();
    
    app.listen(PORT, () => {
        console.log(`🚀 TestLab Backend running on port ${PORT}`);
        
        if (!isSetup) {
            console.log('⚠️  Setup required! Visit http://localhost:3000/setup.html');
        } else {
            console.log('✅ System configured and ready');
            console.log(`📍 Available analyzers: ${Object.keys(analyzers).join(', ')}`);
        }
    });
})();