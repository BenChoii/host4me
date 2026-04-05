# Host4Me — Architecture Overview

## What is Host4Me?

An AI-powered property management service for short-term rental (STR) hosts. Each property manager gets their own AI "company" — a team of agents that handles guest communication, escalations, and reporting 24/7.

## Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| **LLM** | Gemma 4 26B MoE via Ollama (local) | $0 |
| **Agent Orchestration** | Paperclip (open source, MIT) | $0 |
| **Browser Automation** | Browser Use + Playwright (AI vision-based) | $0 |
| **PM Communication** | Telegram Bot API | $0 |
| **Database** | PostgreSQL | $0 |
| **Queue** | Redis | $0 |
| **Server** | Express.js (Node.js) | $0 |
| **Infrastructure** | Hostinger VPS (32GB RAM, 8 vCPU) | ~$30/mo |
| **Total** | | **~$31/mo** |

## Architecture Diagram

```
VPS (Hostinger)
├── Ollama (Gemma 4 26B MoE + E4B)     → Local LLM inference
├── Paperclip (Company per PM)           → Agent orchestration
│   ├── CEO Agent (Alfred)               → PM-facing, Telegram
│   ├── Guest Comms Agent                → Message handling
│   ├── Escalation Agent                 → Safety net
│   └── Reporting Agent                  → Analytics
├── Browser Use (Python)                 → AI browser automation
│   ├── Airbnb inbox/reply tasks
│   └── VRBO inbox/reply tasks
├── Express Server                       → API gateway
│   ├── Telegram webhooks
│   ├── Onboarding API
│   └── Health monitoring
├── PostgreSQL                           → Sessions, credentials, data
├── Redis                                → Task queues
└── Nginx                                → Reverse proxy + SSL
```

## Key Design Decisions

1. **Gemma 4 26B MoE** over 31B Dense — only 4B params active = fast on CPU, 26B quality
2. **Telegram only** (no Twilio) — $0 vs $25-75/mo, richer formatting, instant delivery
3. **Browser Use** (AI vision) over Playwright selectors — self-healing when UI changes
4. **PostgreSQL sessions** over Firebase — simpler, free, no serialization bugs
5. **Multi-model strategy** — 26B for CEO/escalation, E4B for routine guest replies

## Onboarding Flow

1. Sign up → 2. Connect platforms → 3. Property setup → 4. Communication style → 5. Escalation rules → 6. Telegram bot → 7. Shadow mode → Go live

## Directory Structure

```
backend/
├── paperclip/          — Company template + agent prompts
├── browser-agents/     — Python Browser Use service
├── telegram/           — Bot manager + notifications
├── onboarding/         — Credential vault + style learner
├── config/             — Ollama config + env
└── server.js           — Express entry point

deploy/
├── docker-compose.yml  — All services
├── nginx.conf          — Reverse proxy
└── setup.sh            — VPS bootstrap
```

## New PM Onboarding (Technical)

```bash
# 1. Clone company from template
node backend/paperclip/clone-company.js \
  --name "Sunset Properties" \
  --pm "John Smith" \
  --timezone "America/Vancouver"

# 2. Assign Telegram bot
curl -X POST localhost:3000/api/onboarding/assign-bot \
  -H "Content-Type: application/json" \
  -d '{"pmId": "sunset-properties"}'

# 3. Store credentials (encrypted)
curl -X POST localhost:3000/api/onboarding/credentials \
  -H "Content-Type: application/json" \
  -d '{"pmId": "sunset-properties", "platform": "airbnb", "email": "...", "password": "..."}'

# 4. Verify connection
curl -X POST localhost:3000/api/onboarding/verify-connection \
  -H "Content-Type: application/json" \
  -d '{"pmId": "sunset-properties", "platform": "airbnb"}'

# 5. Start polling
# (happens automatically after go-live)
```
