// File Location: testlab/backend/routes/ai-routing-admin.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { verifyAdminToken, verifyAdminSession } = require('./auth-helpers');

// Middleware for admin authentication
const requireAdmin = (req, res, next) => {
    // Check for JWT token first
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (verifyAdminToken(token)) {
            return next();
        }
    }
    
    // Check for session-based auth (for simple-server.js compatibility)
    const sessionId = req.cookies?.sessionId;
    if (sessionId && req.app.locals.sessions) {
        if (verifyAdminSession(sessionId, req.app.locals.sessions)) {
            return next();
        }
    }
    
    return res.status(401).json({ error: 'Unauthorized - Admin access required' });
};

// Load API keys from existing TestLab storage
async function loadExistingAPIKeys() {
    const sqlite3 = require('sqlite3').verbose();
    const apiKeys = {};
    
    // Try to load from database first
    const db = new sqlite3.Database(path.join(__dirname, '../../testlab.db'), (err) => {
        if (err) {
            console.error('Error opening database:', err);
            return;
        }
    });
    
    return new Promise((resolve, reject) => {
        // Check api_keys table
        db.all("SELECT service, key FROM api_keys WHERE key IS NOT NULL", (err, rows) => {
            if (!err && rows) {
                rows.forEach(row => {
                    if (row.key && !row.key.startsWith('your-')) {
                        apiKeys[row.service] = row.key;
                    }
                });
            }
            
            // Also check settings table
            db.all("SELECT key, value FROM settings WHERE key LIKE '%api_key%' OR key LIKE '%API_KEY%'", (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        if (row.value && !row.value.startsWith('your-')) {
                            // Map common key names
                            const keyMap = {
                                'OPENAI_API_KEY': 'openai',
                                'ANTHROPIC_API_KEY': 'anthropic',
                                'TOGETHER_AI_API_KEY': 'together',
                                'claude_api_key': 'anthropic',
                                'chatgpt_api_key': 'openai'
                            };
                            const normalizedKey = keyMap[row.key] || row.key.toLowerCase();
                            apiKeys[normalizedKey] = row.value;
                        }
                    });
                }
                
                db.close();
                resolve(apiKeys);
            });
        });
    });
}

// Get API keys (including existing ones)
router.get('/api/ai/keys', requireAdmin, async (req, res) => {
    try {
        // First try to load from existing TestLab storage
        const existingKeys = await loadExistingAPIKeys();
        
        // Then check /data volume
        const dataPath = path.join(__dirname, '../../data/api_keys.json');
        let fileKeys = {};
        
        if (await fs.access(dataPath).then(() => true).catch(() => false)) {
            const content = await fs.readFile(dataPath, 'utf8');
            fileKeys = JSON.parse(content);
        }
        
        // Merge keys (existing TestLab keys take precedence)
        const allKeys = { ...fileKeys, ...existingKeys };
        
        // Filter out template values
        const validKeys = {};
        Object.entries(allKeys).forEach(([service, key]) => {
            if (key && !key.startsWith('your-') && key !== 'your-api-key') {
                validKeys[service] = '••••••' + key.slice(-4); // Mask keys for security
            }
        });
        
        res.json({ 
            keys: validKeys,
            configured: Object.keys(validKeys).length,
            services: ['openai', 'anthropic', 'together', 'cohere']
        });
    } catch (error) {
        console.error('Error getting API keys:', error);
        res.status(500).json({ error: 'Failed to load API keys' });
    }
});

