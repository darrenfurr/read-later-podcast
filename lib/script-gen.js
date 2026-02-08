/**
 * Podcast script generator for read-later-podcast
 * Generates two-host conversation scripts in the style of "How I Built This"
 */

import { execSync } from 'child_process';
import { config } from './config.js';

/**
 * Generate a podcast script from article content
 */
export async function generateScript(article) {
  console.log(`Generating script for: ${article.title}`);
  
  const targetMinutes = config.content.targetPodcastMinutes;
  const targetWords = targetMinutes * config.content.wordsPerMinute;
  
  const prompt = `You are a podcast script writer. Create a two-host podcast script based on the following article.

STYLE GUIDE:
- Inspired by Guy Raz from "How I Built This"
- HOST (Guy): Warm, curious, asks great follow-up questions, genuinely interested
- EXPERT (Sarah): Knowledgeable, shares insights and anecdotes, explains complex topics simply
- Tone: Conversational but informative, like two smart friends discussing over coffee
- Include well-timed humor (natural, not forced)
- NO filler content - every segment should add value

STRUCTURE:
1. INTRO: Hook the listener, tease what they'll learn (30 seconds)
2. CONTEXT: What is this about and why does it matter? (2 minutes)
3. DEEP DIVE: Explore the main points with examples and insights (8-10 minutes)
4. IMPLICATIONS: What does this mean for the listener? (2-3 minutes)
5. TAKEAWAYS: Key lessons and actionable insights (1-2 minutes)
6. OUTRO: Wrap up with a thought-provoking question or call to action (30 seconds)

FORMAT RULES:
- Use [HOST] and [EXPERT] tags for each speaker
- Include [PAUSE] for dramatic effect where appropriate
- Include natural verbal fillers sparingly ("you know", "I mean", "right")
- Write in spoken language, not written language
- Contractions are good ("it's" not "it is")
- Short sentences for emphasis. Like this.

TARGET LENGTH: ${targetWords} words (approximately ${targetMinutes} minutes when spoken)

ARTICLE TITLE: ${article.title}

ARTICLE CONTENT:
${article.content.slice(0, 15000)}

---

Write the complete podcast script now. Make it engaging, informative, and natural-sounding.`;

  try {
    const result = execSync(
      `${config.infshPath} app run openrouter/claude-sonnet-45 --input '${JSON.stringify({ prompt }).replace(/'/g, "'\\''")}'`,
      { 
        encoding: 'utf-8', 
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120000, // 2 minute timeout
      }
    );
    
    const response = JSON.parse(result);
    const script = response.output || response.result || response.content || '';
    
    return parseScript(script);
  } catch (error) {
    console.error('Script generation failed:', error.message);
    throw new Error(`Failed to generate script: ${error.message}`);
  }
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
    const hostMatch = trimmed.match(/^\[HOST\]:?\s*(.*)/i);
    const expertMatch = trimmed.match(/^\[EXPERT\]:?\s*(.*)/i);
    const guyMatch = trimmed.match(/^(?:GUY|HOST):\s*(.*)/i);
    const sarahMatch = trimmed.match(/^(?:SARAH|EXPERT):\s*(.*)/i);
    
    if (hostMatch || guyMatch) {
      // Save previous segment
      if (currentSpeaker && currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.join(' ').trim(),
        });
      }
      currentSpeaker = 'host';
      currentText = [(hostMatch || guyMatch)[1]];
    } else if (expertMatch || sarahMatch) {
      // Save previous segment
      if (currentSpeaker && currentText.length > 0) {
        segments.push({
          speaker: currentSpeaker,
          text: currentText.join(' ').trim(),
        });
      }
      currentSpeaker = 'expert';
      currentText = [(expertMatch || sarahMatch)[1]];
    } else if (currentSpeaker) {
      // Continue current speaker's text
      // Skip pause markers but add natural pauses
      if (!trimmed.match(/^\[PAUSE\]/i)) {
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
    .filter(seg => seg.text.length > 0)
    .map(seg => ({
      ...seg,
      text: cleanText(seg.text),
      voice: seg.speaker === 'host' ? config.voices.host : config.voices.guest,
    }));
  
  console.log(`Parsed ${cleanedSegments.length} segments`);
  
  return {
    segments: cleanedSegments,
    totalWords: cleanedSegments.reduce((sum, seg) => sum + seg.text.split(' ').length, 0),
    estimatedMinutes: Math.round(
      cleanedSegments.reduce((sum, seg) => sum + seg.text.split(' ').length, 0) / config.content.wordsPerMinute
    ),
  };
}

/**
 * Clean text for TTS
 */
function cleanText(text) {
  return text
    // Remove stage directions in brackets (except natural pauses)
    .replace(/\[(?!PAUSE)[^\]]+\]/g, '')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    // Fix common TTS issues
    .replace(/&/g, ' and ')
    .replace(/\$/g, ' dollars ')
    .replace(/%/g, ' percent ')
    .replace(/\+/g, ' plus ')
    .replace(/=/g, ' equals ')
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

/**
 * Generate intro script
 */
export function generateIntro(title) {
  return {
    speaker: 'host',
    text: `Welcome to Read Later Podcast, where we turn your saved articles into engaging conversations. Today, we're diving into: ${title}. Let's get into it.`,
    voice: config.voices.host,
  };
}

/**
 * Generate outro script
 */
export function generateOutro() {
  return {
    speaker: 'host', 
    text: `That's all for today's episode. If you enjoyed this conversation, save another article and we'll be back with more insights. Until next time, keep learning.`,
    voice: config.voices.host,
  };
}

export default {
  generateScript,
  generateIntro,
  generateOutro,
};
