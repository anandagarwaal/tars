# 🎯 TARS Demo Quick Reference Card

## One Command Start
```bash
./demo-start.sh
```

---

## URLs to Open
| Service | URL |
|---------|-----|
| 🌐 Web Portal | http://localhost:3000 |
| 📊 Telemetry | http://localhost:3000/telemetry |
| 📋 PRDs List | http://localhost:3000/prds |
| 🧪 Scenarios | http://localhost:3000/scenarios |

---

## Demo Flow (5 min)

### 1️⃣ Web Portal (2 min)
- Open http://localhost:3000
- Click **"Load Sample PRD"**
- Click **"Generate Test Scenarios"**
- Watch real-time progress bar
- Show generated scenarios

### 2️⃣ Telemetry (30 sec)
- Navigate to http://localhost:3000/telemetry
- Point out: Requests/min, Cache hit rate, Latency

### 3️⃣ CLI Demo (1.5 min)
```bash
# Show help
tars --help

# Analyze repo
tars analyze

# Generate tests
tars generate --prd <id> --framework jest

# Check status
tars status
```

### 4️⃣ Wrap Up (1 min)
- Key benefits: 70% time saved, better coverage, automated onboarding
- Future: CI/CD integration, multi-language support

---

## Key Talking Points

✅ **"AI-powered but privacy-first"** - Local Ollama, no data leaves network

✅ **"Real-time feedback"** - WebSocket shows live progress

✅ **"Smart caching"** - Similar PRDs hit cache instantly

✅ **"Production-ready"** - Full persistence, telemetry, error handling

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Ollama offline | `ollama serve &` |
| Port in use | `lsof -ti:3001 \| xargs kill -9` |
| Slow response | "First run downloads model, subsequent are fast" |

---

## Sample PRD (if needed)

```markdown
# User Authentication Feature

## Requirements
- User registration with email/password
- Email validation and password strength
- Login with rate limiting
- Password reset via email
- JWT session management
```

---

**Good luck! 🚀**
