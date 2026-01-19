# 🤖 TARS - Test Automation and Review System

> Transform PRDs into Test Scenarios and automate Hermetic onboarding

## Overview

TARS is an AI-powered testing platform that:
- **Generates test scenarios** from Product Requirements Documents (PRDs)
- **Creates test code** for Jest, JUnit, Cypress, and more
- **Automates Hermetic onboarding** for isolated test environments

## Quick Start

### Prerequisites
- Node.js 18+
- npm/pnpm/yarn
- Ollama (optional, for AI-powered generation)

### Installation

```bash
# Clone and install dependencies
cd tars
npm install

# Start the API server
cd packages/api
npm run dev

# In another terminal, start the web portal
cd packages/web
npm run dev

# The CLI is available globally after build
cd packages/cli
npm run build
npm link
```

### Usage

#### 1. Web Portal (http://localhost:3000)
- Upload PRD documents
- Review and approve generated test scenarios
- View dashboard with statistics

#### 2. CLI Commands

```bash
# Analyze your repository
tars analyze

# Generate tests from approved scenarios
tars generate --prd <prd-id> --framework jest

# Onboard to Hermetic server
tars onboard hermetic --service-name my-service

# Check onboarding status
tars status
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Portal (Next.js)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PRD Upload  │  │  Scenarios  │  │     Dashboard       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core API (Express)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PRD Routes  │  │  Scenarios  │  │   Ollama Service    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     TARS CLI                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Analyze   │  │   Generate  │  │     Onboard         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
tars/
├── packages/
│   ├── web/          # Next.js web portal
│   ├── api/          # Express API server
│   ├── cli/          # TARS CLI tool
│   └── shared/       # Shared types
├── package.json      # Monorepo root
└── README.md
```

## Demo Flow

1. **Upload PRD** → Paste your requirements document
2. **Generate Scenarios** → AI analyzes and creates test scenarios
3. **Review & Approve** → Approve scenarios for test generation
4. **Generate Tests** → Run CLI to create test files
5. **Hermetic Onboarding** → Setup isolated test environment

## Frameworks Supported

| Framework | Type | Status |
|-----------|------|--------|
| Jest | Unit/Integration | ✅ |
| JUnit | Unit/Integration | ✅ |
| Cypress | E2E | ✅ |
| TestNG | Unit/Integration | 🔜 |
| Playwright | E2E | 🔜 |

## Hermetic Server Features

- **SeedEntities API** - Seed test data
- **Reset Data API** - Reset to base state
- **Sample Data API** - Get sample payloads
- **In-memory DB** - H2/SQLite support
- **Docker support** - Containerized hermetic server

## Environment Variables

```bash
# API
PORT=3001
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Web
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT

---

Built with ❤️ for hackathon by TARS team
