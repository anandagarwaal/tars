# 🤖 TARS - Hackathon Demo Script

## Test Automation & Review System

**Duration:** 5-7 minutes  
**Presenters:** [Your Name(s)]

---

## 📋 Pre-Demo Checklist

```bash
# 1. Start Ollama (if not running)
ollama serve &

# 2. Start the API server
cd tars/packages/api && npm run dev

# 3. Start the Web Portal
cd tars/packages/web && npm run dev

# 4. Open browser tabs:
#    - http://localhost:3000 (Web Portal)
#    - http://localhost:3000/telemetry (Metrics Dashboard)
#    - Terminal for CLI demo
```

---

## 🎬 Demo Script

### SLIDE 1: Opening Hook (30 seconds)

> **"How many of you have spent hours writing test cases from a PRD, only to realize you missed critical edge cases?"**
>
> *[Pause for effect]*
>
> **"What if AI could analyze your requirements and generate comprehensive test scenarios in seconds - not hours?"**
>
> **"Meet TARS - Test Automation & Review System."**

---

### SLIDE 2: The Problem (45 seconds)

> **"Every software team faces these challenges:"**
>
> 1. **Manual Test Creation** - Developers spend 20-30% of their time writing tests
> 2. **Coverage Gaps** - Human oversight misses edge cases and error scenarios
> 3. **Environment Complexity** - Setting up isolated test environments (Hermetic servers) takes days
> 4. **PRD to Test Disconnect** - Requirements get lost in translation to test cases
>
> **"TARS solves all of these with AI-powered automation."**

---

### SLIDE 3: The Solution (30 seconds)

> **"TARS is a complete testing platform with three pillars:"**
>
> 1. 🎯 **PRD Analysis** - AI reads your requirements and extracts testable scenarios
> 2. 🧪 **Code Generation** - Generates tests for Jest, JUnit, Cypress, and more
> 3. 🔒 **Hermetic Onboarding** - Automates isolated test environment setup
>
> **"Let me show you how it works..."**

---

### LIVE DEMO: Part 1 - Web Portal (2 minutes)

