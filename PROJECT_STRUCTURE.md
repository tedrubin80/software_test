# 📁 TestLab Project Structure

```
testlab/
├── 📁 backend/                    # TestLab Backend Server
│   ├── server.js                  # Main backend server
│   ├── package.json               # Backend dependencies
│   └── testlab.db                 # SQLite database (auto-created)
│
├── 📁 frontend/                   # TestLab Frontend
│   ├── index.html                 # Main testing interface
│   ├── admin.html                 # Admin dashboard
│   └── 📁 assets/
│       ├── 📁 css/               # Stylesheets
│       └── 📁 js/                # JavaScript files
│
├── 📁 diagnostics/               # Multi-AI Diagnostics System
│   ├── diagnostics-server.js     # AI diagnostics server
│   ├── package.json              # Diagnostics dependencies
│   ├── test-diagnostics.js       # Test script
│   └── 📁 frontend/
│       └── index.html             # Diagnostics web interface
│
├── 📁 docs/                      # Documentation
│   ├── SETUP.md                  # Setup guide
│   ├── API.md                    # API documentation
│   └── DIAGNOSTICS.md            # Diagnostics guide
│
├── 📁 scripts/                   # Utility scripts
│   ├── setup.sh                  # Setup script
│   ├── dev.sh                    # Development script
│   └── deploy.sh                 # Deployment script
│
├── 📁 tests/                     # Test files
│   ├── 📁 backend/               # Backend tests
│   ├── 📁 diagnostics/           # Diagnostics tests
│   └── integration.test.js       # Integration tests
│
├── 📁 config/                    # Configuration files
├── 📁 logs/                      # Log files
├── 📁 temp/                      # Temporary files
│
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── package.json                  # Main package.json
├── README.md                     # Main documentation
├── LICENSE                       # MIT License
├── CONTRIBUTING.md               # Contributing guide
└── PROJECT_STRUCTURE.md          # This file
```

## 🎯 Key Components

### Backend Server (Port 3001)
- User authentication and management
- API credential storage
- Usage analytics
- Admin dashboard backend

### Frontend Interface (Port 3000)
- Interactive testing exercises
- Student progress tracking
- Code review interface
- Admin dashboard

### Diagnostics System (Port 3002)
- Multi-AI website analysis
- ChatGPT, Claude, and Llama integration
- Consensus reporting
- Lighthouse performance audits

## 🚀 Quick Start Commands

```bash
# Setup everything
npm run setup:all

# Start all services
npm run start:backend    # Backend on port 3001
npm run start:diagnostics # Diagnostics on port 3002
npm run start:frontend   # Frontend on port 3000

# Development mode
./scripts/dev.sh         # Start all with hot reload

# Run tests
npm run test:all
```
