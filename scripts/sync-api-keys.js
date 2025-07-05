// File Location: testlab/scripts/sync-api-keys.js
// Script to sync API keys from existing TestLab storage to the AI system

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🔄 Syncing API keys from TestLab...\n');

// Possible database locations
const dbPaths = [
    path.join(__dirname, '../backend/testlab.db'),
    path.join(__dirname, '../testlab.db'),
    '/data/testlab.db',
    path.join(__dirname, '../../backend/testlab.db')
];

// Find the database
let dbPath = null;
for (const p of dbPaths) {
    if (fs.existsSync(p)) {
        dbPath = p;
        console.log(`✅ Found database at: ${dbPath}`);
        break;
    }
}

if (!dbPath) {
    // Check for existing api_keys.json in /data volume
    if (fs.existsSync('/data/api_keys.json')) {
        console.log('✅ Found existing api_keys.json in /data volume');
        process.exit(0);
    }
    
    console.error('❌ Could not find TestLab database');
    process.exit(1);
}

// Connect to database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

const apiKeys = {};

// Function to extract API keys
function extractAPIKeys() {
    return new Promise((resolve, reject) => {
        // Check api_keys table
        db.all("SELECT service, key FROM api_keys WHERE key IS NOT NULL", (err, rows) => {
            if (!err && rows) {
                rows.forEach(row => {
                    if (row.key && !row.key.startsWith('your-')) {
                        console.log(`Found ${row.service} API key`);
                        apiKeys[row.service.toLowerCase()] = row.key;
                    }
                });
            }
            
            // Check settings table
            db.all("SELECT key, value FROM settings WHERE (key LIKE '%api_key%' OR key LIKE '%API_KEY%') AND value IS NOT NULL", (err, rows) => {
                if (!err && rows) {
                    rows.forEach(row => {
                        if (row.value && !row.value.startsWith('your-')) {
                            // Map common key names
                            let serviceName = row.key.toLowerCase();
                            
                            if (serviceName.includes('openai') || serviceName.includes('chatgpt')) {
                                apiKeys['openai'] = row.value;
                                console.log('Found OpenAI API key');
                            } else if (serviceName.includes('anthropic') || serviceName.includes('claude')) {
                                apiKeys['anthropic'] = row.value;
                                console.log('Found Anthropic API key');
                            } else if (serviceName.includes('together') || serviceName.includes('llama')) {
                                apiKeys['together'] = row.value;
                                console.log('Found Together AI key');
                            } else if (serviceName.includes('cohere')) {
                                apiKeys['cohere'] = row.value;
                                console.log('Found Cohere API key');
                            }
                        }
                    });
                }
                
                resolve();
            });
        });
    });
}

// Main execution
extractAPIKeys().then(() => {
    db.close();
    
    if (Object.keys(apiKeys).length === 0) {
        console.log('\n⚠️  No API keys found in TestLab database');
        return;
    }
    
    console.log(`\n✅ Found ${Object.keys(apiKeys).length} API keys`);
    
    // Save to data directory
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const outputPath = path.join(dataDir, 'api_keys.json');
    
    // If file exists, merge with existing keys
    let existingKeys = {};
    if (fs.existsSync(outputPath)) {
        try {
            existingKeys = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        } catch (e) {
            console.error('Error reading existing keys file:', e);
        }
    }
    
    // Merge keys (new keys overwrite existing)
    const mergedKeys = { ...existingKeys, ...apiKeys };
    
    // Add placeholders for missing services
    const services = ['openai', 'anthropic', 'together', 'cohere', 'huggingface'];
    services.forEach(service => {
        if (!mergedKeys[service]) {
            mergedKeys[service] = `your-${service}-api-key`;
        }
    });
    
    // Save merged keys
    fs.writeFileSync(outputPath, JSON.stringify(mergedKeys, null, 2));
    console.log(`\n✅ API keys saved to: ${outputPath}`);
    
    // Also save to /data if it's a mounted volume
    if (fs.existsSync('/data') && !fs.existsSync('/data/api_keys.json')) {
        fs.writeFileSync('/data/api_keys.json', JSON.stringify(mergedKeys, null, 2));
        console.log('✅ API keys also saved to /data volume');
    }
    
    console.log('\n🎉 API key sync complete!');
}).catch(error => {
    console.error('❌ Error syncing API keys:', error);
    db.close();
    process.exit(1);
});