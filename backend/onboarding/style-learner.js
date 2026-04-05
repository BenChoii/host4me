/**
 * Style Learner — Analyzes PM's past conversations to learn their communication tone.
 *
 * Supports three input methods:
 * 1. Upload past conversations (CSV or text)
 * 2. Choose a preset style
 * 3. Write sample replies
 */

const ollamaConfig = require('../config/ollama');

const STYLE_PRESETS = {
  professional: {
    description: 'Formal, business-like, courteous',
    keywords: ['formal', 'courteous', 'business-like', 'respectful'],
    example:
      'Thank you for your inquiry. Check-in is at 3:00 PM, and I will send you detailed instructions the day before your arrival. Please do not hesitate to reach out if you have any additional questions.',
  },
  friendly: {
    description: 'Warm, welcoming, conversational',
    keywords: ['warm', 'welcoming', 'conversational', 'approachable'],
    example:
      "Hey there! So excited to host you! Check-in is at 3 PM and I'll shoot you all the details the day before. Let me know if you need anything at all!",
  },
  casual: {
    description: 'Relaxed, brief, down-to-earth',
    keywords: ['relaxed', 'brief', 'casual', 'chill'],
    example:
      "Hey! Check-in's at 3. I'll send you the details before you arrive. Hit me up if you need anything 👍",
  },
  luxury: {
    description: 'Elevated, personalized, concierge-level',
    keywords: ['elevated', 'refined', 'personalized', 'concierge'],
    example:
      'Welcome, and thank you for choosing our property for your stay. Check-in begins at 3:00 PM, and our concierge guide with personalized recommendations will be sent to you prior to arrival. We are at your service for anything you may need.',
  },
};

/**
 * Analyze sample conversations to extract the PM's communication style.
 * Uses Gemma 4 to identify tone, vocabulary, and patterns.
 */
async function analyzeStyle(conversations) {
  const prompt = `
Analyze these property manager guest conversations and extract the communication style.

Conversations:
${conversations}

Return a JSON object with:
{
  "tone": "one word describing the overall tone",
  "formality": "formal|semi-formal|casual",
  "greeting_style": "how they typically start messages",
  "sign_off_style": "how they typically end messages",
  "emoji_usage": "none|minimal|moderate|heavy",
  "avg_message_length": "short|medium|long",
  "vocabulary_level": "simple|moderate|sophisticated",
  "key_phrases": ["phrases they commonly use"],
  "personality_traits": ["warm", "professional", etc.],
  "response_pattern": "description of how they structure replies"
}
`;

  const response = await fetch(`${ollamaConfig.openaiCompatibleUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaConfig.models.primary,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

/**
 * Generate a style guide from analyzed style or preset.
 */
function generateStyleGuide(styleData, preset = null) {
  if (preset && STYLE_PRESETS[preset]) {
    return {
      preset,
      ...STYLE_PRESETS[preset],
      customOverrides: styleData || {},
    };
  }

  return {
    preset: 'custom',
    description: `${styleData.tone}, ${styleData.formality} communication style`,
    keywords: styleData.personality_traits || [],
    greeting: styleData.greeting_style || 'Hi',
    signOff: styleData.sign_off_style || 'Best',
    emojiUsage: styleData.emoji_usage || 'minimal',
    messageLength: styleData.avg_message_length || 'medium',
    keyPhrases: styleData.key_phrases || [],
    responsePattern: styleData.response_pattern || '',
  };
}

module.exports = {
  STYLE_PRESETS,
  analyzeStyle,
  generateStyleGuide,
};
