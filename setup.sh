#!/bin/bash
#
# TARS Setup Script for macOS
# Run this script on a fresh MacBook to set up TARS
#
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  🚀 TARS Setup Script for macOS${NC}"
    echo -e "${BLUE}  Test Automation & Review System${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header

# ===========================================
# Check System Requirements
# ===========================================
print_step "Checking system requirements..."

# Check macOS version
if [[ "$(uname)" != "Darwin" ]]; then
    print_error "This script is designed for macOS only"
    exit 1
fi
print_success "macOS detected"

# ===========================================
# Install Homebrew
# ===========================================
print_step "Checking Homebrew..."

if ! command -v brew &> /dev/null; then
    print_step "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi
    print_success "Homebrew installed"
else
    print_success "Homebrew already installed ($(brew --version | head -1))"
fi

# ===========================================
# Install Node.js
# ===========================================
print_step "Checking Node.js..."

if ! command -v node &> /dev/null; then
    print_step "Installing Node.js 20..."
    brew install node@20
    
    # Add to PATH if needed
    if [[ -d "/opt/homebrew/opt/node@20/bin" ]]; then
        export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
        echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
    fi
    print_success "Node.js installed"
else
    NODE_VERSION=$(node --version)
    print_success "Node.js already installed ($NODE_VERSION)"
fi

# ===========================================
# Install pnpm
# ===========================================
print_step "Checking pnpm..."

if ! command -v pnpm &> /dev/null; then
    print_step "Installing pnpm..."
    npm install -g pnpm
    print_success "pnpm installed"
else
    PNPM_VERSION=$(pnpm --version)
    print_success "pnpm already installed (v$PNPM_VERSION)"
fi

# ===========================================
# Install Ollama
# ===========================================
print_step "Checking Ollama..."

if ! command -v ollama &> /dev/null; then
    print_step "Installing Ollama..."
    brew install ollama
    print_success "Ollama installed"
else
    print_success "Ollama already installed"
fi

# ===========================================
# Install Dependencies
# ===========================================
print_step "Installing TARS dependencies..."

cd "$SCRIPT_DIR"
pnpm install
print_success "Dependencies installed"

# ===========================================
# Build Packages
# ===========================================
print_step "Building packages..."

# Build shared package
cd "$SCRIPT_DIR/packages/shared"
if pnpm build 2>/dev/null; then
    print_success "Shared package built"
else
    print_error "Failed to build shared package (may already be built)"
fi

# Build CLI package
cd "$SCRIPT_DIR/packages/cli"
if pnpm build 2>/dev/null; then
    print_success "CLI package built"
else
    print_error "Failed to build CLI package (may already be built)"
fi

cd "$SCRIPT_DIR"

# ===========================================
# Link CLI Globally
# ===========================================
print_step "Linking CLI globally..."

cd "$SCRIPT_DIR/packages/cli"
npm link 2>/dev/null || true
cd "$SCRIPT_DIR"
print_success "CLI linked (use 'tars' command)"

# ===========================================
# Setup Ollama Models
# ===========================================
print_step "Setting up Ollama models..."

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    print_step "Starting Ollama service..."
    ollama serve &
    sleep 5
fi

# Pull models
print_step "Pulling llama3.2:3b model (this may take a while)..."
ollama pull llama3.2:3b 2>/dev/null || true

print_step "Pulling deepseek-coder:6.7b model (this may take a while)..."
ollama pull deepseek-coder:6.7b 2>/dev/null || true

print_success "Ollama models configured"

# ===========================================
# Create Environment Files
# ===========================================
print_step "Creating environment files..."

# API .env
cat > "$SCRIPT_DIR/packages/api/.env" << 'EOF'
OLLAMA_URL=http://localhost:11434
OLLAMA_SCENARIO_MODEL=llama3.2:3b
OLLAMA_CODE_MODEL=deepseek-coder:6.7b
OLLAMA_HERMETIC_MODEL=deepseek-coder:6.7b
OLLAMA_ANALYSIS_MODEL=deepseek-coder:6.7b
PORT=3001
NODE_ENV=development
TELEMETRY_ENABLED=true
EOF

# Web .env.local
cat > "$SCRIPT_DIR/packages/web/.env.local" << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF

print_success "Environment files created"

# ===========================================
# Completion
# ===========================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ TARS Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}To start TARS:${NC}"
echo ""
echo "  Option 1: Quick Start"
echo "    ./demo-start.sh"
echo ""
echo "  Option 2: Manual Start (3 terminals)"
echo "    Terminal 1: ollama serve"
echo "    Terminal 2: cd packages/api && npm run dev"
echo "    Terminal 3: cd packages/web && npm run dev"
echo ""
echo -e "${BLUE}Service URLs:${NC}"
echo "  Web Portal:  http://localhost:3000"
echo "  API Server:  http://localhost:3001"
echo "  API Health:  http://localhost:3001/health"
echo ""
echo -e "${BLUE}CLI Commands:${NC}"
echo "  tars --help              Show all commands"
echo "  tars analyze --path .    Analyze a repository"
echo "  tars status              Check system status"
echo ""
echo -e "${YELLOW}Note: You may need to restart your terminal for PATH changes.${NC}"
echo ""
