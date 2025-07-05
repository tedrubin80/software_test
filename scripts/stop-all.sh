#!/bin/bash
# File Location: testlab/scripts/stop-all.sh

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping TestLab Services...${NC}"

# Read PIDs from file if it exists
if [ -f ".pids" ]; then
    source .pids
    
    # Stop each service
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    if [ ! -z "$DIAG_PID" ]; then
        echo "Stopping diagnostics (PID: $DIAG_PID)..."
        kill $DIAG_PID 2>/dev/null
    fi
    
    if [ ! -z "$AI_PID" ]; then
        echo "Stopping AI system (PID: $AI_PID)..."
        kill $AI_PID 2>/dev/null
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    rm -f .pids
    echo -e "${GREEN}All services stopped${NC}"
else
    echo -e "${YELLOW}No PID file found. Attempting to stop services by port...${NC}"
    
    # Stop by port as fallback
    lsof -ti:3000 | xargs kill 2>/dev/null
    lsof -ti:3001 | xargs kill 2>/dev/null
    lsof -ti:3002 | xargs kill 2>/dev/null
    lsof -ti:3003 | xargs kill 2>/dev/null
    
    echo -e "${GREEN}Services stopped${NC}"
fi