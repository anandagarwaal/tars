# TARS Deployment Guide for macOS

Complete guide to deploy the TARS (Test Automation & Review System) on a new MacBook.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [System Requirements](#2-system-requirements)
3. [Installation Steps](#3-installation-steps)
4. [Configuration](#4-configuration)
5. [Starting the Services](#5-starting-the-services)
6. [Verification](#6-verification)
7. [Troubleshooting](#7-troubleshooting)
8. [Quick Reference](#8-quick-reference)

---

## 1. Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or higher | Runtime for API and Web |
| npm | 9.x or higher | Package management |
| pnpm | 8.x or higher | Monorepo workspace management |
| Git | 2.x or higher | Version control |
| Ollama | Latest | Local LLM for AI features |
| Docker | Latest (optional) | For hermetic/Raptor containers |

---

## 2. System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Storage | 10 GB | 20 GB |
| CPU | Apple M1 / Intel i5 | Apple M2/M3 / Intel i7 |
| macOS | 12.0 (Monterey) | 14.0 (Sonoma) |

---

## 3. Installation Steps

### Step 1: Install Homebrew (if not installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Install Node.js

```bash
# Using Homebrew
brew install node@20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

**Alternative: Using nvm (recommended for version management)**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart terminal, then install Node.js
nvm install 20
nvm use 20
nvm alias default 20
```

### Step 3: Install pnpm

```bash
# Using npm
npm install -g pnpm

# Or using Homebrew
brew install pnpm

# Verify installation
pnpm --version  # Should show 8.x.x or higher
```

### Step 4: Install Git

```bash
# Usually pre-installed on macOS, if not:
brew install git

# Verify
git --version
```

### Step 5: Install Ollama

```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai
```

### Step 6: Install Docker (Optional - for Hermetic/Raptor)

```bash
# Download Docker Desktop from https://www.docker.com/products/docker-desktop/
# Or using Homebrew
brew install --cask docker
```

---

## 4. Configuration

### Step 1: Clone the Repository

```bash
# Clone to your preferred location
cd ~/Desktop
git clone <repository-url> tars
cd tars
```

**If copying from another machine:**

```bash
# Copy the tars folder to the new machine
# Using AirDrop, USB drive, or scp:
scp -r user@old-machine:~/Desktop/Agents/tars ~/Desktop/
cd ~/Desktop/tars
```

### Step 2: Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

### Step 3: Build the Packages

```bash
# Build shared package first
cd packages/shared
pnpm build

# Build CLI
cd ../cli
pnpm build

# Return to root
cd ../..
```

### Step 4: Configure Environment Variables (Optional)

Create a `.env` file in `packages/api/`:

```bash
cat > packages/api/.env << 'EOF'
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_SCENARIO_MODEL=llama3.2:3b
OLLAMA_CODE_MODEL=deepseek-coder:6.7b
OLLAMA_HERMETIC_MODEL=deepseek-coder:6.7b
OLLAMA_ANALYSIS_MODEL=deepseek-coder:6.7b

# API Configuration
PORT=3001
NODE_ENV=development

# Telemetry
TELEMETRY_ENABLED=true
EOF
```

Create a `.env.local` file in `packages/web/`:

```bash
cat > packages/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
```

### Step 5: Setup Ollama Models

```bash
# Start Ollama service
ollama serve &

# Wait for Ollama to start
sleep 5

# Pull required models
ollama pull llama3.2:3b        # For scenario generation
ollama pull deepseek-coder:6.7b # For code generation

# Verify models are installed
ollama list
```

### Step 6: Link CLI Globally (Optional)

```bash
cd packages/cli
npm link

# Now 'tars' command is available globally
tars --help
```

---

## 5. Starting the Services

### Option A: Quick Start Script

```bash
# From the tars root directory
./demo-start.sh
```

### Option B: Manual Start

Open **3 terminal windows**:

**Terminal 1 - Ollama:**
```bash
ollama serve
```

**Terminal 2 - API Server:**
```bash
cd ~/Desktop/tars/packages/api
npm run dev
```

**Terminal 3 - Web Portal:**
```bash
cd ~/Desktop/tars/packages/web
npm run dev
```

### Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Web Portal | http://localhost:3000 | Main UI |
| API Server | http://localhost:3001 | Backend API |
| API Health | http://localhost:3001/health | Health check |
| Ollama | http://localhost:11434 | LLM service |

---

## 6. Verification

### Check All Services

```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check API
curl http://localhost:3001/health

# Check Web (should return HTML)
curl -s http://localhost:3000 | head -5
```

### Expected Health Response

```json
{
  "status": "ok",
  "service": "tars-api",
  "version": "1.0.0",
  "ollama": {
    "status": "connected",
    "url": "http://localhost:11434",
    "availableModels": ["llama3.2:3b", "deepseek-coder:6.7b"]
  },
  "websocket": {
    "status": "active"
  },
  "telemetry": {
    "enabled": true
  }
}
```

### Test CLI

```bash
# Check CLI is working
tars --help

# Analyze a repository
cd ~/your-project
tars analyze --path .

# Check status
tars status
```

---

## 7. Troubleshooting

### Issue: Port Already in Use

```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Find and kill process on port 11434
lsof -ti:11434 | xargs kill -9
```

### Issue: Ollama Not Connecting

```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama manually
ollama serve

# If port conflict, kill existing process
pkill ollama
ollama serve
```

### Issue: pnpm Install Fails

```bash
# Clear pnpm cache
pnpm store prune

# Remove node_modules and reinstall
rm -rf node_modules packages/*/node_modules
pnpm install
```

### Issue: CLI Not Found After npm link

```bash
# Check npm global bin path
npm config get prefix

# Add to PATH in ~/.zshrc
export PATH="$(npm config get prefix)/bin:$PATH"

# Reload shell
source ~/.zshrc
```

### Issue: TypeScript Build Errors

```bash
# Rebuild all packages
cd packages/shared && pnpm build
cd ../cli && pnpm build
cd ../api && pnpm build
```

### Issue: Web Portal Shows "API Offline"

1. Verify API is running on port 3001
2. Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
3. Restart the web portal after changing env vars

### Issue: Ollama Models Not Found

```bash
# List available models
ollama list

# Pull missing models
ollama pull llama3.2:3b
ollama pull deepseek-coder:6.7b
```

---

## 8. Quick Reference

### Directory Structure

```
tars/
├── packages/
│   ├── api/          # Backend API (Express)
│   ├── cli/          # Command-line tool
│   ├── shared/       # Shared types
│   └── web/          # Web portal (Next.js)
├── demo-hermetic/    # Hermetic examples
├── demo-raptor/      # Raptor examples
├── demo-tests/       # Generated test examples
└── demo-start.sh     # Quick start script
```

### Essential Commands

```bash
# Start all services
./demo-start.sh

# CLI commands
tars analyze --path <repo>      # Analyze repository
tars generate --prd <file>      # Generate test scenarios
tars onboard hermetic           # Setup hermetic testing
tars onboard raptor             # Setup Raptor recording
tars status                     # Check system status

# Development
pnpm install                    # Install dependencies
pnpm build                      # Build all packages
npm run dev                     # Start dev server (in package dir)
```

### Default Ports

| Service | Port |
|---------|------|
| Web Portal | 3000 |
| API Server | 3001 |
| Ollama | 11434 |
| Hermetic Server | 8080 |
| Raptor Proxy | 8081 |
| Mockoon | 3002 |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | http://localhost:11434 | Ollama API URL |
| `OLLAMA_SCENARIO_MODEL` | llama3.2:3b | Model for scenarios |
| `OLLAMA_CODE_MODEL` | deepseek-coder:6.7b | Model for code gen |
| `PORT` | 3001 | API server port |
| `NEXT_PUBLIC_API_URL` | http://localhost:3001 | API URL for web |

---

## Automated Setup Script

Save this as `setup.sh` and run on a fresh MacBook:

```bash
#!/bin/bash
set -e

echo "🚀 TARS Setup Script for macOS"
echo "=============================="

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    brew install node@20
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install Ollama
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    brew install ollama
fi

# Navigate to TARS directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing TARS dependencies..."
pnpm install

# Build packages
echo "🔨 Building packages..."
cd packages/shared && pnpm build && cd ../..
cd packages/cli && pnpm build && cd ../..

# Link CLI
echo "🔗 Linking CLI globally..."
cd packages/cli && npm link && cd ../..

# Start Ollama and pull models
echo "🤖 Setting up Ollama models..."
ollama serve &
sleep 5
ollama pull llama3.2:3b
ollama pull deepseek-coder:6.7b

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start TARS:"
echo "  ./demo-start.sh"
echo ""
echo "Or manually:"
echo "  Terminal 1: ollama serve"
echo "  Terminal 2: cd packages/api && npm run dev"
echo "  Terminal 3: cd packages/web && npm run dev"
echo ""
echo "Web Portal: http://localhost:3000"
```

Make it executable:

```bash
chmod +x setup.sh
./setup.sh
```

---

## Support

For issues or questions:
- Check the [Troubleshooting](#7-troubleshooting) section
- Review logs in terminal output
- Check Ollama status at http://localhost:11434
- Verify API health at http://localhost:3001/health

---

**Happy Testing with TARS! 🚀**
