// FILE LOCATION: /server.js (root directory)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Debug endpoint
app.get('/debug', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        rootFiles: fs.readdirSync(__dirname),
        frontendExists: fs.existsSync(path.join(__dirname, 'frontend')),
        frontendFiles: fs.existsSync(path.join(__dirname, 'frontend')) 
            ? fs.readdirSync(path.join(__dirname, 'frontend'))
            : 'Frontend directory not found'
    };
    res.json(info);
});

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/setup/status', (req, res) => {
    const setupComplete = fs.existsSync(path.join(__dirname, '.setup-complete'));
    res.json({ isSetup: setupComplete });
});

app.post('/api/setup/complete', (req, res) => {
    console.log('Setup endpoint called');
    console.log('Body:', req.body);
    
    try {
        // Save setup data
        fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(req.body, null, 2));
        fs.writeFileSync(path.join(__dirname, '.setup-complete'), new Date().toISOString());
        
        res.json({ success: true, message: 'Setup completed!' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    console.log('Login attempt:', req.body.username);
    // Simple auth for testing
    res.json({ 
        success: true, 
        sessionToken: 'test-token-' + Date.now(),
        message: 'Login successful' 
    });
});

app.get('/api/auth/check', (req, res) => {
    res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
});

// Serve HTML files
app.get('/', (req, res) => {
    const setupComplete = fs.existsSync(path.join(__dirname, '.setup-complete'));
    if (!setupComplete) {
        return res.redirect('/setup.html');
    }
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/setup', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'setup.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Not found', 
        path: req.path,
        method: req.method,
        tip: 'Check /debug to see available files'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ TestLab Server Running`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 URL: http://localhost:${PORT}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   /debug - See file structure`);
    console.log(`   /setup - Setup wizard`);
    console.log(`   /test.html - Test page`);
    console.log(`   /admin - Admin panel\n`);
});