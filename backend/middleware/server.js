const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import authentication middleware
const { requireAuth, login, logout, checkSession } = require('./middleware/adminAuth');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// In-memory storage for API keys (use database in production)
let apiConfig = {
    claudeApiKey: process.env.CLAUDE_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    enableClaude: true,
    enableChatGPT: true,
    maxTokens: 2048,
    temperature: 0.7
};

// Rate limiting storage
const rateLimitStore = new Map();

// Public endpoints (no auth required)

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Service status (public - no sensitive data)
app.get('/status', (req, res) => {
    res.json({
        services: {
            claude: !!apiConfig.claudeApiKey && apiConfig.enableClaude,
            chatgpt: !!apiConfig.openaiApiKey && apiConfig.enableChatGPT
        },
        timestamp: new Date().toISOString()
    });
});

// Authentication endpoints
app.post('/auth/login', login);
app.post('/auth/logout', logout);
app.get('/auth/check', checkSession);

// Analysis endpoints (public but rate-limited)
app.post('/analyze/claude', rateLimitMiddleware, async (req, res) => {
    if (!apiConfig.claudeApiKey || !apiConfig.enableClaude) {
        return res.status(503).json({ 
            error: 'Claude service not configured. Please contact the administrator.' 
        });
    }

    try {
        const { code, analysisTypes, depth } = req.body;
        
        // Simulate Claude analysis
        const analysis = await analyzeWithClaude(code, analysisTypes, depth);
        res.json(analysis);
    } catch (error) {
        console.error('Claude analysis error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

app.post('/analyze/chatgpt', rateLimitMiddleware, async (req, res) => {
    if (!apiConfig.openaiApiKey || !apiConfig.enableChatGPT) {
        return res.status(503).json({ 
            error: 'ChatGPT service not configured. Please contact the administrator.' 
        });
    }

    try {
        const { code, analysisTypes, depth } = req.body;
        
        // Simulate ChatGPT analysis
        const analysis = await analyzeWithChatGPT(code, analysisTypes, depth);
        res.json(analysis);
    } catch (error) {
        console.error('ChatGPT analysis error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

// Protected admin endpoints (require authentication)

// Get configuration (sensitive data removed)
app.get('/admin/config', requireAuth, (req, res) => {
    res.json({
        claudeApiKey: apiConfig.claudeApiKey ? maskApiKey(apiConfig.claudeApiKey) : '',
        openaiApiKey: apiConfig.openaiApiKey ? maskApiKey(apiConfig.openaiApiKey) : '',
        enableClaude: apiConfig.enableClaude,
        enableChatGPT: apiConfig.enableChatGPT,
        maxTokens: apiConfig.maxTokens,
        temperature: apiConfig.temperature
    });
});

// Update configuration
app.post('/admin/config', requireAuth, (req, res) => {
    const { claudeApiKey, openaiApiKey } = req.body;
    
    // Only update if new keys are provided (not masked)
    if (claudeApiKey && !claudeApiKey.includes('...')) {
        apiConfig.claudeApiKey = claudeApiKey;
    }
    if (openaiApiKey && !openaiApiKey.includes('...')) {
        apiConfig.openaiApiKey = openaiApiKey;
    }
    
    res.json({ success: true, message: 'Configuration updated' });
});

// Update settings
app.post('/admin/settings', requireAuth, (req, res) => {
    const { enableClaude, enableChatGPT, maxTokens, temperature } = req.body;
    
    apiConfig.enableClaude = enableClaude;
    apiConfig.enableChatGPT = enableChatGPT;
    apiConfig.maxTokens = maxTokens || 2048;
    apiConfig.temperature = temperature || 0.7;
    
    res.json({ success: true, message: 'Settings updated' });
});

// Test API connections
app.post('/admin/test-apis', requireAuth, async (req, res) => {
    const results = {
        claude: { success: false, error: 'Not configured' },
        chatgpt: { success: false, error: 'Not configured' }
    };
    
    // Test Claude
    if (apiConfig.claudeApiKey) {
        try {
            // Add actual API test here
            results.claude = { success: true };
        } catch (error) {
            results.claude = { success: false, error: error.message };
        }
    }
    
    // Test ChatGPT
    if (apiConfig.openaiApiKey) {
        try {
            // Add actual API test here
            results.chatgpt = { success: true };
        } catch (error) {
            results.chatgpt = { success: false, error: error.message };
        }
    }
    
    res.json(results);
});

// Get logs
app.get('/admin/logs', requireAuth, (req, res) => {
    // In production, read from actual log files
    const mockLogs = [
        { timestamp: new Date().toISOString(), level: 'INFO', message: 'Admin accessed logs' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'API', message: 'POST /api/analyze/claude - 200 OK' },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'WARNING', message: 'Rate limit approaching for IP 192.168.1.1' }
    ];
    
    res.json(mockLogs);
});

// Helper functions

function maskApiKey(key) {
    if (!key) return '';
    return key.substring(0, 10) + '...' + key.substring(key.length - 4);
}

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    const maxRequests = 100;
    
    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, []);
    }
    
    const requests = rateLimitStore.get(ip);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({ 
            error: 'Rate limit exceeded. Please try again later.' 
        });
    }
    
    recentRequests.push(now);
    rateLimitStore.set(ip, recentRequests);
    next();
}

// Mock analysis functions (replace with actual API calls)
async function analyzeWithClaude(code, analysisTypes, depth) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
        score: Math.floor(Math.random() * 30) + 70,
        summary: "Code analysis complete. Several areas for improvement identified.",
        issues: [
            {
                type: 'accessibility',
                severity: 'high',
                description: 'Missing alt attributes on images',
                fix: 'Add descriptive alt text to all img elements'
            },
            {
                type: 'security',
                severity: 'medium',
                description: 'Potential XSS vulnerability in user input handling',
                fix: 'Sanitize user input before rendering'
            }
        ],
        recommendations: [
            'Implement proper error handling',
            'Add input validation',
            'Improve code documentation'
        ]
    };
}

async function analyzeWithChatGPT(code, analysisTypes, depth) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
        score: Math.floor(Math.random() * 25) + 75,
        summary: "Analysis complete. Code follows most best practices with some improvements needed.",
        issues: [
            {
                type: 'performance',
                severity: 'medium',
                description: 'Inefficient loop structure detected',
                fix: 'Consider using array methods like map() or filter()'
            },
            {
                type: 'accessibility',
                severity: 'low',
                description: 'Color contrast could be improved',
                fix: 'Increase contrast ratio to meet WCAG standards'
            }
        ],
        recommendations: [
            'Consider using modern ES6+ features',
            'Add unit tests for critical functions',
            'Optimize bundle size'
        ]
    };
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 TestLab Backend running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Admin panel requires authentication`);
    console.log(`   Default credentials: admin / testlab2024`);
    console.log(`   Change these in production!`);
});

module.exports = app;