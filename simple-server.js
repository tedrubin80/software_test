// FILE LOCATION: /simple-server.js (root directory)
// Main server for Railway deployment

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'TestLab',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'API is working!',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/setup/status', (req, res) => {
    const setupComplete = fs.existsSync(path.join(__dirname, '.setup-complete'));
    res.json({ isSetup: setupComplete });
});

app.post('/api/setup/complete', (req, res) => {
    console.log('Setup complete endpoint hit!');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
        // Create setup marker file
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
            error: error.message
        });
    }
});

// Auth endpoints (simplified for testing)
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username);
    
    // For testing, accept any login after setup
    if (fs.existsSync(path.join(__dirname, '.setup-complete'))) {
        res.json({ 
            success: true, 
            sessionToken: 'test-token-' + Date.now(),
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

// Debug endpoint
app.get('/api/debug', (req, res) => {
    const info = {
        cwd: process.cwd(),
        dirname: __dirname,
        files: fs.readdirSync(__dirname).slice(0, 20), // Limit to 20 files
        frontend: fs.existsSync(path.join(__dirname, 'frontend')) 
            ? fs.readdirSync(path.join(__dirname, 'frontend')).slice(0, 10)
            : 'Frontend directory not found',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT
        }
    };
    res.json(info);
});

// Serve HTML files explicitly for specific routes
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'frontend', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <h1>Welcome to TestLab</h1>
            <p>Frontend files not found. Please ensure frontend/index.html exists.</p>
            <a href="/api/debug">View Debug Info</a>
        `);
    }
});

app.get('/test.html', (req, res) => {
    const testPath = path.join(__dirname, 'frontend', 'test.html');
    if (fs.existsSync(testPath)) {
        res.sendFile(testPath);
    } else {
        res.status(404).send(`
            <h1>Test Page</h1>
            <p>test.html not found in frontend directory.</p>
            <a href="/api/debug">View Debug Info</a>
        `);
    }
});

app.get('/setup', (req, res) => {
    const setupPath = path.join(__dirname, 'frontend', 'setup.html');
    if (fs.existsSync(setupPath)) {
        res.sendFile(setupPath);
    } else {
        // Fallback inline setup page
        res.send(`
            <html>
            <head><title>TestLab Setup</title></head>
            <body>
                <h1>TestLab Setup</h1>
                <button onclick="completeSetup()">Complete Setup</button>
                <div id="result"></div>
                <script>
                    async function completeSetup() {
                        try {
                            const response = await fetch('/api/setup/complete', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    setupTime: new Date().toISOString(),
                                    version: '2.0.0'
                                })
                            });
                            const data = await response.json();
                            document.getElementById('result').innerHTML = 
                                '<p>Setup ' + (data.success ? 'completed!' : 'failed: ' + data.error) + '</p>';
                        } catch (error) {
                            document.getElementById('result').innerHTML = 
                                '<p>Error: ' + error.message + '</p>';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    }
});

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
    console.log(`\n🚀 TestLab Server v2.0`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`   • Main App: http://localhost:${PORT}/`);
    console.log(`   • Test Page: http://localhost:${PORT}/test.html`);
    console.log(`   • Setup: http://localhost:${PORT}/setup`);
    console.log(`   • Admin: http://localhost:${PORT}/admin`);
    console.log(`   • API Health: http://localhost:${PORT}/api/health`);
    console.log(`   • API Test: http://localhost:${PORT}/api/test`);
    console.log(`   • Debug Info: http://localhost:${PORT}/api/debug`);
    console.log(`\n✅ Server is running!\n`);
});