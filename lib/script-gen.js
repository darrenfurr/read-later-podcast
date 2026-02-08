/**
 * Podcast script generator for read-later-podcast
 * Generates two-host conversation scripts in the style of "How I Built This"
 */

import { config } from './config.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Use Haiku for cost-effectiveness
const MODEL = 'anthropic/claude-3.5-haiku';

/**
 * Call Claude via OpenRouter API
 */
async function callClaude(prompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://github.com/darrenfurr/read-later-podcast',
      'X-Title': 'Read Later Podcast',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`OpenRouter API error: ${response.status}`);
    console.error(`Response: ${error}`);
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    console.error('No content in API response:', JSON.stringify(data, null, 2));
    throw new Error('OpenRouter returned empty content');
  }
  
  return content;
}

/**
 * Generate a podcast script from article content
 */
export async function generateScript(article) {
  console.log(`Generating script for: ${article.title}`);
  
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }
  
  const targetMinutes = config.content.targetPodcastMinutes;
  const targetWords = targetMinutes * config.content.wordsPerMinute;
  
  const prompt = `You are a podcast script writer. Create a two-host podcast script based on the following article.

STYLE GUIDE:
- Inspired by Guy Raz from "How I Built This"
- HOST: Warm, curious, asks great follow-up questions, genuinely interested
- EXPERT: Knowledgeable, shares insights and anecdotes, explains complex topics simply
- Tone: Conversational but informative, like two smart friends discussing over coffee
- Include well-timed humor (natural, not forced)
- NO filler content - every segment should add value

STRUCTURE:
1. INTRO: Hook the listener, introduce themselves ONCE by name (Andrew & Emily), tease what they'll learn (30 seconds)
2. CONTEXT: What is this about and why does it matter? (2 minutes)
3. DEEP DIVE: Explore the main points with examples and insights (8-10 minutes)
4. IMPLICATIONS: What does this mean for the listener? (2-3 minutes)
5. TAKEAWAYS: Key lessons and actionable insights (1-2 minutes)
6. OUTRO: Wrap up with a thought-provoking question or call to action (30 seconds)

FORMAT RULES:
- Use [HOST] and [EXPERT] tags ONLY - do NOT repeat names in the dialogue
- Speakers introduce themselves in the first segment only
- After intro, just use [HOST] and [EXPERT] tags without names
- Write in spoken language, not written language
- Contractions are good ("it's" not "it is")
- Short sentences for emphasis. Like this.
- Natural back-and-forth dialogue
- NO stage directions in dialogue - do not write "(laughing)", "(chuckling)", etc. Just write natural dialogue

TARGET LENGTH: ${targetWords} words (approximately ${targetMinutes} minutes when spoken)

ARTICLE TITLE: ${article.title}

ARTICLE CONTENT (summary):
${article.content.slice(0, 4000)}

---

Write the complete podcast script now. Make it engaging, informative, and natural-sounding.`;

  const script = await callClaude(prompt);
  return parseScript(script);
}

/**
 * Parse script into segments by speaker
 */
function parseScript(rawScript) {
  const segments = [];
  const lines = rawScript.split('\n');
  
  let currentSpeaker = null;
  let currentText = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for speaker tags
    const hostMatch = trimmed.match(/^\[HOST\]:?\s*(.*)/i) || 
                      trimmed.match(/^HOST:\s*(.*)/i) ||
                      trimmed.match(/^ANDREW:\s*(.*)/i);
    const expertMatch = trimmed.match(/^\[EXPERT\]:?\s*(.*)/i) || 
                        trimmed.match(/^EXPERT:\s*(.*)/i) ||
                        trimmed.match(/^AVA:\s*(.*)/i);
    
    if (hostMatch) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.join(' ').trim(),
        });
      }
      currentSpeaker = 'host';
      // Strip out any name prefixes (Andrew:, etc.)
      let text = hostMatch[1].replace(/^(Andrew|Host):\s*/i, '').trim();
      currentText = [text];
    } else if (expertMatch) {
      if (currentSpeaker && currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.join(' ').trim(),
        });
      }
      currentSpeaker = 'expert';
      // Strip out any name prefixes (Ava:, Aria:, Emily:, etc.)
      let text = expertMatch[1].replace(/^(Ava|Aria|Emily|Expert):\s*/i, '').trim();
      currentText = [text];
    } else if (currentSpeaker) {
      // Skip stage directions
      if (!trimmed.match(/^\[.*\]$/)) {
        currentText.push(trimmed);
      }
    }
  }
  
  // Don't forget the last segment
  if (currentSpeaker && currentText.length > 0) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.join(' ').trim(),
    });
  }
  
  // Clean up segments
  const cleanedSegments = segments
    .filter(seg => seg.text.length > 10)
    .map(seg => ({
      ...seg,
      text: cleanText(seg.text),
    }));
  
  const totalWords = cleanedSegments.reduce((sum, seg) => 
    sum + seg.text.split(' ').length, 0);
  
  console.log(`  Parsed ${cleanedSegments.length} segments, ${totalWords} words`);
  
  return {
    segments: cleanedSegments,
    totalWords,
    estimatedMinutes: Math.round(totalWords / config.content.wordsPerMinute),
  };
}

/**
 * Clean text for TTS
 */
function cleanText(text) {
  return text
    .replace(/\[(?!PAUSE)[^\]]+\]/g, '')  // Remove bracketed stage directions
    .replace(/\((?:laughing|chuckling|sighing|pausing|smiling|nodding|etc)\)/gi, '')  // Remove parenthetical stage directions
    .replace(/\b(?:laughing|chuckling|sighing)\b(?:\s+)?/gi, '')  // Remove standalone stage direction words
    .replace(/\s+/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\$/g, ' dollars ')
    .replace(/%/g, ' percent ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

export default {
  generateScript,
};
