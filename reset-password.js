// FILE LOCATION: /reset-password.js (root directory)
// Utility script to reset admin password when locked out

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Determine data directory
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const LOCAL_DATA_DIR = path.join(__dirname, 'data');

// Check which directory has the config
let configPath;
if (fs.existsSync(path.join(DATA_DIR, 'config.json'))) {
    configPath = path.join(DATA_DIR, 'config.json');
    console.log(`Found config at: ${configPath}`);
} else if (fs.existsSync(path.join(LOCAL_DATA_DIR, 'config.json'))) {
    configPath = path.join(LOCAL_DATA_DIR, 'config.json');
    console.log(`Found config at: ${configPath}`);
} else {
    console.error('❌ No config.json found!');
    console.log('Please run the setup process first.');
    process.exit(1);
}

// Get new password from command line
const newPassword = process.argv[2];

if (!newPassword) {
    console.log('Usage: node reset-password.js <new-password>');
    console.log('Example: node reset-password.js mynewpassword123');
    process.exit(1);
}

if (newPassword.length < 6) {
    console.error('❌ Password must be at least 6 characters');
    process.exit(1);
}

// Reset password
async function resetPassword() {
    try {
        // Load existing config
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Generate new hash
        const hash = await bcrypt.hash(newPassword, 10);
        
        // Update config
        config.adminPassword = hash;
        
        // Save config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('✅ Password reset successfully!');
        console.log(`📁 Config location: ${configPath}`);
        console.log(`🔑 New password: ${newPassword}`);
        console.log('\nYou can now login with your new password.');
        
    } catch (error) {
        console.error('❌ Error resetting password:', error.message);
        process.exit(1);
    }
}

resetPassword();