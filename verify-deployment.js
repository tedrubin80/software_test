const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying deployment structure...\n');

// Check current working directory
console.log('📁 Current directory:', process.cwd());
console.log('📁 __dirname:', __dirname);

// Check if frontend directory exists
const frontendPath = path.join(__dirname, 'frontend');
console.log('\n🔍 Checking frontend directory...');
if (fs.existsSync(frontendPath)) {
    console.log('✅ Frontend directory exists at:', frontendPath);
    
    // List files in frontend
    const files = fs.readdirSync(frontendPath);
    console.log('📄 Files in frontend directory:');
    files.forEach(file => {
        const stats = fs.statSync(path.join(frontendPath, file));
        console.log(`   - ${file} (${stats.size} bytes)`);
    });
    
    // Check specific files
    const requiredFiles = ['index.html', 'admin.html'];
    console.log('\n🔍 Checking required files:');
    requiredFiles.forEach(file => {
        const filePath = path.join(frontendPath, file);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`✅ ${file} exists (${stats.size} bytes)`);
            
            // Show first 200 characters of the file
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`   Preview: ${content.substring(0, 200)}...`);
        } else {
            console.log(`❌ ${file} NOT FOUND`);
        }
    });
} else {
    console.log('❌ Frontend directory NOT FOUND');
    
    // List what directories do exist
    console.log('\n📁 Available directories:');
    const dirs = fs.readdirSync(__dirname).filter(f => fs.statSync(path.join(__dirname, f)).isDirectory());
    dirs.forEach(dir => console.log(`   - ${dir}/`));
}

// Check diagnostics
const diagnosticsPath = path.join(__dirname, 'diagnostics', 'frontend');
console.log('\n🔍 Checking diagnostics directory...');
if (fs.existsSync(diagnosticsPath)) {
    console.log('✅ Diagnostics frontend directory exists');
} else {
    console.log('❌ Diagnostics frontend directory NOT FOUND');
}

// Environment info
console.log('\n🌍 Environment:');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   PORT:', process.env.PORT || 'not set');

console.log('\n✅ Verification complete!');