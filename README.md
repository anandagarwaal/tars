# 🤖 TARS - Test Automation & Review System

<div align="center">

![TARS Logo](https://img.shields.io/badge/TARS-AI%20Powered-6366f1?style=for-the-badge&logo=robot&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-10b981?style=for-the-badge)
![Node](https://img.shields.io/badge/node-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript&logoColor=white)

**Transform PRDs into Test Scenarios • Generate Test Code • Automate Hermetic Onboarding**

[Quick Start](#-quick-start) • [Features](#-features) • [Documentation](#-documentation) • [Demo](#-demo)

</div>

---

## 🎯 What is TARS?

TARS is an AI-powered testing platform that revolutionizes how teams approach test automation:

| Capability | Description |
|------------|-------------|
| 📄 **PRD → Scenarios** | Upload Product Requirements Documents and let AI generate comprehensive test scenarios |
| 🧪 **Scenario → Code** | Convert approved scenarios into executable test code for your preferred framework |
| 🔒 **Hermetic Onboarding** | Auto-generate isolated test environments with fake services and in-memory databases |
| 📡 **Raptor Integration** | Record and replay production traffic for deterministic testing |
| 🧠 **Code Analysis** | Analyze repositories to understand structure, dependencies, and testing patterns |

---

## 🚀 Quick Start

### Prerequisites

| Software | Version | Required |
|----------|---------|----------|
| Node.js | 18+ | ✅ |
| pnpm | 8+ | ✅ |
| Ollama | Latest | ✅ |
| Docker | Latest | Optional |

### One-Command Setup (macOS)

```bash
# Clone the repo and run setup
git clone <repository-url> tars
cd tars
./setup.sh
```

### Manual Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Build packages
cd packages/shared && pnpm build
cd ../cli && pnpm build && npm link
cd ../..

# 3. Setup Ollama
ollama serve &
ollama pull llama3.2:3b
ollama pull deepseek-coder:6.7b

# 4. Start services
./demo-start.sh
```

### Access the Platform

| Service | URL |
|---------|-----|
| 🌐 Web Portal | http://localhost:3000 |
| 🔌 API Server | http://localhost:3001 |
| ❤️ Health Check | http://localhost:3001/health |

---

## ✨ Features

### 🌐 Web Portal

- **PRD Upload** - Paste or upload requirement documents
- **Scenario Review** - Review AI-generated test scenarios with approve/reject workflow
- **PRD Management** - Track all PRDs and their status
- **Hermetic Onboarding** - Interactive wizard for hermetic setup
- **Raptor Configuration** - Setup traffic recording/replay
- **Telemetry Dashboard** - Real-time usage metrics and analytics
- **Real-time Updates** - WebSocket-powered live status updates

### 💻 CLI Commands

```bash
# Repository Analysis
tars analyze --path <repo>           # Quick analysis
tars analyze --path <repo> --deep    # LLM-powered deep analysis
tars analyze --path <repo> --all     # Analyze all files (no limit)

# Test Generation  
tars generate --prd <id> --framework jest     # Generate Jest tests
tars generate --prd <id> --framework junit    # Generate JUnit tests
tars generate --prd <id> --framework cypress  # Generate Cypress tests

# Hermetic Onboarding
tars onboard hermetic --service-name my-service --mode code-change
tars onboard hermetic --service-name my-service --mode mockoon

# Raptor Onboarding
tars onboard raptor --service-name my-service --upstream http://localhost:8080

# Git Integration
tars git commit --prd <id>           # Auto-commit generated tests
tars git branch --prd <id>           # Create feature branch for tests

# System Status
tars status                          # Check all services
```

### 🔒 Hermetic Server (Code Change Mode)

Generated files for Java Spring Boot services:

| File | Purpose |
|------|---------|
| `SeedEntitiesController.java` | API to seed test data |
| `ResetDataController.java` | API to reset to base state |
| `SampleDataController.java` | Get sample payloads |
| `RequestTracingFilter.java` | Request/response logging |
| `FakeImplementations.java` | Mock external services |
| `application-hermetic.yml` | H2 in-memory database config |
| `pom-hermetic-profile.xml` | Maven hermetic profile |
| `hermetic-build.gradle.kts` | Gradle hermetic config |
| `Dockerfile.hermetic` | Docker image |
| `docker-compose.hermetic.yml` | Container orchestration |

### 📦 Hermetic Server (Mockoon Mode)

No-code approach using Mockoon for lightweight mocking:

| File | Purpose |
|------|---------|
| `data-buckets.json` | Pre-populated test data |
| `environment.json` | Mockoon environment spec |
| `*-routes.json` | Entity CRUD routes |
| `hermetic-routes.json` | Seed/Reset control APIs |
| `docker-compose.mockoon.yml` | Docker setup |

### 📡 Raptor Traffic Recording

Record and replay production traffic:

| File | Purpose |
|------|---------|
| `raptor.yml` | Main configuration |
| `default-filters.yml` | PII/sensitive data filters |
| `sample-recording.json` | Recording format example |
| `docker-compose.raptor.yml` | Docker setup |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Web Portal (Next.js)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Upload  │ │Scenarios │ │ Hermetic │ │  Raptor  │ │  Telemetry   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ HTTP / WebSocket
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Core API (Express)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   PRD    │ │ Scenario │ │ Hermetic │ │  Ollama  │ │  Telemetry   │ │
│  │  Routes  │ │  Routes  │ │  Routes  │ │ Service  │ │   Service    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│  │   Git    │ │   Test   │ │  Cache   │ │ WebSocket│                  │
│  │ Service  │ │  Runner  │ │ Service  │ │ Service  │                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Ollama LLM                                     │
│  ┌────────────────────┐  ┌────────────────────┐                       │
│  │   llama3.2:3b      │  │  deepseek-coder    │                       │
│  │   (Scenarios)      │  │   (Code Gen)       │                       │
│  └────────────────────┘  └────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TARS CLI                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Analyze  │ │ Generate │ │ Onboard  │ │   Git    │ │   Status     │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
tars/
├── packages/
│   ├── api/                 # Express API server
│   │   └── src/
│   │       ├── routes/      # API endpoints
│   │       ├── services/    # Business logic
│   │       └── db/          # SQLite persistence
│   ├── web/                 # Next.js web portal
│   │   └── src/
│   │       ├── app/         # Pages (Upload, PRDs, Scenarios, Hermetic, Raptor, Telemetry)
│   │       ├── components/  # React components
│   │       └── hooks/       # Custom hooks (WebSocket)
│   ├── cli/                 # TARS CLI tool
│   │   └── src/commands/    # CLI commands
│   └── shared/              # Shared TypeScript types
├── demo-hermetic/           # Hermetic code-change example
├── demo-hermetic-mockoon/   # Hermetic Mockoon example
├── demo-raptor/             # Raptor configuration example
├── demo-tests/              # Generated test examples
├── ai-generated-tests/      # AI-generated test samples
├── setup.sh                 # One-click setup script
├── demo-start.sh            # Quick start script
├── DEPLOYMENT_GUIDE.md      # Full deployment documentation
├── HACKATHON_DEMO_SCRIPT.md # Demo walkthrough
├── COMPETITIVE_LANDSCAPE.md # Market analysis
└── README.md                # This file
```

---

## 🧪 Supported Frameworks

| Framework | Type | Status | Language |
|-----------|------|--------|----------|
| Jest | Unit/Integration | ✅ Ready | JavaScript/TypeScript |
| JUnit | Unit/Integration | ✅ Ready | Java |
| Cypress | E2E | ✅ Ready | JavaScript/TypeScript |
| Playwright | E2E | ✅ Ready | JavaScript/TypeScript |
| TestNG | Unit/Integration | 🔜 Coming | Java |
| PyTest | Unit/Integration | 🔜 Coming | Python |

---

## ⚙️ Configuration

### Environment Variables

**API Server** (`packages/api/.env`):
```bash
# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_SCENARIO_MODEL=llama3.2:3b      # For test scenario generation
OLLAMA_CODE_MODEL=deepseek-coder:6.7b   # For test code generation
OLLAMA_HERMETIC_MODEL=deepseek-coder:6.7b
OLLAMA_ANALYSIS_MODEL=deepseek-coder:6.7b

# Server Configuration
PORT=3001
NODE_ENV=development
TELEMETRY_ENABLED=true
```

**Web Portal** (`packages/web/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
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

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Complete setup guide for new machines |
| [HACKATHON_DEMO_SCRIPT.md](./HACKATHON_DEMO_SCRIPT.md) | Step-by-step demo walkthrough |
| [DEMO_QUICK_CARD.md](./DEMO_QUICK_CARD.md) | Quick reference card |
| [COMPETITIVE_LANDSCAPE.md](./COMPETITIVE_LANDSCAPE.md) | Market analysis and positioning |
| [sample-prd.md](./sample-prd.md) | Example PRD for testing |

---

## 🎬 Demo

### Demo Flow

```
1. Upload PRD          → Paste your requirements document
2. Generate Scenarios  → AI analyzes and creates test scenarios  
3. Review & Approve    → Approve scenarios for test generation
4. Generate Tests      → Run CLI to create test files
5. Hermetic Setup      → Configure isolated test environment
6. Run Tests           → Execute tests against hermetic server
```

### Quick Demo Commands

```bash
# Start the platform
./demo-start.sh

# Analyze a repository
tars analyze --path /path/to/your/repo --deep

# Generate test scenarios (via web portal or API)
curl -X POST http://localhost:3001/api/scenarios/generate \
  -H "Content-Type: application/json" \
  -d '{"prdId": "your-prd-id"}'

# Setup hermetic server
tars onboard hermetic --service-name my-service --mode code-change

# Setup Raptor recording
tars onboard raptor --service-name my-service
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

<div align="center">

**Built with ❤️ by Team Kaizen for Flipkart Hackday 13**

[⬆ Back to Top](#-tars---test-automation--review-system)

</div>
