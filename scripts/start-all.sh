#!/bin/bash
# File Location: testlab/scripts/start-all.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting TestLab Services...${NC}"

# Check if required directories exist
if [ ! -d "backend" ]; then
    echo -e "${RED}Error: backend directory not found${NC}"
    exit 1
fi

# Create necessary directories
mkdir -p backend/config
mkdir -p backend/ai_system
mkdir -p data
mkdir -p logs

# Check for API keys in various locations
echo -e "${YELLOW}Checking for API keys...${NC}"

# Check if /data volume is mounted (Docker/Railway)
if [ -d "/data" ]; then
    echo -e "${GREEN}Found /data volume${NC}"
    
    # Create symlink if not exists
    if [ ! -L "data" ]; then
        ln -s /data data
        echo -e "${GREEN}Created symlink to /data volume${NC}"
    fi
    
    # Check for existing API keys in volume
    if [ -f "/data/api_keys.json" ]; then
        echo -e "${GREEN}Found existing API keys in /data volume${NC}"
    elif [ -f "/data/testlab.db" ]; then
        echo -e "${GREEN}Found TestLab database in /data volume${NC}"
    fi
elif [ ! -d "data" ]; then
    # Create local data directory if no volume
    mkdir -p data
    echo -e "${YELLOW}Created local data directory${NC}"
fi

# Only create template if no keys exist anywhere
if [ ! -f "data/api_keys.json" ] && [ ! -f "/data/api_keys.json" ] && [ ! -f "backend/testlab.db" ]; then
    echo -e "${YELLOW}Creating API keys template...${NC}"
    cat > data/api_keys.json << EOF
{
    "openai": "your-openai-api-key",
    "anthropic": "your-anthropic-api-key",
    "cohere": "your-cohere-api-key",
    "together": "your-together-api-key",
    "huggingface": "your-huggingface-api-key"
}
EOF
    echo -e "${YELLOW}Please add your API keys to data/api_keys.json${NC}"
else
    echo -e "${GREEN}Using existing API keys${NC}"
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Check all required ports
echo -e "${YELLOW}Checking ports...${NC}"
check_port 3000 || exit 1
check_port 3001 || exit 1
check_port 3002 || exit 1
check_port 3003 || exit 1

# Start Backend Server
echo -e "${GREEN}Starting backend server on port 3001...${NC}"
cd backend
npm install
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start Diagnostics Server
echo -e "${GREEN}Starting diagnostics server on port 3002...${NC}"
cd diagnostics
npm install
npm start > ../logs/diagnostics.log 2>&1 &
DIAG_PID=$!
cd ..

# Start AI Routing System
echo -e "${GREEN}Starting AI routing system on port 3003...${NC}"
cd backend/ai_system

# Check if Python dependencies are installed
if ! python -c "import langchain" 2>/dev/null; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    pip install -r requirements.txt
fi

python langchain_router.py > ../../logs/ai-system.log 2>&1 &
AI_PID=$!
cd ../..

# Start Frontend Server
echo -e "${GREEN}Starting frontend server on port 3000...${NC}"
cd frontend
python -m http.server 3000 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Create PID file
cat > .pids << EOF
BACKEND_PID=$BACKEND_PID
DIAG_PID=$DIAG_PID
AI_PID=$AI_PID
FRONTEND_PID=$FRONTEND_PID
EOF

echo -e "${GREEN}All services started successfully!${NC}"
echo ""
echo "Service URLs:"
echo -e "  Frontend:    ${GREEN}http://localhost:3000${NC}"
echo -e "  Admin Panel: ${GREEN}http://localhost:3000/admin.html${NC}"
echo -e "  Backend API: ${GREEN}http://localhost:3001${NC}"
echo -e "  Diagnostics: ${GREEN}http://localhost:3002${NC}"
echo -e "  AI System:   ${GREEN}http://localhost:3003${NC}"
echo ""
echo "Process IDs:"
echo "  Backend:     $BACKEND_PID"
echo "  Diagnostics: $DIAG_PID"
echo "  AI System:   $AI_PID"
echo "  Frontend:    $FRONTEND_PID"
echo ""
echo -e "${YELLOW}Logs are available in the logs/ directory${NC}"
echo -e "${YELLOW}To stop all services, run: ./scripts/stop-all.sh${NC}"

# Function to handle shutdown
shutdown() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID $DIAG_PID $AI_PID $FRONTEND_PID 2>/dev/null
    rm -f .pids
    echo -e "${GREEN}All services stopped${NC}"
    exit 0
}

# Set up signal handlers
trap shutdown SIGINT SIGTERM

# Wait for all processes
wait