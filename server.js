#!/usr/bin/env node
/**
 * Webhook server for read-later-podcast
 * Receives notifications from Notion and triggers podcast generation
 */

import express from 'express';
import { config, notion, content, scriptGen, tts } from './lib/index.js';
import { uploadToGitHub } from './lib/github-upload.js';
import { join } from 'path';

const app = express();
app.use(express.json());

const PORT = process.env.PODCAST_PORT || 3456;
const WEBHOOK_SECRET = process.env.PODCAST_WEBHOOK_SECRET || 'podcast-secret-key';

// Track processing to avoid duplicates
const processing = new Set();

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'read-later-podcast' });
});

/**
 * Status endpoint
 */
app.get('/status', async (req, res) => {
  try {
    const stats = await notion.getDatabaseStats();
    res.json({ status: 'ok', ...stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Webhook endpoint for Notion
 * Can be triggered by Notion automations or Zapier/Make
 */
app.post('/webhook', async (req, res) => {
  // Verify secret (simple auth)
  const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
  if (authHeader !== WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('📨 Webhook received:', JSON.stringify(req.body).slice(0, 200));
  
  // Respond immediately, process async
  res.json({ status: 'accepted', message: 'Processing started' });
  
  // Process in background
  processNewArticles().catch(err => {
    console.error('Background processing error:', err);
  });
});

/**
 * Manual trigger endpoint
 */
app.post('/process', async (req, res) => {
  const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
  if (authHeader !== WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const results = await processNewArticles();
    res.json({ status: 'ok', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process a specific URL (direct trigger)
 */
app.post('/generate', async (req, res) => {
  const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
  if (authHeader !== WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }
  
  res.json({ status: 'accepted', message: `Processing ${url}` });
  
  // Process in background
  processUrl(url).catch(err => {
    console.error('URL processing error:', err);
  });
});

/**
 * Process all new articles from Notion
 */
async function processNewArticles() {
  const articles = await notion.getNewArticles();
  console.log(`Found ${articles.length} new articles`);
  
  const results = [];
  
  for (const article of articles) {
    if (processing.has(article.id)) {
      console.log(`Skipping ${article.id} - already processing`);
      continue;
    }
    
    try {
      processing.add(article.id);
      const result = await processArticle(article);
      results.push(result);
    } finally {
      processing.delete(article.id);
    }
  }
  
  return results;
}

/**
 * Process a single article
 */
async function processArticle(article) {
  console.log(`\n🎙️ Processing: ${article.url}`);
  
  try {
    await notion.updateStatus(article.id, 'Processing');
    
    // Fetch article
    const fetchedArticle = await content.fetchArticle(article.url);
    console.log(`  Fetched: "${fetchedArticle.title}" (${fetchedArticle.wordCount} words)`);
    
    // Detect category
    const category = content.detectCategory(fetchedArticle.content, fetchedArticle.title);
    
    // Expand if needed
    let finalArticle = fetchedArticle;
    if (content.needsExpansion(fetchedArticle.wordCount)) {
      finalArticle = await content.expandContent(fetchedArticle, config.content.minWordsForPodcast);
    }
    
    // Generate script
    const script = await scriptGen.generateScript(finalArticle);
    console.log(`  Script: ${script.segments.length} segments, ~${script.estimatedMinutes} min`);
    
    // Generate podcast
    const date = new Date().toISOString().split('T')[0];
    const slug = finalArticle.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    
    const outputDir = join(process.cwd(), config.output.dir);
    const podcastPath = await tts.generatePodcast(script, outputDir, `${date}-${slug}`);
    
    // Upload to GitHub
    let podcastUrl = podcastPath;
    try {
      podcastUrl = await uploadToGitHub(podcastPath);
    } catch (uploadErr) {
      console.warn(`  ⚠️ GitHub upload failed: ${uploadErr.message}`);
      console.warn(`  Using local path: ${podcastPath}`);
    }
    
    // Update Notion
    await notion.markComplete(article.id, {
      podcastUrl,
      category,
      title: finalArticle.title,
    });
    
    console.log(`✅ Complete: ${finalArticle.title}`);
    
    return {
      success: true,
      title: finalArticle.title,
      url: podcastUrl,
      duration: script.estimatedMinutes,
    };
    
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    await notion.markError(article.id, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Process a URL directly (not from Notion)
 */
async function processUrl(url) {
  console.log(`\n🎙️ Direct processing: ${url}`);
  
  const article = await content.fetchArticle(url);
  const category = content.detectCategory(article.content, article.title);
  
  let finalArticle = article;
  if (content.needsExpansion(article.wordCount)) {
    finalArticle = await content.expandContent(article, config.content.minWordsForPodcast);
  }
  
  const script = await scriptGen.generateScript(finalArticle);
  
  const date = new Date().toISOString().split('T')[0];
  const slug = finalArticle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
  
  const outputDir = join(process.cwd(), config.output.dir);
  const podcastPath = await tts.generatePodcast(script, outputDir, `${date}-${slug}`);
  
  try {
    const podcastUrl = await uploadToGitHub(podcastPath);
    console.log(`✅ Complete: ${podcastUrl}`);
    return podcastUrl;
  } catch (err) {
    console.log(`✅ Complete (local): ${podcastPath}`);
    return podcastPath;
  }
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🎙️ Read Later Podcast Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Port:     ${PORT}
  Webhook:  POST /webhook
  Process:  POST /process  
  Generate: POST /generate
  Status:   GET /status
  Health:   GET /health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

export default app;
