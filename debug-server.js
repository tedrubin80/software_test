const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Detailed logging of current directory and paths
console.log('🔍 Current Directory Information:');
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());

// Determine the correct public path
const publicPath = path.join(__dirname, 'public');
console.log('Calculated Public Path:', publicPath);

// Ensure public directory exists
try {
    if (!fs.existsSync(publicPath)) {
        console.log(`📁 Creating public directory at: ${publicPath}`);
        fs.mkdirSync(publicPath, { recursive: true });
    }
} catch (err) {
    console.error('Error creating public directory:', err);
}

// Path for fallback index.html
const indexPath = path.join(publicPath, 'index.html');
console.log('Fallback Index Path:', indexPath);

// Ensure index.html exists
try {
    if (!fs.existsSync(indexPath)) {
        console.log(`📄 Creating fallback index.html at: ${indexPath}`);
        fs.writeFileSync(indexPath, `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TestLab - Deployment Debug</title>
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
                <h1>🚀 TestLab Deployment Debug</h1>
                <p>Fallback Index Generated</p>
                <div id="debug-info"></div>
            </div>
            <script>
                // Debug information
                const debugInfo = document.getElementById('debug-info');
                debugInfo.innerHTML = \`
                    <pre>
                    Current Directory: \${window.location.pathname}
                    Host: \${window.location.host}
                    Full URL: \${window.location.href}
                    </pre>
                \`;
            </script>
        </body>
        </html>
        `, 'utf8');
        console.log('✅ Fallback index.html created successfully');
    }
} catch (err) {
    console.error('Error creating fallback index.html:', err);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'public' directory
app.use(express.static(publicPath));

// Health check endpoint with extensive debugging
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
                publicPath: publicPath,
                currentWorkingDir: process.cwd()
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
            indexPathExists: fs.existsSync(indexPath),
            publicPath: publicPath,
            indexPath: indexPath
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