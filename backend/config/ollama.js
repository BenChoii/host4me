/**
 * Ollama configuration for Gemma 4 models.
 * Ollama exposes an OpenAI-compatible API at /v1/ — Paperclip
 * and other tools can connect as if it were OpenAI.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Gemma 4 26B MoE — 4B active params, 256K context, native function calling
const MODEL_PRIMARY = process.env.OLLAMA_MODEL_PRIMARY || 'gemma4:26b';

// Gemma 4 E4B — lightweight, fast for routine tasks
const MODEL_FAST = process.env.OLLAMA_MODEL_FAST || 'gemma4:e4b';

const config = {
  baseUrl: OLLAMA_BASE_URL,
  openaiCompatibleUrl: `${OLLAMA_BASE_URL}/v1`,

  models: {
    // Complex reasoning: CEO agent, escalation decisions, onboarding
    primary: MODEL_PRIMARY,
    // Fast inference: guest replies, inbox polling, reporting
    fast: MODEL_FAST,
  },

  // Agent-to-model mapping
  agentModels: {
    'ceo-agent': MODEL_PRIMARY,
    'guest-comms': MODEL_FAST,
    'escalation': MODEL_PRIMARY,
    'reporting': MODEL_FAST,
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
};

module.exports = config;
