// FILE LOCATION: /app.js (root directory)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 NEW TESTLAB SERVER STARTING - Version 2.0');

// Simple routes with unique responses
app.get('*', (req, res) => {
    console.log(`NEW SERVER: ${req.method} ${req.path}`);
    
    const routes = {
        '/': `<h1>🎉 NEW TestLab Server v2.0</h1>
              <p>Deployed at: ${new Date().toISOString()}</p>
              <a href="/test">Test Page</a> | 
              <a href="/debug">Debug</a>`,
        
        '/test': `<h1>✅ Test Page (v2.0)</h1>
                  <p>If you see this, the NEW server is running!</p>`,
        
        '/debug': `<h1>🔍 Debug Info (v2.0)</h1>
                   <pre>Path: ${req.path}
Method: ${req.method}
Time: ${new Date().toISOString()}
Port: ${PORT}</pre>`,
        
        '/test.html': `<h1>📄 test.html (v2.0)</h1>
                       <p>This is served by the NEW server</p>`
    };
    
    const content = routes[req.path] || `<h1>❌ Not Found (v2.0)</h1>
                                         <p>Path: ${req.path}</p>
                                         <a href="/">Home</a>`;
    
    res.send(`<html><body>${content}</body></html>`);
});

app.listen(PORT, () => {
    console.log('✨ NEW SERVER v2.0 RUNNING ✨');
    console.log(`📍 Port: ${PORT}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
});
