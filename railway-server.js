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

// Fallback API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'backend-unavailable', error: 'No backend/server.js present' });
});

// Fallback diagnostics health check
app.get('/diagnostics/api/health', (req, res) => {
  res.json({ status: 'diagnostics-unavailable', error: 'No diagnostics-server.js present' });
});

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