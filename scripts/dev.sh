#!/bin/bash
echo "🚀 Starting TestLab development environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from template..."
    cp .env.example .env
    echo "Please edit .env file with your configuration"
fi

# Start all services
echo "Starting all services..."
concurrently \
    "npm run dev:backend" \
    "npm run dev:diagnostics" \
    "npm run start:frontend" \
    --names "backend,diagnostics,frontend" \
    --prefix-colors "blue,green,yellow"