// Get current routing configuration
router.get('/api/ai/routing-config', requireAdmin, async (req, res) => {
    try {
        const configPath = path.join(__dirname, '../../config/routing_config.yaml');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(configData);
        
        // Transform YAML config to frontend format
        const frontendConfig = {};
        
        for (const [category, rules] of Object.entries(config.routing_rules)) {
            frontendConfig[category] = {
                keywords: rules.keywords,
                model: rules.primary_llm.includes('openai') ? 'openai' : 'claude',
                confidence: rules.min_confidence * 100,
                secondaryEnabled: rules.secondary_llms && rules.secondary_llms.length > 0
            };
        }
        
        res.json(frontendConfig);
    } catch (error) {
        console.error('Error loading routing config:', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

// Update routing configuration
router.post('/api/ai/routing-config', requireAdmin, async (req, res) => {
    try {
        const frontendConfig = req.body;
        const configPath = path.join(__dirname, '../../config/routing_config.yaml');
        
        // Load existing YAML config
        const existingData = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(existingData);
        
        // Update with new values
        for (const [category, settings] of Object.entries(frontendConfig)) {
            if (config.routing_rules[category]) {
                config.routing_rules[category].keywords = settings.keywords;
                config.routing_rules[category].primary_llm = 
                    settings.model === 'openai' ? 'openai_gpt4' : 'claude_3';
                config.routing_rules[category].min_confidence = settings.confidence / 100;
                
                // Update secondary LLMs
                if (settings.secondaryEnabled) {
                    config.routing_rules[category].secondary_llms = 
                        settings.model === 'openai' ? ['claude_3'] : ['openai_gpt4'];
                } else {
                    config.routing_rules[category].secondary_llms = [];
                }
            }
        }
        
        // Save updated config
        const yamlStr = yaml.dump(config, { indent: 2 });
        await fs.writeFile(configPath, yamlStr, 'utf8');
        
        // Notify the AI system to reload config
        notifyAISystemConfigUpdate();
        
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating routing config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

// Get routing statistics
router.get('/api/ai/routing-stats', requireAdmin, async (req, res) => {
    try {
        // Load stats from database or log files
        const stats = await getRoutingStatistics();
        res.json(stats);
    } catch (error) {
        console.error('Error getting routing stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Add new routing category
router.post('/api/ai/routing-category', requireAdmin, async (req, res) => {
    try {
        const { categoryName, keywords, primaryModel, confidence } = req.body;
        
        const configPath = path.join(__dirname, '../../config/routing_config.yaml');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = yaml.load(configData);
        
        // Add new category
        config.routing_rules[categoryName] = {
            keywords: keywords,
            primary_llm: primaryModel === 'openai' ? 'openai_gpt4' : 'claude_3',
            secondary_llms: primaryModel === 'openai' ? ['claude_3'] : ['openai_gpt4'],
            weight: 1.0,
            min_confidence: confidence / 100
        };
        
        // Save config
        const yamlStr = yaml.dump(config, { indent: 2 });
        await fs.writeFile(configPath, yamlStr, 'utf8');
        
        res.json({ success: true, message: 'Category added successfully' });
    } catch (error) {
        console.error('Error adding routing category:', error);
        res.status(500).json({ error: 'Failed to add category' });
    }
});

// Test routing with sample query
router.post('/api/ai/test-routing', requireAdmin, async (req, res) => {
    try {
        const { query } = req.body;
        
        // Call the routing system to see which model would be selected
        const routingResult = await testRouting(query);
        
        res.json({
            query: query,
            selectedCategory: routingResult.category,
            selectedModel: routingResult.model,
            confidence: routingResult.confidence,
            matchedKeywords: routingResult.keywords
        });
    } catch (error) {
        console.error('Error testing routing:', error);
        res.status(500).json({ error: 'Failed to test routing' });
    }
});

// Helper functions

async function getRoutingStatistics() {
    // Implement logic to get statistics from your database or logs
    // This is a placeholder implementation
    return {
        totalQueries: 1247,
        modelUsage: {
            claude: 42,
            openai: 58
        },
        categoryBreakdown: {
            'unit-testing': 385,
            'security-testing': 298,
            'integration-testing': 234,
            'e2e-testing': 189,
            'performance-testing': 141
        },
        averageConfidence: 87,
        recentQueries: []
    };
}

async function testRouting(query) {
    // Implement routing test logic
    // This should call your actual routing system
    const axios = require('axios');
    
    try {
        const response = await axios.post('http://localhost:3003/api/ai/test-route', {
            query: query
        });
        return response.data;
    } catch (error) {
        // Fallback for testing
        return {
            category: 'unit-testing',
            model: 'openai_gpt4',
            confidence: 0.85,
            keywords: ['test']
        };
    }
}

function notifyAISystemConfigUpdate() {
    // Send signal to AI system to reload configuration
    const axios = require('axios');
    
    axios.post('http://localhost:3003/api/ai/reload-config')
        .catch(error => console.error('Failed to notify AI system:', error));
}

module.exports = router;