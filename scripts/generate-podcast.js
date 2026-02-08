#!/usr/bin/env node
/**
 * Generate podcast from a single URL
 * Usage: node scripts/generate-podcast.js <url>
 */

import { config, content, scriptGen, tts } from '../lib/index.js';
import { join } from 'path';

async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: node scripts/generate-podcast.js <url>');
    process.exit(1);
  }
  
  console.log('🎙️ Read Later Podcast - Single URL Mode\n');
  console.log(`URL: ${url}\n`);
  
  try {
    // 1. Fetch article content
    console.log('📥 Fetching article...');
    const article = await content.fetchArticle(url);
    console.log(`   Title: "${article.title}"`);
    console.log(`   Words: ${article.wordCount}`);
    
    // 2. Detect category
    const category = content.detectCategory(article.content, article.title);
    console.log(`   Category: ${category}\n`);
    
    // 3. Expand content if needed
    let finalArticle = article;
    if (content.needsExpansion(article.wordCount)) {
      console.log('📝 Content too short, researching and expanding...');
      finalArticle = await content.expandContent(
        article, 
        config.content.minWordsForPodcast
      );
      console.log(`   Expanded to: ${finalArticle.wordCount} words\n`);
    }
    
    // 4. Generate podcast script
    console.log('✍️ Generating podcast script...');
    const script = await scriptGen.generateScript(finalArticle);
    console.log(`   Segments: ${script.segments.length}`);
    console.log(`   Estimated duration: ~${script.estimatedMinutes} minutes\n`);
    
    // 5. Generate podcast audio
    console.log('🎤 Generating audio (this may take a few minutes)...');
    const date = new Date().toISOString().split('T')[0];
    const slug = finalArticle.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    
    const outputDir = join(process.cwd(), config.output.dir);
    const podcastPath = await tts.generatePodcast(script, outputDir, `${date}-${slug}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PODCAST GENERATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log(`\nTitle: ${finalArticle.title}`);
    console.log(`Category: ${category}`);
    console.log(`Duration: ~${script.estimatedMinutes} minutes`);
    console.log(`Output: ${podcastPath}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