#### Action 1: Show the Landing Page
> *[Open http://localhost:3000]*
>
> **"This is the TARS web portal. Notice the modern, intuitive interface."**
>
> *[Point to Ollama status indicator]*
>
> **"Real-time connection status - our local AI model is ready."**

#### Action 2: Load Sample PRD
> *[Click "Load Sample PRD" button]*
>
> **"Let's analyze a User Authentication feature PRD."**
>
> *[Scroll through the PRD content briefly]*
>
> **"This PRD includes registration, login, password reset, and security requirements."**

#### Action 3: Generate Scenarios
> *[Click "Generate Test Scenarios" button]*
>
> **"Watch the real-time progress bar - powered by WebSocket."**
>
> *[Point to the progress indicator]*
>
> **"TARS is analyzing the PRD with our local Ollama AI model..."**
>
> *[Wait for completion]*
>
> **"In just seconds, we generated [X] comprehensive test scenarios!"**

#### Action 4: Review Generated Scenarios
> *[Scroll through the scenarios]*
>
> **"Notice how TARS identified:**
> - ✅ **Happy path tests** - successful registration, login
> - ⚠️ **Edge cases** - invalid emails, weak passwords
> - ❌ **Error scenarios** - rate limiting, expired tokens
> - 🔗 **Integration tests** - email verification, session management
>
> **"Each scenario is prioritized (high/medium/low) and tagged."**

---

### LIVE DEMO: Part 2 - Activity Feed & Telemetry (1 minute)

#### Action 5: Show Live Activity Feed
> *[Scroll down to Activity Feed component]*
>
> **"The Activity Feed shows real-time system events via WebSocket."**
>
> **"Every scenario generation, cache hit, and API call is tracked."**

#### Action 6: Show Telemetry Dashboard
> *[Navigate to http://localhost:3000/telemetry]*
>
> **"For ops teams, we have a full telemetry dashboard:"**
> - **WebSocket clients** - active connections
> - **Requests/minute** - API throughput
> - **Cache hit rate** - LLM response caching saves time and costs
> - **Average latency** - response times
>
> **"Everything is tracked for monitoring and optimization."**

---

### LIVE DEMO: Part 3 - CLI Tool (1.5 minutes)

#### Action 7: Show CLI Help
> *[Switch to terminal]*

```bash
tars --help
```

> **"TARS includes a powerful CLI for developers who prefer the terminal."**

#### Action 8: Analyze a Repository
```bash
cd /path/to/your/java-project
tars analyze
```

> **"The CLI detects your tech stack, frameworks, and test setup."**

#### Action 9: Generate Test Code
```bash
tars generate --prd <prd-id> --framework jest --output ./generated-tests
```

> **"Generate actual test code from our scenarios - ready to run!"**

#### Action 10: Show Generated Test File
```bash
cat ./generated-tests/auth.test.ts
```

> **"Real Jest test code with proper assertions, mocks, and structure."**

---

### LIVE DEMO: Part 4 - Hermetic Onboarding (45 seconds)

#### Action 11: Check Onboarding Status
```bash
tars status
```

> **"TARS can detect if your service is onboarded to Hermetic servers."**

#### Action 12: Onboard to Hermetic
```bash
tars onboard hermetic --service user-service
```

> **"One command generates all the configuration needed for isolated testing:"**
> - Database configurations (H2 in-memory)
> - Mock service dependencies
> - Test data seed scripts
> - CI/CD pipeline templates
>
> **"What used to take days now takes minutes."**

---

### SLIDE 4: Technical Highlights (45 seconds)

> **"Under the hood, TARS uses:"**
>
> 🧠 **Local AI (Ollama)** - Privacy-first, no data leaves your network
>
> ⚡ **Smart Caching** - Similar PRDs hit cache, saving 90%+ on repeated analyses
>
> 📡 **Real-time Updates** - WebSocket for live progress tracking
>
> 📊 **Full Telemetry** - Monitor usage, performance, and errors
>
> 💾 **SQLite Persistence** - All data persists across sessions
>
> 🔧 **Extensible** - Support for Jest, JUnit, TestNG, Cypress, Playwright

---

### SLIDE 5: Architecture (30 seconds)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Portal    │────▶│   TARS API      │────▶│   Ollama LLM    │
│   (Next.js)     │◀────│   (Express)     │◀────│   (Local AI)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   TARS CLI      │     │   SQLite DB     │
│   (Commander)   │     │   + Caching     │
└─────────────────┘     └─────────────────┘
```

> **"Clean monorepo architecture - API, Web, CLI, all sharing types and logic."**

---

### SLIDE 6: Impact & Future (30 seconds)

> **"With TARS, teams can:"**
>
> ⏱️ **Save 70% time** on test creation
>
> 📈 **Increase coverage** with AI-identified edge cases
>
> 🚀 **Accelerate onboarding** to hermetic test environments
>
> **"Future roadmap includes:"**
> - CI/CD integration (GitHub Actions, Jenkins)
> - Test maintenance AI (update tests when code changes)
> - Multi-language support (Python, Go)
> - Team collaboration features

---

### CLOSING (15 seconds)

> **"TARS transforms testing from a chore into an automated workflow."**
>
> **"From PRD to production-ready tests - powered by AI."**
>
> **"Thank you! Questions?"**

---

## 🎯 Demo Tips

1. **Practice the flow** - Know exactly where to click
2. **Have PRD ready** - Use the sample or prepare a real one
3. **Fallback plan** - If AI is slow, have pre-generated results
4. **Show enthusiasm** - This is cool tech, let it shine!
5. **Time yourself** - Stay within the limit

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Ollama not connected | Run `ollama serve` in background |
| API won't start | Check if port 3001 is in use: `lsof -i:3001` |
| WebSocket disconnected | Refresh the page |
| Slow generation | Mention caching: "Subsequent runs are instant" |
| No scenarios generated | Check Ollama logs, may need to pull model |

---

## 📱 Quick Commands Reference

```bash
# Start everything
cd tars && npm run dev

# Check health
curl http://localhost:3001/health | jq

# View telemetry
curl http://localhost:3001/api/telemetry/summary | jq

# CLI commands
tars analyze
tars generate --prd <id> --framework jest
tars onboard hermetic --service my-service
tars status
```

---

## 🏆 Key Talking Points

1. **"AI-powered but privacy-first"** - All processing happens locally
2. **"Real-time feedback"** - WebSocket shows progress live
3. **"Intelligent caching"** - Similar PRDs don't re-process
4. **"Framework agnostic"** - Jest, JUnit, Cypress, etc.
5. **"Production-ready"** - Full persistence, telemetry, error handling

---

**Good luck with your hackathon! 🚀**
