// FILE LOCATION: /frontend/simple-server.js
// Enhanced server with debugging for setup issues

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Session storage (in-memory for simplicity)
const sessions = new Map();
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Debug logging
console.log('=== SERVER STARTUP DEBUG ===');
console.log('Current directory:', __dirname);
console.log('Process cwd:', process.cwd());
console.log('RAILWAY_VOLUME_MOUNT_PATH:', process.env.RAILWAY_VOLUME_MOUNT_PATH);

// Configuration file paths - use volume for persistence
let DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';

// Check multiple possible data locations
const possibleDataDirs = [
    process.env.RAILWAY_VOLUME_MOUNT_PATH,
    '/data',
    path.join(process.cwd(), 'data'),
    path.join(__dirname, '..', 'data'),
    path.join(__dirname, 'data')
].filter(Boolean);

console.log('Checking possible data directories:', possibleDataDirs);

// Find or create data directory
let dataDirectoryFound = false;
for (const dir of possibleDataDirs) {
    if (fs.existsSync(dir)) {
        DATA_DIR = dir;
        dataDirectoryFound = true;
        console.log(`✅ Found existing data directory: ${dir}`);
        break;
    }
}

if (!dataDirectoryFound) {
    // Try to create data directory
    console.log('No data directory found, attempting to create...');
    
    for (const dir of ['/data', path.join(process.cwd(), 'data')]) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            DATA_DIR = dir;
            console.log(`✅ Created data directory: ${dir}`);
            break;
        } catch (err) {
            console.log(`❌ Failed to create ${dir}:`, err.message);
        }
    }
}

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SETUP_MARKER = path.join(DATA_DIR, '.setup-complete');

