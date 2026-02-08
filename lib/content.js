/**
 * Content fetching and expansion for read-later-podcast
 */

import { execSync } from 'child_process';
import { config } from './config.js';

/**
 * Fetch article content from URL
 * Uses OpenClaw's web_fetch capability via curl to gateway
 */
export async function fetchArticle(url) {
  console.log(`Fetching article: ${url}`);
  
  try {
    // Use fetch directly for the URL, then extract readable content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ReadLaterPodcast/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract readable content (basic extraction)
    const content = extractReadableContent(html);
    const title = extractTitle(html);
    
    return {
      url,
      title,
      content,
      wordCount: countWords(content),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    throw error;
  }
}

/**
 * Extract readable content from HTML
 */
function extractReadableContent(html) {
  // Remove scripts, styles, and HTML tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  
  return text;
}

/**
 * Extract title from HTML
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  return 'Untitled Article';
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Determine if content needs expansion
 */
export function needsExpansion(wordCount) {
  return wordCount < config.content.minWordsForPodcast;
}

/**
 * Research and expand content on a topic
 * Uses Claude to generate supplementary content based on the topic
 */
export async function expandContent(article, targetWords) {
  console.log(`Expanding content: ${article.title} (${article.wordCount} → ${targetWords} words)`);
  
  const neededWords = targetWords - article.wordCount;
  
  // Use infsh to call Claude for research
  const prompt = `You are a research assistant. Based on this article excerpt, provide additional context, recent developments, and interesting facts that would enhance a podcast discussion.

Article Title: ${article.title}
Article Excerpt (first 1000 words):
${article.content.slice(0, 5000)}

Provide approximately ${neededWords} words of supplementary content including:
1. Recent developments in this topic (as of early 2026)
2. Key statistics or data points
3. Expert opinions or quotes (attributed)
4. Related trends or implications
5. Interesting anecdotes or examples

Format as clear paragraphs that can be naturally incorporated into a podcast discussion.`;

  try {
    const result = execSync(
      `${config.infshPath} app run openrouter/claude-sonnet-45 --input '${JSON.stringify({ prompt })}'`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    
    const response = JSON.parse(result);
    const supplementary = response.output || response.result || '';
    
    return {
      ...article,
      content: article.content + '\n\n--- Additional Research ---\n\n' + supplementary,
      wordCount: countWords(article.content) + countWords(supplementary),
      expanded: true,
    };
  } catch (error) {
    console.warn('Content expansion failed, proceeding with original content:', error.message);
    return { ...article, expanded: false };
  }
}

/**
 * Detect category from content
 */
export function detectCategory(content, title) {
  const text = (title + ' ' + content).toLowerCase();
  
  const categoryKeywords = {
    'AI': ['artificial intelligence', 'machine learning', 'neural network', 'gpt', 'llm', 'chatgpt', 'claude', 'deep learning'],
    'Technology': ['software', 'hardware', 'tech', 'startup', 'silicon valley', 'programming', 'developer', 'code'],
    'Finance': ['investing', 'stock', 'market', 'finance', 'money', 'wealth', 'portfolio', 'crypto', 'bitcoin', 'economy'],
    'Parenting': ['parent', 'child', 'kid', 'family', 'baby', 'toddler', 'teenager', 'raising'],
    'Self Improvement': ['productivity', 'habit', 'self-help', 'motivation', 'mindset', 'success', 'goal', 'personal development'],
    'Science': ['research', 'study', 'scientist', 'experiment', 'discovery', 'physics', 'biology', 'chemistry'],
    'Health': ['health', 'medical', 'doctor', 'wellness', 'fitness', 'exercise', 'diet', 'mental health'],
    'Business': ['business', 'entrepreneur', 'company', 'ceo', 'founder', 'strategy', 'management', 'leadership'],
    'Programming': ['javascript', 'python', 'react', 'api', 'database', 'github', 'coding', 'typescript'],
    'Culture': ['culture', 'art', 'music', 'film', 'book', 'entertainment', 'creative'],
  };
  
  let bestCategory = 'Technology'; // default
  let bestScore = 0;
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

export default {
  fetchArticle,
  needsExpansion,
  expandContent,
  detectCategory,
};
