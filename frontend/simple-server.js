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

// ===== AI ROUTING CONFIGURATION =====

// Mock AI routing configuration endpoint
app.get('/api/ai/routing-config', requireAuth, (req, res) => {
    // Load saved config or return defaults
    const configPath = path.join(DATA_DIR, 'ai-routing-config.json');
    
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            res.json(config);
        } else {
            // Return default configuration
            res.json({
                'unit-testing': {
                    keywords: ['test', 'unit', 'mock', 'jest', 'mocha', 'assert'],
                    model: 'openai',
                    confidence: 80,
                    secondaryEnabled: true
                },
                'integration-testing': {
                    keywords: ['integration', 'api', 'endpoint', 'database', 'service'],
                    model: 'claude',
                    confidence: 75,
                    secondaryEnabled: true
                },
                'e2e-testing': {
                    keywords: ['e2e', 'end-to-end', 'selenium', 'cypress', 'browser'],
                    model: 'openai',
                    confidence: 85,
                    secondaryEnabled: false
                },
                'performance-testing': {
                    keywords: ['performance', 'load', 'stress', 'benchmark', 'speed'],
                    model: 'claude',
                    confidence: 70,
                    secondaryEnabled: true
                },
                'security-testing': {
                    keywords: ['security', 'vulnerability', 'penetration', 'xss', 'sql'],
                    model: 'openai',
                    confidence: 90,
                    secondaryEnabled: true
                }
            });
        }
    } catch (error) {
        console.error('Error loading AI routing config:', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

// Update AI routing configuration endpoint
app.post('/api/ai/routing-config', requireAuth, (req, res) => {
    const routingConfig = req.body;
    
    try {
        const configPath = path.join(DATA_DIR, 'ai-routing-config.json');
        fs.writeFileSync(configPath, JSON.stringify(routingConfig, null, 2));
        res.json({ success: true, message: 'AI routing configuration updated' });
    } catch (error) {
        console.error('Failed to save AI routing config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Get available AI services based on API keys
app.get('/api/admin/api-keys/status', requireAuth, (req, res) => {
    const configured = {};
    
    // Check which API keys are configured
    if (config.apiKeys.openai) configured.openai = true;
    if (config.apiKeys.anthropic) configured.anthropic = true;
    if (config.apiKeys.together) configured.together = true;
    
    res.json({
        configured: Object.keys(configured).length,
        keys: configured,
        services: ['openai', 'anthropic', 'together', 'cohere']
    });
});

// ===== DATABASE CONFIGURATION =====

// Database configuration management
const DATABASE_TYPES = {
    SQLITE: 'sqlite',
    MYSQL: 'mysql',
    POSTGRESQL: 'postgresql',
    MONGODB: 'mongodb'
};

// Load database configuration
function loadDatabaseConfig() {
    const dbConfigPath = path.join(DATA_DIR, 'database-config.json');
    const defaultConfig = {
        type: DATABASE_TYPES.SQLITE,
        connection: {
            sqlite: {
                filename: path.join(DATA_DIR, 'testlab.db')
            },
            mysql: {
                host: 'localhost',
                port: 3306,
                database: 'testlab',
                username: '',
                password: ''
            },
            postgresql: {
                host: 'localhost',
                port: 5432,
                database: 'testlab',
                username: '',
                password: ''
            },
            mongodb: {
                url: 'mongodb://localhost:27017',
                database: 'testlab'
            }
        },
        currentConnection: null
    };
    
    try {
        if (fs.existsSync(dbConfigPath)) {
            const savedConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf8'));
            return { ...defaultConfig, ...savedConfig };
        }
    } catch (error) {
        console.error('Error loading database config:', error);
    }
    
    return defaultConfig;
}

// Save database configuration
function saveDatabaseConfig(config) {
    const dbConfigPath = path.join(DATA_DIR, 'database-config.json');
    try {
        fs.writeFileSync(dbConfigPath, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving database config:', error);
        return false;
    }
}

// Initialize database configuration
let dbConfig = loadDatabaseConfig();

// Get current database configuration
app.get('/api/admin/database/config', requireAuth, (req, res) => {
    // Mask sensitive information
    const maskedConfig = JSON.parse(JSON.stringify(dbConfig));
    
    // Mask passwords
    if (maskedConfig.connection.mysql.password) {
        maskedConfig.connection.mysql.password = '***' + maskedConfig.connection.mysql.password.slice(-4);
    }
    if (maskedConfig.connection.postgresql.password) {
        maskedConfig.connection.postgresql.password = '***' + maskedConfig.connection.postgresql.password.slice(-4);
    }
    if (maskedConfig.connection.mongodb.url && maskedConfig.connection.mongodb.url.includes('@')) {
        // Mask MongoDB connection string password
        const urlParts = maskedConfig.connection.mongodb.url.split('@');
        const authPart = urlParts[0].split('://')[1];
        if (authPart && authPart.includes(':')) {
            const [user, pass] = authPart.split(':');
            maskedConfig.connection.mongodb.url = maskedConfig.connection.mongodb.url.replace(
                `:${pass}@`,
                `:***${pass.slice(-4)}@`
            );
        }
    }
    
    res.json({
        current: dbConfig.type,
        config: maskedConfig,
        available: Object.values(DATABASE_TYPES),
        status: dbConfig.currentConnection ? 'connected' : 'not connected'
    });
});

// Update database configuration
app.post('/api/admin/database/config', requireAuth, async (req, res) => {
    const { type, connection } = req.body;
    
    if (!Object.values(DATABASE_TYPES).includes(type)) {
        return res.status(400).json({ error: 'Invalid database type' });
    }
    
    // Update configuration
    dbConfig.type = type;
    
    // Update connection settings (only non-empty values)
    if (connection) {
        Object.keys(connection).forEach(dbType => {
            if (connection[dbType]) {
                Object.keys(connection[dbType]).forEach(key => {
                    const value = connection[dbType][key];
                    // Only update if value is provided and not masked
                    if (value && !value.startsWith('***')) {
                        dbConfig.connection[dbType][key] = value;
                    }
                });
            }
        });
    }
    
    // Save configuration
    if (saveDatabaseConfig(dbConfig)) {
        res.json({ 
            success: true, 
            message: 'Database configuration updated. Restart the server to apply changes.',
            requiresRestart: true
        });
    } else {
        res.status(500).json({ error: 'Failed to save database configuration' });
    }
});

// Test database connection
app.post('/api/admin/database/test', requireAuth, async (req, res) => {
    const { type, connection } = req.body;
    
    // Create test configuration
    const testConfig = {
        type,
        connection: connection || dbConfig.connection[type]
    };
    
    try {
        // Test connection based on type
        let result = { success: false, message: 'Test not implemented' };
        
        switch (type) {
            case DATABASE_TYPES.SQLITE:
                // Test SQLite connection
                try {
                    // Check if file exists and is writable
                    const dbPath = testConfig.connection.filename || ':memory:';
                    if (dbPath !== ':memory:') {
                        // Ensure directory exists
                        const dir = path.dirname(dbPath);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                        // Try to access the file
                        fs.accessSync(dir, fs.constants.W_OK);
                        result = { success: true, message: 'SQLite path is accessible' };
                    } else {
                        result = { success: true, message: 'SQLite in-memory database ready' };
                    }
                } catch (err) {
                    result = { success: false, message: `SQLite error: ${err.message}` };
                }
                break;
                
            case DATABASE_TYPES.MYSQL:
                result = {
                    success: false,
                    message: 'MySQL driver not installed. Run: npm install mysql2',
                    instructions: 'To use MySQL, install the mysql2 package and restart the server'
                };
                break;
                
            case DATABASE_TYPES.POSTGRESQL:
                result = {
                    success: false,
                    message: 'PostgreSQL driver not installed. Run: npm install pg',
                    instructions: 'To use PostgreSQL, install the pg package and restart the server'
                };
                break;
                
            case DATABASE_TYPES.MONGODB:
                result = {
                    success: false,
                    message: 'MongoDB driver not installed. Run: npm install mongodb',
                    instructions: 'To use MongoDB, install the mongodb package and restart the server'
                };
                break;
        }
        
        res.json(result);
        
    } catch (error) {
        res.json({ 
            success: false, 
            message: error.message,
            error: 'Connection test failed'
        });
    }
});

// Get database statistics
app.get('/api/admin/database/stats', requireAuth, (req, res) => {
    // This would normally query the actual database
    // For now, return mock statistics
    res.json({
        type: dbConfig.type,
        stats: {
            tables: dbConfig.type === DATABASE_TYPES.MONGODB ? 0 : 5,
            collections: dbConfig.type === DATABASE_TYPES.MONGODB ? 3 : 0,
            size: '2.4 MB',
            lastBackup: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            uptime: '7 days',
            connections: {
                active: 1,
                idle: 4,
                total: 5
            }
        }
    });
});

// Export database configuration for backups
app.get('/api/admin/database/export', requireAuth, (req, res) => {
    const exportData = {
        ...dbConfig,
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    // Remove sensitive data
    delete exportData.currentConnection;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="database-config-export.json"');
    res.json(exportData);
});

// Import database configuration
app.post('/api/admin/database/import', requireAuth, (req, res) => {
    const importData = req.body;
    
    if (!importData.type || !importData.connection) {
        return res.status(400).json({ error: 'Invalid import data' });
    }
    
    // Validate import data
    if (!Object.values(DATABASE_TYPES).includes(importData.type)) {
        return res.status(400).json({ error: 'Invalid database type in import' });
    }
    
    // Update configuration
    dbConfig = {
        ...dbConfig,
        type: importData.type,
        connection: importData.connection
    };
    
    if (saveDatabaseConfig(dbConfig)) {
        res.json({ 
            success: true, 
            message: 'Database configuration imported successfully',
            requiresRestart: true
        });
    } else {
        res.status(500).json({ error: 'Failed to import configuration' });
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