console.log('=== CONFIGURATION PATHS ===');
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Config file: ${CONFIG_FILE}`);
console.log(`Setup marker: ${SETUP_MARKER}`);
console.log(`Config exists: ${fs.existsSync(CONFIG_FILE)}`);
console.log(`Setup marker exists: ${fs.existsSync(SETUP_MARKER)}`);

// Load or initialize configuration
let config = {
    adminPassword: null,
    apiKeys: {
        openai: '',
        anthropic: '',
        together: ''
    },
    isSetup: false
};

// Check for config in multiple locations (migration support)
const configLocations = [
    CONFIG_FILE,
    path.join(process.cwd(), 'config.json'),
    path.join(__dirname, '..', 'config.json'),
    '/app/config.json'
];

console.log('=== CHECKING CONFIG LOCATIONS ===');
for (const location of configLocations) {
    if (fs.existsSync(location)) {
        console.log(`Found config at: ${location}`);
        try {
            const tempConfig = JSON.parse(fs.readFileSync(location, 'utf8'));
            config = tempConfig;
            console.log(`Loaded config from: ${location}`);
            
            // If not in the right place, copy it
            if (location !== CONFIG_FILE && DATA_DIR !== '/app') {
                console.log(`Copying config to: ${CONFIG_FILE}`);
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            }
            break;
        } catch (e) {
            console.error(`Error loading config from ${location}:`, e.message);
        }
    }
}

// Load API keys from environment variables if available
if (process.env.OPENAI_API_KEY) {
    config.apiKeys.openai = process.env.OPENAI_API_KEY;
    console.log('Loaded OpenAI API key from environment');
}
if (process.env.ANTHROPIC_API_KEY) {
    config.apiKeys.anthropic = process.env.ANTHROPIC_API_KEY;
    console.log('Loaded Anthropic API key from environment');
}
if (process.env.TOGETHER_AI_API_KEY) {
    config.apiKeys.together = process.env.TOGETHER_AI_API_KEY;
    console.log('Loaded Together AI key from environment');
}

// Check if setup is complete
if (fs.existsSync(SETUP_MARKER) || config.adminPassword) {
    config.isSetup = true;
    console.log('✅ Setup is complete');
} else {
    console.log('⚠️  Setup is NOT complete');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname)));

// Authentication middleware
function requireAuth(req, res, next) {
    const sessionId = req.cookies.sessionId;
    
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(sessionId);
    if (new Date() > session.expiresAt) {
        sessions.delete(sessionId);
        return res.status(401).json({ error: 'Session expired' });
    }
    
    next();
}

// API Routes

// Debug endpoint
app.get('/api/debug', (req, res) => {
    res.json({
        dataDir: DATA_DIR,
        configFile: CONFIG_FILE,
        configExists: fs.existsSync(CONFIG_FILE),
        setupComplete: config.isSetup,
        hasAdminPassword: !!config.adminPassword,
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
            RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH
        },
        directories: {
            cwd: process.cwd(),
            dirname: __dirname,
            dataDir: DATA_DIR,
            dataDirExists: fs.existsSync(DATA_DIR),
            dataDirContents: fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : []
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        dataDir: DATA_DIR,
        configExists: fs.existsSync(CONFIG_FILE)
    });
});

// Setup status
app.get('/api/setup/status', (req, res) => {
    console.log('Setup status check:', { isSetup: config.isSetup, hasPassword: !!config.adminPassword });
    res.json({ 
        isSetup: config.isSetup,
        hasConfig: !!config.adminPassword,
        dataDir: DATA_DIR
    });
});

// Initial setup endpoint
app.post('/api/setup/initial', async (req, res) => {
    console.log('Setup attempt:', { isSetup: config.isSetup, body: req.body });
    
    if (config.isSetup && config.adminPassword) {
        return res.status(400).json({ error: 'Setup already complete' });
    }
    
    const { adminPassword } = req.body;
    
    if (!adminPassword || adminPassword.length < 6) {
        return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
    }
    
    try {
        // Hash the admin password
        const hash = await bcrypt.hash(adminPassword, 10);
        config.adminPassword = hash;
        config.isSetup = true;
        
        console.log('Saving config to:', CONFIG_FILE);
        
        // Ensure directory exists
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Save configuration
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        fs.writeFileSync(SETUP_MARKER, new Date().toISOString());
        
        console.log('✅ Setup completed successfully');
        res.json({ success: true, message: 'Initial setup completed!' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed: ' + error.message });
    }
});

// Admin login endpoint (support both paths for compatibility)
app.post('/api/admin/login', handleLogin);
app.post('/api/auth/login', handleLogin);

async function handleLogin(req, res) {
    console.log('Login attempt');
    const { password, username } = req.body;
    
    // Username is optional, we only check password
    if (!config.adminPassword) {
        console.log('No admin password configured');
        return res.status(400).json({ error: 'Admin not configured' });
    }
    
    try {
        const valid = await bcrypt.compare(password, config.adminPassword);
        console.log('Password valid:', valid);
        
        if (!valid) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Create session
        const sessionId = crypto.randomBytes(32).toString('hex');
        const session = {
            id: sessionId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + SESSION_DURATION)
        };
        
        sessions.set(sessionId, session);
        
        res.cookie('sessionId', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_DURATION
        });
        
        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// Check admin authentication (support both paths)
app.get('/api/admin/check', checkAuth);
app.get('/api/auth/check', checkAuth);

function checkAuth(req, res) {
    const sessionId = req.cookies.sessionId;
    const authenticated = sessionId && sessions.has(sessionId);
    res.json({ authenticated });
}

// Reset setup endpoint (for debugging)
app.post('/api/debug/reset-setup', (req, res) => {
    console.log('Resetting setup...');
    
    try {
        // Remove config and marker files
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
        if (fs.existsSync(SETUP_MARKER)) {
            fs.unlinkSync(SETUP_MARKER);
        }
        
        // Reset in-memory config
        config = {
            adminPassword: null,
            apiKeys: {
                openai: '',
                anthropic: '',
                together: ''
            },
            isSetup: false
        };
        
        res.json({ success: true, message: 'Setup reset complete' });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Reset failed: ' + error.message });
    }
});

// Get API keys (protected)
app.get('/api/admin/api-keys', requireAuth, (req, res) => {
    res.json({
        apiKeys: {
            openai: config.apiKeys.openai ? '***' + config.apiKeys.openai.slice(-4) : '',
            anthropic: config.apiKeys.anthropic ? '***' + config.apiKeys.anthropic.slice(-4) : '',
            together: config.apiKeys.together ? '***' + config.apiKeys.together.slice(-4) : ''
        }
    });
});

// Update API keys (protected)
app.post('/api/admin/api-keys', requireAuth, (req, res) => {
    const { apiKeys } = req.body;
    
    if (!apiKeys || typeof apiKeys !== 'object') {
        return res.status(400).json({ error: 'Invalid API keys format' });
    }
    
    // Update API keys
    if (apiKeys.openai !== undefined) config.apiKeys.openai = apiKeys.openai;
    if (apiKeys.anthropic !== undefined) config.apiKeys.anthropic = apiKeys.anthropic;
    if (apiKeys.together !== undefined) config.apiKeys.together = apiKeys.together;
    
    // Save configuration
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true, message: 'API keys updated successfully' });
    } catch (error) {
        console.error('Failed to save config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Serve specific HTML files
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'setup.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/ai-chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai-chat.html'));
});

// Catch all route - serve index.html for client-side routing
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Page not found');
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TestLab Server v2.0 (Debug Mode)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Data Directory: ${DATA_DIR}`);
    console.log(`🔐 Setup Status: ${config.isSetup ? 'Complete' : 'Required'}`);
    
    console.log(`\n📝 Debug endpoint: http://localhost:${PORT}/api/debug`);
    console.log(`📝 Admin Panel: http://localhost:${PORT}/admin.html`);
    
    if (!config.isSetup) {
        console.log(`⚠️  Initial setup required: http://localhost:${PORT}/setup.html`);
    }
    
    console.log('\n=== STARTUP COMPLETE ===\n');
});