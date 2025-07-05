// FILE LOCATION: /simple-server.js (root directory)
// Enhanced server with real AI integration

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
app.use(express.json({ limit: '10mb' }));
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

// HTML validation endpoint with AI enhancement
app.post('/api/validate/html', requireAuth, async (req, res) => {
    const { html, url } = req.body;
    
    // Basic HTML validation
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

// Real AI analysis endpoint (protected)
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
    
    try {
        let analysis;
        
        switch (service) {
            case 'openai':
                analysis = await analyzeWithOpenAI(content, analysisType, apiKey);
                break;
            case 'anthropic':
                analysis = await analyzeWithAnthropic(content, analysisType, apiKey);
                break;
            case 'together':
                analysis = await analyzeWithTogether(content, analysisType, apiKey);
                break;
            default:
                return res.status(400).json({ error: 'Invalid service' });
        }
        
        res.json({
            service,
            analysis,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`AI analysis error (${service}):`, error.message);
        res.status(500).json({ 
            error: `AI analysis failed: ${error.message}`,
            service 
        });
    }
});

// OpenAI Analysis Function
async function analyzeWithOpenAI(content, analysisType, apiKey) {
    const axios = require('axios');
    
    const prompt = `Analyze the following HTML code for ${analysisType} issues. 
    Provide specific, actionable feedback with line numbers where possible.
    Focus on: accessibility, SEO, performance, security, and best practices.
    
    HTML Code:
    ${content}
    
    Format your response as JSON with this structure:
    {
        "score": 0-100,
        "issues": [
            {
                "severity": "error|warning|info",
                "category": "category name",
                "description": "specific issue description",
                "line": "affected code snippet",
                "suggestion": "how to fix it"
            }
        ],
        "summary": "brief overall assessment"
    }`;
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
            {
                role: 'system',
                content: 'You are an expert web developer and HTML validator. Provide detailed, actionable feedback on code quality.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.3,
        max_tokens: 2000
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    
    try {
        const aiResponse = response.data.choices[0].message.content;
        return JSON.parse(aiResponse);
    } catch (e) {
        // If AI doesn't return valid JSON, create structured response
        return {
            score: 75,
            issues: [{
                severity: 'info',
                category: 'analysis',
                description: response.data.choices[0].message.content,
                suggestion: 'Review the detailed analysis above'
            }],
            summary: 'Analysis completed by GPT-4'
        };
    }
}

// Anthropic (Claude) Analysis Function
async function analyzeWithAnthropic(content, analysisType, apiKey) {
    const axios = require('axios');
    
    const prompt = `Analyze this HTML code for ${analysisType} issues.
    
    HTML Code:
    ${content}
    
    Provide a JSON response with:
    - score (0-100)
    - issues array with severity, category, description, line, and suggestion
    - summary of findings
    
    Focus on accessibility, performance, SEO, and security issues.`;
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [{
            role: 'user',
            content: prompt
        }],
        temperature: 0.3
    }, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        }
    });
    
    try {
        const aiResponse = response.data.content[0].text;
        return JSON.parse(aiResponse);
    } catch (e) {
        return {
            score: 75,
            issues: [{
                severity: 'info',
                category: 'analysis',
                description: response.data.content[0].text,
                suggestion: 'Review the detailed analysis above'
            }],
            summary: 'Analysis completed by Claude'
        };
    }
}

// Together AI (Llama) Analysis Function
async function analyzeWithTogether(content, analysisType, apiKey) {
    const axios = require('axios');
    
    const prompt = `<s>[INST] Analyze this HTML code for ${analysisType} issues and return a JSON response.

HTML Code:
${content}

Return JSON with: score (0-100), issues array (severity, category, description, suggestion), and summary. [/INST]`;
    
    const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model: 'meta-llama/Llama-2-70b-chat-hf',
        messages: [{
            role: 'user',
            content: prompt
        }],
        temperature: 0.3,
        max_tokens: 2000
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    
    try {
        const aiResponse = response.data.choices[0].message.content;
        return JSON.parse(aiResponse);
    } catch (e) {
        return {
            score: 75,
            issues: [{
                severity: 'info',
                category: 'analysis',
                description: response.data.choices[0].message.content,
                suggestion: 'Review the detailed analysis above'
            }],
            summary: 'Analysis completed by Llama'
        };
    }
}

// Test API keys endpoint
app.post('/api/admin/test-apis', requireAuth, async (req, res) => {
    const results = {
        openai: { success: false, error: null },
        anthropic: { success: false, error: null },
        together: { success: false, error: null }
    };
    
    // Test OpenAI
    if (config.apiKeys.openai) {
        try {
            const axios = require('axios');
            await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 5
            }, {
                headers: { 'Authorization': `Bearer ${config.apiKeys.openai}` }
            });
            results.openai.success = true;
        } catch (error) {
            results.openai.error = error.response?.data?.error?.message || error.message;
        }
    }
    
    // Test Anthropic
    if (config.apiKeys.anthropic) {
        try {
            const axios = require('axios');
            await axios.post('https://api.anthropic.com/v1/messages', {
                model: 'claude-3-haiku-20240307',
                max_tokens: 5,
                messages: [{ role: 'user', content: 'test' }]
            }, {
                headers: { 
                    'x-api-key': config.apiKeys.anthropic,
                    'anthropic-version': '2023-06-01'
                }
            });
            results.anthropic.success = true;
        } catch (error) {
            results.anthropic.error = error.response?.data?.error?.message || error.message;
        }
    }
    
    // Test Together
    if (config.apiKeys.together) {
        try {
            const axios = require('axios');
            await axios.get('https://api.together.xyz/v1/models', {
                headers: { 'Authorization': `Bearer ${config.apiKeys.together}` }
            });
            results.together.success = true;
        } catch (error) {
            results.together.error = error.response?.data?.error || error.message;
        }
    }
    
    res.json(results);
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
    console.log(`\n🚀 TestLab Server v2.0 (With AI Integration)`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Setup Status: ${config.isSetup ? 'Complete' : 'Required'}`);
    console.log(`🤖 AI Services: ${Object.entries(config.apiKeys).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'None configured'}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   • Main App: http://localhost:${PORT}/`);
    console.log(`   • Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`   • Test Page: http://localhost:${PORT}/test.html`);
    console.log(`   • Setup: http://localhost:${PORT}/setup`);
    console.log(`   • API Health: http://localhost:${PORT}/api/health`);
    console.log(`   • Debug Info: http://localhost:${PORT}/api/debug`);
    console.log(`\n✅ Server is running!\n`);
});