// Add these routes to your frontend/simple-server.js file
// Place them after the existing admin routes but before the catch-all route

// Mock AI routing configuration endpoint
app.get('/api/ai/routing-config', requireAuth, (req, res) => {
    // Return mock configuration since Python langchain service isn't running
    res.json({
        'unit-testing': {
            keywords: ['test', 'unit', 'mock', 'jest', 'mocha', 'assert'],
            model: 'openai',
            confidence: 80,
            secondaryEnabled: true
        },
        'integration-testing': {
            keywords: ['integration', 'api', 'endpoint', 'database', 'service'],
            model: 'claude',
            confidence: 75,
            secondaryEnabled: true
        },
        'e2e-testing': {
            keywords: ['e2e', 'end-to-end', 'selenium', 'cypress', 'browser'],
            model: 'openai',
            confidence: 85,
            secondaryEnabled: false
        },
        'performance-testing': {
            keywords: ['performance', 'load', 'stress', 'benchmark', 'speed'],
            model: 'claude',
            confidence: 70,
            secondaryEnabled: true
        },
        'security-testing': {
            keywords: ['security', 'vulnerability', 'penetration', 'xss', 'sql'],
            model: 'openai',
            confidence: 90,
            secondaryEnabled: true
        }
    });
});

// Update AI routing configuration endpoint
app.post('/api/ai/routing-config', requireAuth, (req, res) => {
    const routingConfig = req.body;
    
    // In a real implementation, this would update the langchain config
    // For now, just acknowledge the update
    console.log('AI Routing config update requested:', routingConfig);
    
    // You could save this to a file in /data if needed
    try {
        const configPath = path.join(DATA_DIR, 'ai-routing-config.json');
        fs.writeFileSync(configPath, JSON.stringify(routingConfig, null, 2));
        res.json({ success: true, message: 'AI routing configuration updated' });
    } catch (error) {
        console.error('Failed to save AI routing config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Get available AI services based on API keys
app.get('/api/admin/api-keys/status', requireAuth, (req, res) => {
    const configured = {};
    
    // Check which API keys are configured
    if (config.apiKeys.openai) configured.openai = true;
    if (config.apiKeys.anthropic) configured.anthropic = true;
    if (config.apiKeys.together) configured.together = true;
    
    res.json({
        configured: Object.keys(configured).length,
        keys: configured,
        services: ['openai', 'anthropic', 'together', 'cohere']
    });
});