# File Location: testlab/.env.example

# Server Configuration
NODE_ENV=development
PORT=3001

# Database
DATABASE_PATH=./testlab.db

# Session Secret
SESSION_SECRET=your-session-secret-here

# Admin Credentials (change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# AI System Configuration
AI_ROUTING_PORT=3003
AI_CONFIG_PATH=./backend/config/routing_config.yaml
AI_DATA_DIR=./data

# API Keys (add these to data/api_keys.json instead)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# TOGETHER_API_KEY=...
# COHERE_API_KEY=...

# Diagnostics Configuration
DIAGNOSTICS_PORT=3002

# Frontend Configuration
FRONTEND_PORT=3000

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Security
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Optional Webhooks
# CONFIG_WEBHOOKS=https://your-webhook.com/config-update