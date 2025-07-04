#!/bin/bash
echo "🔍 Setting up TestLab complete environment..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d 'v' -f 2)
if [[ $(echo "$NODE_VERSION 16.0.0" | tr " " "\n" | sort -V | head -n1) != "16.0.0" ]]; then
    echo "❌ Node.js version 16+ required. Current version: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm run setup:all

# Create environment file
if [ ! -f .env ]; then
    echo "📄 Creating environment file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys and configuration"
fi

# Create logs directory
mkdir -p logs

echo "🎉 TestLab setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run 'npm run start:backend' to start the backend"
echo "3. Run 'npm run start:diagnostics' to start diagnostics"
echo "4. Run 'npm run start:frontend' to serve the frontend"
