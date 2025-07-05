// FILE LOCATION: /server.js (root directory)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything inline - no external files needed
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>TestLab</title></head>
        <body>
            <h1>TestLab is Running!</h1>
            <p>Time: ${new Date().toISOString()}</p>
            <hr>
            <h2>Quick Links:</h2>
            <ul>
                <li><a href="/test">Test Page</a></li>
                <li><a href="/debug">Debug Info</a></li>
                <li><a href="/setup">Setup Page</a></li>
            </ul>
        </body>
        </html>
    `);
});

app.get('/test', (req, res) => {
    res.send(`
        <html>
        <head><title>Test Page</title></head>
        <body>
            <h1>Test Page Works!</h1>
            <button onclick="fetch('/api/health').then(r=>r.json()).then(d=>alert(JSON.stringify(d)))">
                Test API
            </button>
            <p>If you see this, the server is working correctly.</p>
        </body>
        </html>
    `);
});

app.get('/debug', (req, res) => {
    const fs = require('fs');
    const files = fs.readdirSync(__dirname);
    
    res.send(`
        <html>
        <head><title>Debug</title></head>
        <body>
            <h1>Debug Information</h1>
            <h2>Files in root directory:</h2>
            <pre>${files.join('\n')}</pre>
            <h2>Current directory:</h2>
            <pre>${__dirname}</pre>
            <h2>Environment:</h2>
            <pre>PORT: ${PORT}</pre>
            <pre>NODE_ENV: ${process.env.NODE_ENV || 'not set'}</pre>
        </body>
        </html>
    `);
});

app.get('/setup', (req, res) => {
    res.send(`
        <html>
        <head><title>Setup</title></head>
        <body>
            <h1>Simple Setup</h1>
            <button onclick="doSetup()">Complete Setup</button>
            <div id="result"></div>
            <script>
                async function doSetup() {
                    try {
                        const response = await fetch('/api/setup/complete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({test: true})
                        });
                        const data = await response.json();
                        document.getElementById('result').innerHTML = 
                            '<h3>Result:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
                    } catch (err) {
                        document.getElementById('result').innerHTML = 
                            '<h3>Error:</h3><pre>' + err.message + '</pre>';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// API endpoints
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        server: 'ultra-simple',
        time: new Date().toISOString()
    });
});

app.post('/api/setup/complete', express.json(), (req, res) => {
    console.log('Setup called with:', req.body);
    res.json({ success: true, received: req.body });
});

// Catch all
app.use((req, res) => {
    res.status(404).send(`
        <html>
        <body>
            <h1>404 - Not Found</h1>
            <p>Path: ${req.path}</p>
            <p>Method: ${req.method}</p>
            <a href="/">Go Home</a>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit: http://localhost:${PORT}`);
});