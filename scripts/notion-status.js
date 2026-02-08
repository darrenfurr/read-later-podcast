#!/usr/bin/env node
/**
 * Check Notion database status
 */

import { config, notion } from '../lib/index.js';

async function main() {
  console.log('🎙️ Read Later Podcast - Notion Status\n');
  
  if (!config.notion.apiKey) {
    console.error('Error: NOTION_API_KEY not set');
    process.exit(1);
  }
  
  if (!config.notion.databaseId) {
    console.error('Error: NOTION_DATABASE_ID not set');
    process.exit(1);
  }
  
  try {
    const stats = await notion.getDatabaseStats();
    
    console.log('Database Status:');
    console.log('─'.repeat(30));
    console.log(`  📥 New:        ${stats.new}`);
    console.log(`  ⏳ Processing: ${stats.processing}`);
    console.log(`  ✅ Complete:   ${stats.complete}`);
    console.log(`  ❌ Errors:     ${stats.errors}`);
    console.log('─'.repeat(30));
    console.log(`  📊 Total:      ${stats.total}`);
    
    if (stats.new > 0) {
      console.log('\nNew articles waiting:');
      const articles = await notion.getNewArticles();
      for (const article of articles) {
        console.log(`  - ${article.url}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
