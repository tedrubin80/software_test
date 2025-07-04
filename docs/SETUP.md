# 🛠️ TestLab Setup Guide

Complete installation and configuration guide for TestLab.

## Prerequisites

- Node.js 16+ and npm 8+
- Chrome/Chromium browser (for Lighthouse)
- API keys for AI services (optional)

## Installation Steps

### 1. Clone and Install
```bash
git clone <repository-url>
cd testlab
npm run setup:all
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env
```

### 3. Start Services
```bash
# Start backend
npm run start:backend

# Start diagnostics (in another terminal)
npm run start:diagnostics

# Serve frontend (in another terminal)
npm run start:frontend
```

## Configuration

### API Keys Setup
Add your API keys to `.env`:
```
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-claude-key
TOGETHER_AI_API_KEY=your-together-ai-key
```

### Admin Access
Default credentials:
- Username: `admin`
- Password: `admin123`

**⚠️ Change these immediately after first login!**

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.
