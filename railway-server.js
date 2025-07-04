// FILE LOCATION: /railway-server.js (root directory)
// This is the main server file that Railway runs

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://*.railway.app',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Serve static files with explicit index handling
app.use(express.static(path.join(__dirname, 'frontend'), {
  index: false,  // Disable automatic index.html serving
  extensions: ['html', 'css', 'js'],
  setHeaders: (res, path) => {
    // Add cache headers for static assets
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.set('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'TestLab Railway Deployment',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Import and mount backend routes
try {
  const backendApp = require('./backend/server');
  app.use('/api', backendApp);
  console.log('✅ Backend routes mounted');
} catch (error) {
  console.warn('⚠️  Backend not available:', error.message);
  
  // Fallback API health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'backend-unavailable', error: error.message });
  });
}

// Import and mount diagnostics routes
try {
  const diagnosticsApp = require('./diagnostics/diagnostics-server');
  app.use('/diagnostics', diagnosticsApp);
  console.log('✅ Diagnostics routes mounted');
} catch (error) {
  console.warn('⚠️  Diagnostics not available:', error.message);
  
  // Fallback diagnostics health check
  app.get('/diagnostics/api/health', (req, res) => {
    res.json({ status: 'diagnostics-unavailable', error: error.message });
  });
}

// Explicitly serve HTML files with error handling
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend', 'index.html');
  
  // Check if file exists
  if (!fs.existsSync(indexPath)) {
    console.error('❌ index.html not found at:', indexPath);
    return res.status(404).json({ 
      error: 'index.html not found',
      path: indexPath,
      cwd: __dirname,
      files: fs.readdirSync(path.join(__dirname, 'frontend')).slice(0, 10) // List first 10 files for debugging
    });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Error sending index.html:', err);
      res.status(500).json({ error: 'Failed to send index.html', details: err.message });
    }
  });
});

app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'frontend', 'admin.html');
  
  // Check if file exists
  if (!fs.existsSync(adminPath)) {
    console.error('❌ admin.html not found at:', adminPath);
    return res.status(404).json({ 
      error: 'admin.html not found',
      path: adminPath 
    });
  }
  
  res.sendFile(adminPath, (err) => {
    if (err) {
      console.error('❌ Error sending admin.html:', err);
      res.status(500).json({ error: 'Failed to send admin.html', details: err.message });
    }
  });
});

app.get('/diagnostics', (req, res) => {
  const diagnosticsPath = path.join(__dirname, 'diagnostics', 'frontend', 'index.html');
  
  // Check if file exists
  if (!fs.existsSync(diagnosticsPath)) {
    console.error('❌ diagnostics index.html not found at:', diagnosticsPath);
    return res.status(404).json({ 
      error: 'diagnostics index.html not found',
      path: diagnosticsPath 
    });
  }
  
  res.sendFile(diagnosticsPath, (err) => {
    if (err) {
      console.error('❌ Error sending diagnostics index.html:', err);
      res.status(500).json({ error: 'Failed to send diagnostics index.html', details: err.message });
    }
  });
});

// Debug route to check file structure
app.get('/debug/files', (req, res) => {
  const structure = {
    cwd: __dirname,
    frontend: {},
    diagnostics: {}
  };
  
  try {
    structure.frontend.exists = fs.existsSync(path.join(__dirname, 'frontend'));
    if (structure.frontend.exists) {
      structure.frontend.files = fs.readdirSync(path.join(__dirname, 'frontend'));
    }
    
    structure.diagnostics.exists = fs.existsSync(path.join(__dirname, 'diagnostics', 'frontend'));
    if (structure.diagnostics.exists) {
      structure.diagnostics.files = fs.readdirSync(path.join(__dirname, 'diagnostics', 'frontend'));
    }
  } catch (error) {
    structure.error = error.message;
  }
  
  res.json(structure);
});

// Generic 404 for any other request
app.use((req, res) => {
  console.log(`❌ 404: ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Railway server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TestLab running on Railway at port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Log available routes
  console.log('\n📍 Available routes:');
  console.log(`   • Frontend: http://localhost:${PORT}/`);
  console.log(`   • Admin: http://localhost:${PORT}/admin`);
  console.log(`   • Diagnostics: http://localhost:${PORT}/diagnostics`);
  console.log(`   • API: http://localhost:${PORT}/api/health`);
  console.log(`   • Diagnostics API: http://localhost:${PORT}/diagnostics/api/health`);
  console.log(`   • Debug Files: http://localhost:${PORT}/debug/files`);
  
  // Check if frontend directory exists
  const frontendPath = path.join(__dirname, 'frontend');
  if (!fs.existsSync(frontendPath)) {
    console.error('\n⚠️  WARNING: frontend directory not found at:', frontendPath);
  } else {
    console.log('\n✅ Frontend directory found');
    const files = fs.readdirSync(frontendPath);
    console.log(`   Files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;