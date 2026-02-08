/**
 * Text-to-speech generation for read-later-podcast
 * Uses edge-tts (Microsoft's free TTS API)
 */

import { execSync } from 'child_process';
import { readFileSync, mkdirSync, existsSync, unlinkSync, copyFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

// Voice mapping for edge-tts
const VOICES = {
  host: 'en-US-AndrewNeural',      // Male, warm, confident - like Guy Raz
  guest: 'en-US-AriaNeural',       // Female, positive, confident
  // Alternatives:
  // host: 'en-US-ChristopherNeural', // Male, authoritative
  // guest: 'en-US-EmmaNeural',       // Female, cheerful, conversational
  // guest: 'en-US-JennyNeural',      // Female, friendly, considerate
};

/**
 * Generate audio for a single segment using edge-tts
 */
export async function generateSegmentAudio(segment, outputPath) {
  const textPreview = segment.text.slice(0, 50).replace(/\n/g, ' ');
  console.log(`  TTS [${segment.speaker}]: "${textPreview}..."`);
  
  const voice = segment.speaker === 'host' ? VOICES.host : VOICES.guest;
  
  // Escape text for shell
  const escapedText = segment.text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`');
  
  try {
    execSync(
      `edge-tts --voice "${voice}" --text "${escapedText}" --write-media "${outputPath}"`,
      { 
        encoding: 'utf-8', 
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    
    // Verify file was created
    if (!existsSync(outputPath)) {
      throw new Error('Audio file not created');
    }
    
    return outputPath;
  } catch (error) {
    console.error(`TTS failed for segment:`, error.message);
    throw error;
  }
}

/**
 * Generate intro jingle (simple tone, optional)
 */
export async function generateIntroMusic(outputPath) {
  // Skip for now - can add later
  console.log('  (Skipping intro music)');
  return null;
}

/**
 * Generate outro jingle (optional)
 */
export async function generateOutroMusic(outputPath) {
  // Skip for now - can add later
  console.log('  (Skipping outro music)');
  return null;
}

/**
 * Merge all audio segments into final podcast
 */
export async function mergeAudio(segmentPaths, outputPath) {
  const validPaths = segmentPaths.filter(p => p !== null && existsSync(p));
  
  console.log(`  Merging ${validPaths.length} audio segments...`);
  
  if (validPaths.length === 0) {
    throw new Error('No audio segments to merge');
  }
  
  if (validPaths.length === 1) {
    copyFileSync(validPaths[0], outputPath);
    return outputPath;
  }
  
  // Try ffmpeg (best quality)
  try {
    const listPath = outputPath.replace(/\.[^.]+$/, '_list.txt');
    const listContent = validPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listPath, listContent);
    
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:a libmp3lame -q:a 2 "${outputPath}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 300000 }
    );
    
    unlinkSync(listPath);
    console.log('  (Merged with ffmpeg)');
    return outputPath;
  } catch (e) {
    // ffmpeg not available, use direct concatenation
  }
  
  // Direct mp3 concatenation (works but may have minor glitches at boundaries)
  console.log('  (Merging via concatenation - install ffmpeg for better quality)');
  const chunks = validPaths.map(p => readFileSync(p));
  writeFileSync(outputPath, Buffer.concat(chunks));
  
  return outputPath;
}

/**
 * Generate complete podcast from script
 */
export async function generatePodcast(script, outputDir, slug) {
  console.log('\n🎙️  Generating podcast audio...');
  console.log(`  Segments: ${script.segments.length}`);
  console.log(`  Estimated duration: ~${script.estimatedMinutes} minutes\n`);
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const tempDir = join(outputDir, `temp_${slug}`);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  
  const segmentPaths = [];
  
  try {
    // Generate audio for each segment
    for (let i = 0; i < script.segments.length; i++) {
      const segment = script.segments[i];
      const segmentPath = join(tempDir, `${String(i + 1).padStart(3, '0')}_${segment.speaker}.mp3`);
      
      await generateSegmentAudio(segment, segmentPath);
      segmentPaths.push(segmentPath);
      
      // Progress indicator
      const pct = Math.round(((i + 1) / script.segments.length) * 100);
      process.stdout.write(`\r  Progress: ${i + 1}/${script.segments.length} (${pct}%)`);
    }
    console.log('\n');
    
    // Merge all segments
    const finalPath = join(outputDir, `${slug}.mp3`);
    await mergeAudio(segmentPaths, finalPath);
    
    // Cleanup temp files
    for (const path of segmentPaths) {
      try { unlinkSync(path); } catch (e) { /* ignore */ }
    }
    try { 
      execSync(`rmdir "${tempDir}" 2>/dev/null`); 
    } catch (e) { /* ignore */ }
    
    // Get file size
    const stats = readFileSync(finalPath);
    const sizeMB = (stats.length / (1024 * 1024)).toFixed(1);
    
    console.log(`✅ Podcast generated: ${finalPath} (${sizeMB} MB)`);
    return finalPath;
    
  } catch (error) {
    console.error('\n❌ Podcast generation failed:', error.message);
    throw error;
  }
}

export default {
  generateSegmentAudio,
  generateIntroMusic,
  generateOutroMusic,
  mergeAudio,
  generatePodcast,
  VOICES,
};
