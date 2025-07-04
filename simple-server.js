// FILE LOCATION: /simple-server.js (root directory)
// Minimal server for testing Railway deployment

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.static('frontend'));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

// Setup status
app.get('/api/setup/status', (req, res) => {
    const setupComplete = fs.existsSync(path.join(__dirname, '.setup-complete'));
    res.json({ isSetup: setupComplete });
});

// Setup complete endpoint
app.post('/api/setup/complete', (req, res) => {
    console.log('Setup complete endpoint hit!');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        // Just save a simple file to mark setup as complete
        fs.writeFileSync(path.join(__dirname, '.setup-complete'), new Date().toISOString());
        
        // Save config
        fs.writeFileSync(
            path.join(__dirname, 'config.json'), 
            JSON.stringify(req.body, null, 2)
        );
        
        console.log('Setup files created successfully');
        res.json({ success: true, message: 'Setup completed!' });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        });
    }
});

// Auth endpoints (simplified)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username);
    
    // For testing, accept any login after setup
    if (fs.existsSync(path.join(__dirname, '.setup-complete'))) {
        res.json({ 
            success: true, 
            sessionToken: 'test-token',
            message: 'Login successful' 
        });
    } else {
        res.status(401).json({ error: 'Setup not complete' });
    }
});

app.get('/api/auth/check', (req, res) => {
    res.json({ authenticated: false });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Frontend routes
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

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-login.html'));
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        files: fs.readdirSync(__dirname),
        frontend: fs.existsSync(path.join(__dirname, 'frontend')) 
            ? fs.readdirSync(path.join(__dirname, 'frontend'))
            : 'Frontend directory not found',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        }
    };
    res.json(info);
});

// 404 handler
app.use((req, res) => {
    console.log('404 Not Found:', req.path);
    res.status(404).json({ 
        error: 'Not found', 
        path: req.path,
        method: req.method 
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
    console.log(`\n🚀 Simple TestLab Server`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n📋 Test these URLs:`);
    console.log(`   • API Test: http://localhost:${PORT}/api/test`);
    console.log(`   • Debug Info: http://localhost:${PORT}/api/debug`);
    console.log(`   • Setup: http://localhost:${PORT}/setup`);
    console.log(`   • Main: http://localhost:${PORT}/`);
    console.log(`\n✅ Server is running!\n`);
});