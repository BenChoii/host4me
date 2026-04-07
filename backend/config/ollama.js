/**
 * Ollama configuration for Gemma 4 models.
 *
 * CPU-optimized setup using Gemma 4's efficient models:
 * - E4B: PLE architecture, ~4B active params, ~3GB RAM, great quality/speed on CPU
 * - E2B: Ultra-light, ~2.3B active params, <1.5GB RAM, for simple/fast tasks
 *
 * Ollama exposes an OpenAI-compatible API at /v1/
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Gemma 4 E4B — best quality that runs well on CPU (~3GB RAM)
const MODEL_PRIMARY = process.env.OLLAMA_MODEL_PRIMARY || 'gemma4:e4b';

// Gemma 4 E2B — ultra-fast for simple tasks (<1.5GB RAM)
const MODEL_FAST = process.env.OLLAMA_MODEL_FAST || 'gemma4:e2b';

const config = {
  baseUrl: OLLAMA_BASE_URL,
  openaiCompatibleUrl: `${OLLAMA_BASE_URL}/v1`,

  models: {
    // Complex reasoning: Alfred CEO, escalation decisions, onboarding, profile optimization
    primary: MODEL_PRIMARY,
    // Fast inference: guest replies, inbox triage, simple queries
    fast: MODEL_FAST,
  },

  // Agent-to-model mapping — 6 agents
  agentModels: {
    'alfred':          MODEL_PRIMARY,   // CEO — orchestration, complex decisions
    'guest-comms':     MODEL_PRIMARY,   // Guest messaging — needs quality for tone matching
    'escalation':      MODEL_PRIMARY,   // Emergencies — accuracy matters
    'reporting':       MODEL_FAST,      // Analytics — structured output, less creativity needed
    'market-research': MODEL_PRIMARY,   // Pricing analysis — needs reasoning
    'profile-optimizer': MODEL_PRIMARY, // Listing rewrites — needs quality writing
  },

  // Default generation parameters
  defaults: {
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.9,
  },

  // Guest communication — lower temperature for consistent tone
  guestComms: {
    temperature: 0.4,
    max_tokens: 1024,
    top_p: 0.85,
  },

  // Escalation — deterministic decisions
  escalation: {
    temperature: 0.1,
    max_tokens: 512,
    top_p: 0.9,
  },

  // Market research — structured analysis
  marketResearch: {
    temperature: 0.3,
    max_tokens: 2048,
    top_p: 0.9,
  },

  // Profile optimization — creative but controlled
  profileOptimizer: {
    temperature: 0.6,
    max_tokens: 2048,
    top_p: 0.9,
  },
};

module.exports = config;
