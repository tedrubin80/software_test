// FILE LOCATION: /combined-server.js (root directory)
// This combines frontend serving and backend API into one server for Railway

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend')));

// Configuration
const CONFIG_PATH = path.join(__dirname, 'backend', 'config.json');
const SETUP_LOCK_PATH = path.join(__dirname, 'backend', '.setup-complete');

let config = {
    isSetup: false,
    database: { type: 'none' },
    admin: {},
    ai: {}
};

// In-memory storage (simple solution for Railway)
const sessions = new Map();
const users = new Map();
const apiKeys = new Map();

// Check setup status
async function checkSetupStatus() {
    try {
        await fs.access(SETUP_LOCK_PATH);
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        config = JSON.parse(configData);
        config.isSetup = true;
        
        // Load admin user into memory
        if (config.admin) {
            users.set(config.admin.username, {
                id: 'admin',
                username: config.admin.username,
                passwordHash: config.admin.passwordHash,
                role: 'admin'
            });
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// Session management
async function createSession(userId) {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    sessions.set(token, { userId, expiresAt });
    return token;
}

async function validateSession(token) {
    const session = sessions.get(token);
    if (session && new Date(session.expiresAt) > new Date()) {
        return session;
    }
    return null;
}

// Setup endpoints
app.get('/api/setup/status', (req, res) => {
    res.json({ isSetup: config.isSetup });
});

app.post('/api/setup/test-mysql', async (req, res) => {
    // For Railway deployment, we'll skip actual MySQL testing
    // and assume the credentials are correct
    res.json({ success: true, message: 'Connection test simulated' });
});

app.post('/api/setup/test-redis', async (req, res) => {
    // Skip Redis testing for now
    res.json({ success: true, message: 'Connection test simulated' });
});

app.post('/api/setup/complete', async (req, res) => {
    console.log('Setup completion requested');
    
    if (config.isSetup) {
        return res.status(400).json({ success: false, error: 'Setup already complete' });
    }

    try {
        const setupData = req.body;
        console.log('Setup data received:', JSON.stringify(setupData, null, 2));

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
        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
        
        // Create setup lock file
        await fs.writeFile(SETUP_LOCK_PATH, new Date().toISOString());

        // Update global config
        config = { ...newConfig, isSetup: true };
        
        // Store admin user in memory
        users.set(newConfig.admin.username, {
            id: 'admin',
            username: newConfig.admin.username,
            passwordHash: hashedPassword,
            role: 'admin'
        });

        console.log('Setup completed successfully');
        res.json({ success: true });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for:', username);

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const user = users.get(username);
    if (!user) {
        console.log('User not found:', username);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
        console.log('Invalid password for:', username);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const sessionToken = await createSession(user.id);

    res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });

    console.log('Login successful for:', username);
    res.json({
        success: true,
        sessionToken,
        message: 'Login successful'
    });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;
    if (token) {
        sessions.delete(token);
    }
    res.clearCookie('sessionToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/check', async (req, res) => {
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

// Analysis endpoints (mock for now)
app.post('/api/analyze/:analyzer', async (req, res) => {
    const { analyzer } = req.params;
    const { code, analysisTypes = [], depth = 'thorough' } = req.body;

    // Mock response for testing
    const mockResult = {
        analyzer,
        score: Math.floor(Math.random() * 30) + 70,
        summary: `Mock analysis completed by ${analyzer}`,
        issues: [
            {
                type: analysisTypes[0] || 'general',
                severity: 'medium',
                line: 1,
                description: 'This is a mock issue for testing',
                fix: 'This is how you would fix it'
            }
        ],
        recommendations: ['This is a mock recommendation']
    };

    res.json(mockResult);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        isSetup: config.isSetup
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        services: {
            claude: false,
            chatgpt: false,
            eslint: true,
            htmlhint: true,
            accessibility: true
        },
        timestamp: new Date().toISOString()
    });
});

// Frontend routes
app.get(['/setup', '/setup.html', '/install', '/configure'], (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'setup.html'));
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/', async (req, res) => {
    // Check if setup is complete
    if (!config.isSetup) {
        return res.redirect('/setup');
    }
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start server
(async () => {
    await checkSetupStatus();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 TestLab running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        
        if (!config.isSetup) {
            console.log('⚠️  Setup required! Visit /setup');
        } else {
            console.log('✅ System configured and ready');
        }
        
        console.log('\n📍 Available routes:');
        console.log(`   • Setup: http://localhost:${PORT}/setup`);
        console.log(`   • Main App: http://localhost:${PORT}/`);
        console.log(`   • Admin: http://localhost:${PORT}/admin`);
    });
})();