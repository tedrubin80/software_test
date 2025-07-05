#!/bin/bash
# FILE: redirect-patch.sh
# Quick patch to fix redirect issues in TestLab
# This script updates all redirect URLs to use .html extension

echo "🔧 Applying redirect fixes..."

# Fix admin-login.html redirects
if [ -f "frontend/admin-login.html" ]; then
    echo "Fixing frontend/admin-login.html..."
    # Change window.location.href = '/admin' to '/admin.html'
    sed -i.bak "s|window.location.href = '/admin'|window.location.href = '/admin.html'|g" frontend/admin-login.html
    echo "✅ Fixed admin-login.html redirects"
fi

# Fix any JavaScript files that redirect to /admin
if [ -f "frontend/assets/js/auth.js" ]; then
    echo "Fixing frontend/assets/js/auth.js..."
    sed -i.bak "s|location.href = '/admin'|location.href = '/admin.html'|g" frontend/assets/js/auth.js
    sed -i.bak "s|location = '/admin'|location = '/admin.html'|g" frontend/assets/js/auth.js
fi

# Fix index.html if it has admin redirects
if [ -f "frontend/index.html" ]; then
    echo "Fixing frontend/index.html..."
    sed -i.bak "s|href=\"/admin\"|href=\"/admin.html\"|g" frontend/index.html
    sed -i.bak "s|location.href = '/admin'|location.href = '/admin.html'|g" frontend/index.html
fi

# Fix test.html admin links
if [ -f "frontend/test.html" ]; then
    echo "Fixing frontend/test.html..."
    sed -i.bak "s|href=\"/admin\"|href=\"/admin.html\"|g" frontend/test.html
fi

# Fix ai-chat.html admin links
if [ -f "frontend/ai-chat.html" ]; then
    echo "Fixing frontend/ai-chat.html..."
    sed -i.bak "s|href=\"/admin\"|href=\"/admin.html\"|g" frontend/ai-chat.html
fi

# Fix admin.html to use cookie auth instead of localStorage
if [ -f "frontend/admin.html" ]; then
    echo "Fixing frontend/admin.html auth check..."
    # This is more complex, so we'll create a new auth check
    cat > frontend/admin-auth-fix.js << 'EOF'
// Add this to the top of admin.html script section
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check', {
            credentials: 'include'
        });
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/admin-login.html';
            return false;
        }
        return true;
    } catch (error) {
        window.location.href = '/admin-login.html';
        return false;
    }
}

// Replace the localStorage check with:
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        // Continue with loading dashboard
        if (typeof loadDashboard === 'function') {
            loadDashboard();
        }
    }
});
EOF
    echo "✅ Created admin-auth-fix.js - manually add this to admin.html"
fi

# Fix logout functions to use cookie-based logout
echo "Creating logout fix..."
cat > frontend/logout-fix.js << 'EOF'
// Updated logout function for cookie-based auth
async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    // Always redirect to login
    window.location.href = '/admin-login.html';
}
EOF

echo "✅ Created logout-fix.js"

# Create a simple fix for the server-side routing
echo "Creating server route fix..."
cat > frontend/admin-routes-fix.js << 'EOF'
// Add these routes before the catch-all route in simple-server.js

// Explicit HTML file routes
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.get('/test.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'test.html'));
});

app.get('/ai-chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai-chat.html'));
});

// Also handle without .html extension
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});
EOF

echo "✅ Created admin-routes-fix.js"

echo ""
echo "🎉 Redirect fixes applied!"
echo ""
echo "📝 Next steps:"
echo "1. Review the changes in *.bak backup files"
echo "2. Add the code from admin-auth-fix.js to your admin.html"
echo "3. Add the routes from admin-routes-fix.js to your simple-server.js"
echo "4. Test locally before deploying"
echo "5. Commit and push: git add -A && git commit -m 'Fix admin redirects' && git push"
echo ""
echo "🔍 Backup files created with .bak extension"