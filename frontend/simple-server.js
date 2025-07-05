// FILE LOCATION: /frontend/simple-server.js
// Enhanced server with real AI integration and persistent storage

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

// Configuration file paths - use volume for persistence
let DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';

// Fallback to local directory if volume not available
if (!fs.existsSync(DATA_DIR)) {
    console.log(`Data directory ${DATA_DIR} not found, checking alternatives...`);
    
    // Try to create the directory
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log(`Created data directory at: ${DATA_DIR}`);
    } catch (error) {
        console.error('Failed to create data directory:', error.message);
        // Use local fallback
        DATA_DIR = path.join(__dirname, '..', 'data');
        console.log(`Using local fallback directory: ${DATA_DIR}`);
        
        if (!fs.existsSync(DATA_DIR)) {
            try {
                fs.mkdirSync(DATA_DIR, { recursive: true });
                console.log(`Created local data directory at: ${DATA_DIR}`);
            } catch (err) {
                console.error('Failed to create local data directory:', err.message);
            }
        }
    }
}

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const SETUP_MARKER = path.join(DATA_DIR, '.setup-complete');

console.log(`Data directory: ${DATA_DIR}`);
console.log(`Config file: ${CONFIG_FILE}`);

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

// Load existing config if available
if (fs.existsSync(CONFIG_FILE)) {
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        console.log('Loaded existing configuration');
    } catch (e) {
        console.error('Error loading config:', e);
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
if (fs.existsSync(SETUP_MARKER)) {
    config.isSetup = true;
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

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
    res.json({ 
        isSetup: config.isSetup,
        hasConfig: !!config.adminPassword
    });
});

// Initial setup endpoint
app.post('/api/setup/initial', async (req, res) => {
    if (config.isSetup) {
        return res.status(400).json({ error: 'Setup already complete' });
    }
    
    const { adminPassword } = req.body;
    
    if (!adminPassword || adminPassword.length < 6) {
        return res.status(400).json({ error: 'Admin password must be at least 6 characters' });
    }
    
    try {
        // Hash the admin password
        config.adminPassword = await bcrypt.hash(adminPassword, 10);
        config.isSetup = true;
        
        // Save configuration
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        fs.writeFileSync(SETUP_MARKER, new Date().toISOString());
        
        res.json({ success: true, message: 'Initial setup completed!' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed' });
    }
});

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body;
    
    if (!config.adminPassword) {
        return res.status(400).json({ error: 'Admin not configured' });
    }
    
    try {
        const valid = await bcrypt.compare(password, config.adminPassword);
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
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ success: true });
});

// Check admin authentication
app.get('/api/admin/check', (req, res) => {
    const sessionId = req.cookies.sessionId;
    const authenticated = sessionId && sessions.has(sessionId);
    res.json({ authenticated });
});

// Get API keys (protected)
app.get('/api/admin/api-keys', requireAuth, (req, res) => {
    res.json({
        apiKeys: {
            openai: config.apiKeys.openai ? '***' + config.apiKeys.openai.slice(-4) : '',
            anthropic: config.apiKeys.anthropic ? '***' + config.apiKeys.anthropic.slice(-4) : '',
            together: config.apiKeys.together ? '***' + config.apiKeys.together.slice(-4) : ''
        },
        fromEnv: {
            openai: !!process.env.OPENAI_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
            together: !!process.env.TOGETHER_AI_API_KEY
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

// AI Chat endpoint
app.post('/api/ai/chat', requireAuth, async (req, res) => {
    const { message, model = 'gpt-3.5-turbo' } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }
    
    // Determine which API to use based on model
    let apiKey = '';
    let apiUrl = '';
    let headers = {};
    let body = {};
    
    if (model.startsWith('gpt')) {
        // OpenAI
        apiKey = config.apiKeys.openai || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'OpenAI API key not configured' });
        }
        
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
        body = {
            model: model,
            messages: [{ role: 'user', content: message }],
            temperature: 0.7
        };
    } else if (model.startsWith('claude')) {
        // Anthropic
        apiKey = config.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'Anthropic API key not configured' });
        }
        
        apiUrl = 'https://api.anthropic.com/v1/messages';
        headers = {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        };
        body = {
            model: model,
            messages: [{ role: 'user', content: message }],
            max_tokens: 1000
        };
    } else {
        return res.status(400).json({ error: 'Unsupported model' });
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'API request failed');
        }
        
        // Extract response based on API
        let aiResponse = '';
        if (model.startsWith('gpt')) {
            aiResponse = data.choices[0]?.message?.content || 'No response';
        } else if (model.startsWith('claude')) {
            aiResponse = data.content[0]?.text || 'No response';
        }
        
        res.json({ response: aiResponse });
    } catch (error) {
        console.error('AI API error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Catch all route - serve index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TestLab Server v2.0 (With AI Integration)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Data Directory: ${DATA_DIR}`);
    console.log(`🔐 Setup Status: ${config.isSetup ? 'Complete' : 'Required'}`);
    
    // Show API key status
    const apiKeySources = [];
    if (process.env.OPENAI_API_KEY) apiKeySources.push('OpenAI (env)');
    if (process.env.ANTHROPIC_API_KEY) apiKeySources.push('Anthropic (env)');
    if (process.env.TOGETHER_AI_API_KEY) apiKeySources.push('Together (env)');
    
    if (apiKeySources.length > 0) {
        console.log(`🔑 API Keys from environment: ${apiKeySources.join(', ')}`);
    }
    
    console.log(`\n📝 Admin Panel: http://localhost:${PORT}/admin.html`);
    if (!config.isSetup) {
        console.log(`⚠️  Initial setup required: http://localhost:${PORT}/setup.html`);
    }
});