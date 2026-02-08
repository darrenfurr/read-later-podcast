/**
 * Text-to-speech generation for read-later-podcast
 * Uses inference.sh Kokoro TTS
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

/**
 * Generate audio for a single segment
 */
export async function generateSegmentAudio(segment, outputPath) {
  console.log(`Generating audio: ${segment.speaker} (${segment.text.slice(0, 50)}...)`);
  
  const input = {
    text: segment.text,
    voice: segment.voice,
  };
  
  try {
    const result = execSync(
      `${config.infshPath} app run infsh/kokoro-tts --input '${JSON.stringify(input).replace(/'/g, "'\\''")}'`,
      { 
        encoding: 'utf-8', 
        maxBuffer: 50 * 1024 * 1024, // 50MB for audio
        timeout: 300000, // 5 minute timeout per segment
      }
    );
    
    const response = JSON.parse(result);
    
    // Get audio URL from response
    const audioUrl = response.output?.url || response.result?.url || response.url;
    
    if (!audioUrl) {
      throw new Error('No audio URL in response');
    }
    
    // Download audio file
    await downloadFile(audioUrl, outputPath);
    
    return outputPath;
  } catch (error) {
    console.error(`TTS generation failed for segment:`, error.message);
    throw error;
  }
}

/**
 * Download file from URL
 */
async function downloadFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(buffer));
}

/**
 * Generate intro music
 */
export async function generateIntroMusic(outputPath) {
  console.log('Generating intro music...');
  
  const input = {
    prompt: 'Podcast intro music, warm and inviting, modern, thoughtful, 10 seconds, fade in',
  };
  
  try {
    const result = execSync(
      `${config.infshPath} app run infsh/ai-music --input '${JSON.stringify(input)}'`,
      { 
        encoding: 'utf-8', 
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120000,
      }
    );
    
    const response = JSON.parse(result);
    const audioUrl = response.output?.url || response.result?.url || response.url;
    
    if (audioUrl) {
      await downloadFile(audioUrl, outputPath);
      return outputPath;
    }
  } catch (error) {
    console.warn('Intro music generation failed, skipping:', error.message);
  }
  
  return null;
}

/**
 * Generate outro music
 */
export async function generateOutroMusic(outputPath) {
  console.log('Generating outro music...');
  
  const input = {
    prompt: 'Podcast outro music, matching warm thoughtful style, fade out, 8 seconds',
  };
  
  try {
    const result = execSync(
      `${config.infshPath} app run infsh/ai-music --input '${JSON.stringify(input)}'`,
      { 
        encoding: 'utf-8', 
        maxBuffer: 50 * 1024 * 1024,
        timeout: 120000,
      }
    );
    
    const response = JSON.parse(result);
    const audioUrl = response.output?.url || response.result?.url || response.url;
    
    if (audioUrl) {
      await downloadFile(audioUrl, outputPath);
      return outputPath;
    }
  } catch (error) {
    console.warn('Outro music generation failed, skipping:', error.message);
  }
  
  return null;
}

/**
 * Merge all audio segments into final podcast
 * Uses sox if available, otherwise concatenates files directly
 */
export async function mergeAudio(segmentPaths, outputPath) {
  console.log(`Merging ${segmentPaths.length} audio segments...`);
  
  // Filter out null paths
  const validPaths = segmentPaths.filter(p => p !== null);
  
  if (validPaths.length === 0) {
    throw new Error('No audio segments to merge');
  }
  
  // If only one segment, just copy it
  if (validPaths.length === 1) {
    execSync(`cp "${validPaths[0]}" "${outputPath}"`);
    return outputPath;
  }
  
  // Try different merge methods
  
  // Method 1: Try ffmpeg
  try {
    const listPath = outputPath.replace(/\.[^.]+$/, '_list.txt');
    const listContent = validPaths.map(p => `file '${p}'`).join('\n');
    writeFileSync(listPath, listContent);
    
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:a libmp3lame -q:a 2 "${outputPath}"`,
      { encoding: 'utf-8', timeout: 300000 }
    );
    
    unlinkSync(listPath);
    return outputPath;
  } catch (e) {
    console.log('ffmpeg not available, trying sox...');
  }
  
  // Method 2: Try sox
  try {
    execSync(
      `sox ${validPaths.map(p => `"${p}"`).join(' ')} "${outputPath}"`,
      { encoding: 'utf-8', timeout: 300000 }
    );
    return outputPath;
  } catch (e) {
    console.log('sox not available, trying direct concat...');
  }
  
  // Method 3: Direct file concatenation (works for mp3)
  try {
    const { createWriteStream, createReadStream } = await import('fs');
    const output = createWriteStream(outputPath);
    
    for (const path of validPaths) {
      const data = await import('fs').then(fs => fs.readFileSync(path));
      output.write(data);
    }
    
    output.end();
    
    // Wait for write to complete
    await new Promise((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
    
    return outputPath;
  } catch (e) {
    throw new Error(`Failed to merge audio files: ${e.message}`);
  }
}

/**
 * Generate complete podcast from script
 */
export async function generatePodcast(script, outputDir, slug) {
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const tempDir = join(outputDir, `temp_${slug}`);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  
  const segmentPaths = [];
  
  try {
    // Generate intro music if enabled
    if (config.audio.introOutroEnabled) {
      const introPath = join(tempDir, '00_intro.mp3');
      const intro = await generateIntroMusic(introPath);
      if (intro) segmentPaths.push(intro);
    }
    
    // Generate audio for each segment
    for (let i = 0; i < script.segments.length; i++) {
      const segment = script.segments[i];
      const segmentPath = join(tempDir, `${String(i + 1).padStart(2, '0')}_${segment.speaker}.mp3`);
      
      await generateSegmentAudio(segment, segmentPath);
      segmentPaths.push(segmentPath);
      
      // Progress update
      console.log(`Progress: ${i + 1}/${script.segments.length} segments`);
    }
    
    // Generate outro music if enabled
    if (config.audio.introOutroEnabled) {
      const outroPath = join(tempDir, '99_outro.mp3');
      const outro = await generateOutroMusic(outroPath);
      if (outro) segmentPaths.push(outro);
    }
    
    // Merge all segments
    const finalPath = join(outputDir, `${slug}.mp3`);
    await mergeAudio(segmentPaths, finalPath);
    
    // Cleanup temp files
    for (const path of segmentPaths) {
      try {
        unlinkSync(path);
      } catch (e) { /* ignore */ }
    }
    try {
      execSync(`rmdir "${tempDir}"`);
    } catch (e) { /* ignore */ }
    
    console.log(`Podcast generated: ${finalPath}`);
    
    return finalPath;
  } catch (error) {
    console.error('Podcast generation failed:', error.message);
    throw error;
  }
}

export default {
  generateSegmentAudio,
  generateIntroMusic,
  generateOutroMusic,
  mergeAudio,
  generatePodcast,
};
