// FILE LOCATION: /simple-server.js (root directory)
// Enhanced server with authentication and API key management

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

// Configuration file paths
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SETUP_MARKER = path.join(__dirname, '.setup-complete');

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
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Session validation middleware
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

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'TestLab',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/api/setup/status', (req, res) => {
    res.json({ 
        isSetup: config.isSetup,
        hasAdminPassword: !!config.adminPassword
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
        }
    });
});

// Update API keys (protected)
app.post('/api/admin/api-keys', requireAuth, (req, res) => {
    const { openai, anthropic, together } = req.body;
    
    // Only update keys that were provided
    if (openai) config.apiKeys.openai = openai;
    if (anthropic) config.apiKeys.anthropic = anthropic;
    if (together) config.apiKeys.together = together;
    
    // Save configuration
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    res.json({ success: true, message: 'API keys updated' });
});

// HTML validation endpoint
app.post('/api/validate/html', requireAuth, (req, res) => {
    const { html, url } = req.body;
    
    // Basic HTML validation rules
    const issues = [];
    
    // Check for missing alt attributes on images
    const imgRegex = /<img[^>]*>/gi;
    const imgMatches = html.match(imgRegex) || [];
    imgMatches.forEach(img => {
        if (!img.includes('alt=')) {
            issues.push({
                type: 'error',
                message: 'Image missing alt attribute',
                line: img,
                category: 'accessibility'
            });
        }
    });
    
    // Check for missing labels on form inputs
    const inputRegex = /<input[^>]*type=["'](text|email|password|tel|number)["'][^>]*>/gi;
    const inputMatches = html.match(inputRegex) || [];
    inputMatches.forEach(input => {
        if (!input.includes('id=') || !html.includes('<label')) {
            issues.push({
                type: 'warning',
                message: 'Form input may be missing associated label',
                line: input,
                category: 'accessibility'
            });
        }
    });
    
    // Check for missing DOCTYPE
    if (!html.toLowerCase().includes('<!doctype html>')) {
        issues.push({
            type: 'error',
            message: 'Missing HTML5 DOCTYPE declaration',
            category: 'structure'
        });
    }
    
    // Check for missing title
    if (!html.match(/<title[^>]*>.*<\/title>/i)) {
        issues.push({
            type: 'error',
            message: 'Missing page title',
            category: 'seo'
        });
    }
    
    res.json({
        url,
        issueCount: issues.length,
        issues,
        timestamp: new Date().toISOString()
    });
});

// AI analysis endpoint (protected)
app.post('/api/analyze/:service', requireAuth, async (req, res) => {
    const { service } = req.params;
    const { content, analysisType } = req.body;
    
    // Check if API key exists for the service
    const apiKey = config.apiKeys[service];
    if (!apiKey) {
        return res.status(400).json({ 
            error: `No API key configured for ${service}` 
        });
    }
    
    // Here you would integrate with actual AI services
    // For now, return mock response
    res.json({
        service,
        analysis: {
            score: 85,
            issues: [
                {
                    severity: 'medium',
                    category: analysisType,
                    description: 'Sample issue found by AI',
                    suggestion: 'Here\'s how to fix it'
                }
            ],
            summary: `Analysis completed by ${service}`
        },
        timestamp: new Date().toISOString()
    });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        files: fs.readdirSync(__dirname).slice(0, 20),
        frontend: fs.existsSync(path.join(__dirname, 'frontend')) 
            ? fs.readdirSync(path.join(__dirname, 'frontend')).slice(0, 10)
            : 'Frontend directory not found',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        },
        config: {
            isSetup: config.isSetup,
            hasApiKeys: {
                openai: !!config.apiKeys.openai,
                anthropic: !!config.apiKeys.anthropic,
                together: !!config.apiKeys.together
            }
        }
    };
    res.json(info);
});

// Serve specific HTML files
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'frontend', 'admin.html');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.redirect('/');
    }
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.path);
    res.status(404).json({ 
        error: 'Not found', 
        path: req.path,
        method: req.method,
        suggestion: 'Try /api/debug for debugging info'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Server error',
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 TestLab Server v2.0 (Enhanced)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Setup Status: ${config.isSetup ? 'Complete' : 'Required'}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   • Main App: http://localhost:${PORT}/`);
    console.log(`   • Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`   • Setup Status: http://localhost:${PORT}/api/setup/status`);
    console.log(`   • API Health: http://localhost:${PORT}/api/health`);
    console.log(`   • Debug Info: http://localhost:${PORT}/api/debug`);
    console.log(`\n✅ Server is running!\n`);
});