#!/bin/bash

# ╔══════════════════════════════════════════════════════════════╗
# ║           TARS - Hackathon Demo Startup Script               ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           🤖 TARS - Demo Startup Script                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    lsof -i:"$1" >/dev/null 2>&1
    return $?
}

# Function to kill process on port
kill_port() {
    lsof -ti:"$1" | xargs kill -9 2>/dev/null || true
}

# Step 1: Check and start Ollama
echo -e "${YELLOW}[1/4]${NC} Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found. Please install it: brew install ollama${NC}"
    exit 1
fi

if ! pgrep -x "ollama" > /dev/null; then
    echo -e "${YELLOW}   Starting Ollama...${NC}"
    ollama serve &>/dev/null &
    sleep 3
fi

# Check if model is available
if ! ollama list | grep -q "llama3.2:3b"; then
    echo -e "${YELLOW}   Pulling llama3.2:3b model (this may take a while)...${NC}"
    ollama pull llama3.2:3b
fi

echo -e "${GREEN}   ✅ Ollama is running${NC}"

# Step 2: Kill existing processes on ports
echo -e "${YELLOW}[2/4]${NC} Cleaning up ports..."
if check_port 3001; then
    echo -e "${YELLOW}   Killing process on port 3001...${NC}"
    kill_port 3001
    sleep 1
fi
if check_port 3000; then
    echo -e "${YELLOW}   Killing process on port 3000...${NC}"
    kill_port 3000
    sleep 1
fi
echo -e "${GREEN}   ✅ Ports cleared${NC}"

# Step 3: Start API server
echo -e "${YELLOW}[3/4]${NC} Starting API server..."
cd "$SCRIPT_DIR/packages/api"
npm run dev &>/dev/null &
API_PID=$!

# Wait for API to be ready
echo -e "${YELLOW}   Waiting for API to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}❌ API failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ API server running on http://localhost:3001${NC}"

# Step 4: Start Web portal
echo -e "${YELLOW}[4/4]${NC} Starting Web portal..."
cd "$SCRIPT_DIR/packages/web"
npm run dev &>/dev/null &
WEB_PID=$!

# Wait for Web to be ready
echo -e "${YELLOW}   Waiting for Web portal to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ Web portal failed to start${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Web portal running on http://localhost:3000${NC}"

# Summary
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 TARS Demo is ready!${NC}"
echo ""
echo -e "${CYAN}   📱 Web Portal:${NC}     http://localhost:3000"
echo -e "${CYAN}   📊 Telemetry:${NC}      http://localhost:3000/telemetry"
echo -e "${CYAN}   🔌 API Health:${NC}     http://localhost:3001/health"
echo -e "${CYAN}   📡 WebSocket:${NC}      ws://localhost:3001/ws"
echo ""
echo -e "${YELLOW}   Press Ctrl+C to stop all services${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

# Wait for user to stop
trap "echo ''; echo -e '${YELLOW}Stopping services...${NC}'; kill $API_PID $WEB_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
