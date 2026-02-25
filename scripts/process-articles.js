#!/usr/bin/env node
/**
 * Process all new articles from Notion database
 */

import { config, notion, content, scriptGen, tts, uploadToGitHub } from '../lib/index.js';
import { join } from 'path';

async function processArticle(article) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${article.url}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Mark as processing
    await notion.updateStatus(article.id, 'Processing');
    
    // 1. Fetch article content
    const fetchedArticle = await content.fetchArticle(article.url);
    console.log(`Fetched: "${fetchedArticle.title}" (${fetchedArticle.wordCount} words)`);

    // Guard: skip bot-blocked / paywalled pages (e.g. Medium Cloudflare challenge)
    if (fetchedArticle.wordCount < 50) {
      const reason = `Fetch returned only ${fetchedArticle.wordCount} words — likely paywalled or bot-blocked. Mark this article as Error in Notion and add it manually or use a different URL.`;
      console.error(`⚠️  Skipping: ${reason}`);
      await notion.markError(article.id, reason);
      return { success: false, error: reason };
    }
    
    // 2. Detect category
    const category = content.detectCategory(fetchedArticle.content, fetchedArticle.title);
    console.log(`Category: ${category}`);
    
    // 3. Expand content if needed
    let finalArticle = fetchedArticle;
    if (content.needsExpansion(fetchedArticle.wordCount)) {
      console.log(`Content too short, expanding...`);
      finalArticle = await content.expandContent(
        fetchedArticle, 
        config.content.minWordsForPodcast
      );
    }
    
    // 4. Generate podcast script
    const script = await scriptGen.generateScript(finalArticle);
    console.log(`Script generated: ${script.segments.length} segments, ~${script.estimatedMinutes} minutes`);
    
    // 5. Generate podcast audio
    const date = new Date().toISOString().split('T')[0];
    const slug = finalArticle.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    
    const outputDir = join(process.cwd(), config.output.dir);
    const podcastPath = await tts.generatePodcast(script, outputDir, `${date}-${slug}`);
    
    console.log(`\n✅ Podcast created: ${podcastPath}`);
    
    // 6. Upload to GitHub for public access
    const publicUrl = await uploadToGitHub(podcastPath, slug);
    
    // 7. Update Notion with public URL
    await notion.markComplete(article.id, {
      podcastUrl: publicUrl,
      category,
      title: finalArticle.title,
    });
    
    return {
      success: true,
      path: podcastPath,
      title: finalArticle.title,
      category,
      duration: script.estimatedMinutes,
    };
    
  } catch (error) {
    console.error(`\n❌ Failed to process ${article.url}:`, error.message);
    await notion.markError(article.id, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  console.log('🎙️ Read Later Podcast - Processing Articles\n');
  
  // Check environment
  if (!config.notion.apiKey) {
    console.error('Error: NOTION_KEY not set');
    process.exit(1);
  }
  
  if (!config.notion.databaseId) {
    console.error('Error: NOTION_DATABASE_ID not set');
    console.log('Please set the database ID in your environment or config.');
    process.exit(1);
  }
  
  try {
    // Get new articles (limit to 5 per run to avoid overwhelming the system)
    const articles = await notion.getNewArticles(5);
    
    if (articles.length === 0) {
      console.log('No new articles to process.');
      return;
    }
    
    console.log(`Found ${articles.length} new article(s) to process (max 5 per run).\n`);
    
    // Process each article
    const results = [];
    for (const article of articles) {
      const result = await processArticle(article);
      results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('PROCESSING COMPLETE');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      console.log('\nGenerated podcasts:');
      for (const result of successful) {
        console.log(`  - ${result.title} (${result.duration} min)`);
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

main();
