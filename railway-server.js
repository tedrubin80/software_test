// FILE PATH: railway-server.js (save in root directory)

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://*.railway.app',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

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

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/diagnostics', (req, res) => {
  res.sendFile(path.join(__dirname, 'diagnostics', 'frontend', 'index.html'));
});

// Catch-all handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
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