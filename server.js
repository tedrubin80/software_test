// Filename: server.js
// Purpose: Main server configuration for TestLab web application

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure public directory exists
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
    fs.mkdirSync(publicPath, { recursive: true });
}

// Ensure index.html exists
const indexPath = path.join(publicPath, 'index.html');
if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TestLab - Deployment Verification</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                background-color: #f0f0f0; 
            }
            .container {
                text-align: center;
                background: white;
                padding: 2rem;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 TestLab Deployment</h1>
            <p>Server is running successfully!</p>
            <small>Fallback index.html generated during deployment</small>
        </div>
    </body>
    </html>
    `, 'utf8');
}

// Serve static files from the 'public' directory
app.use(express.static(publicPath));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        // List files in public directory
        const publicFiles = fs.readdirSync(publicPath);
        
        res.json({ 
            status: 'healthy',
            service: 'TestLab Web App',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            directories: {
                __dirname: __dirname,
                publicPath: publicPath
            },
            publicFiles: publicFiles,
            indexExists: fs.existsSync(indexPath)
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Could not generate health check',
            error: error.toString()
        });
    }
});

// Catch-all route to serve index.html for client-side routing
app.get('*', (req, res) => {
    try {
        console.log(`Serving index.html from: ${indexPath}`);
        res.sendFile(indexPath);
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Server configuration error');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        details: {
            publicPathExists: fs.existsSync(publicPath),
            indexPathExists: fs.existsSync(indexPath)
        }
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TestLab Web App running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📂 Public Path: ${publicPath}`);
});

module.exports = app;