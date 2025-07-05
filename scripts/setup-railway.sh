#!/bin/bash
# FILE LOCATION: /setup-railway.sh (root directory)
# Setup script for Railway deployment with proper data persistence

echo "🚀 Setting up Railway environment..."

# Check if we're running on Railway
if [ ! -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "✅ Detected Railway environment: $RAILWAY_ENVIRONMENT"
fi

# Ensure /data directory is used for persistence
if [ -d "/data" ]; then
    echo "✅ Found /data volume for persistence"
    
    # Check for existing config in wrong locations and move to /data
    if [ -f "/app/config.json" ] && [ ! -f "/data/config.json" ]; then
        echo "📦 Moving config.json to /data volume"
        cp /app/config.json /data/
    fi
    
    if [ -f "/app/.setup-complete" ] && [ ! -f "/data/.setup-complete" ]; then
        echo "📦 Moving .setup-complete to /data volume"
        cp /app/.setup-complete /data/
    fi
    
    # Clean up files from wrong locations
    rm -f /app/config.json /app/.setup-complete
    rm -f /app/frontend/config.json /app/frontend/.setup-complete
    
    # Set environment variable to ensure app uses /data
    export RAILWAY_VOLUME_MOUNT_PATH=/data
    
    echo "✅ Data persistence configured at /data"
else
    echo "⚠️  WARNING: No /data volume found!"
    echo "⚠️  Data will not persist across deployments"
    echo "⚠️  Please add a volume mounted at /data in Railway settings"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start the server
echo "🚀 Starting TestLab server..."
exec node frontend/simple-server.js