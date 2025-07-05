// FILE: redirect-fix.js
// Quick script to fix the redirect issue
// Run this in the browser console on admin-login.html after login

// Override the redirect in admin-login.html
if (window.location.pathname.includes('admin-login')) {
    // Intercept the original redirect
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
        get: function() { return originalLocation; },
        set: function(value) {
            if (value === '/admin') {
                originalLocation.href = '/admin.html';
            } else {
                originalLocation.href = value;
            }
        }
    });
}