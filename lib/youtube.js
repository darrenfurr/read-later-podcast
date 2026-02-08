/**
 * YouTube transcript extraction for read-later-podcast
 * Uses yt-dlp for reliable subtitle extraction
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const MAX_TRANSCRIPT_WORDS = 20000;

/**
 * Check if URL is a YouTube link
 */
export function isYouTubeUrl(url) {
  if (!url) return false;
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=/,
    /^https?:\/\/youtu\.be\//,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\//,
    /^https?:\/\/(www\.)?youtube\.com\/embed\//,
    /^https?:\/\/m\.youtube\.com\/watch\?v=/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Parse VTT subtitle file to plain text
 */
function parseVttToText(vttContent) {
  const lines = vttContent.split('\n');
  const textLines = [];
  let lastText = '';
  
  for (const line of lines) {
    // Skip headers, timestamps, and empty lines
    if (line.startsWith('WEBVTT') || 
        line.startsWith('Kind:') || 
        line.startsWith('Language:') ||
        line.includes('-->') ||
        line.trim() === '') {
      continue;
    }
    
    // Clean up the text
    let text = line
      .replace(/<[^>]+>/g, '')  // Remove VTT tags
      .replace(/&nbsp;/g, ' ')
      .trim();
    
    // Skip duplicates (VTT often has progressive lines)
    if (text && text !== lastText && !lastText.includes(text)) {
      textLines.push(text);
      lastText = text;
    }
  }
  
  return textLines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch video metadata using yt-dlp
 */
function fetchVideoMetadata(videoId) {
  try {
    const result = execSync(
      `yt-dlp --dump-json --skip-download "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
    );
    const data = JSON.parse(result);
    return {
      title: data.title || 'YouTube Video',
      author: data.uploader || data.channel || 'Unknown',
      duration: data.duration || 0,
      description: data.description || '',
    };
  } catch (error) {
    return { title: 'YouTube Video', author: 'Unknown', duration: 0, description: '' };
  }
}

/**
 * Fetch transcript from YouTube video using yt-dlp
 * @param {string} url - YouTube URL
 * @returns {Object} Article-like object with content
 */
export async function fetchYouTubeTranscript(url) {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error('Could not extract video ID from URL');
  }
  
  console.log(`  Fetching YouTube transcript: ${videoId}`);
  
  // Create temp file path
  const tempBase = join(tmpdir(), `yt_${videoId}_${Date.now()}`);
  const vttPath = `${tempBase}.en.vtt`;
  
  try {
    // Download subtitles using yt-dlp
    execSync(
      `yt-dlp --write-auto-sub --sub-lang en --skip-download -o "${tempBase}" "https://www.youtube.com/watch?v=${videoId}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 60000 }
    );
    
    // Check for subtitle file (might be .en.vtt or just .vtt)
    let subtitlePath = vttPath;
    if (!existsSync(subtitlePath)) {
      subtitlePath = `${tempBase}.vtt`;
    }
    if (!existsSync(subtitlePath)) {
      // Try listing what files were created
      const files = execSync(`ls -la ${tempBase}* 2>/dev/null || echo "none"`, { encoding: 'utf-8' });
      throw new Error(`No subtitles available for this video. Files: ${files}`);
    }
    
    // Read and parse subtitles
    const vttContent = readFileSync(subtitlePath, 'utf-8');
    const transcript = parseVttToText(vttContent);
    
    // Cleanup temp file
    try { unlinkSync(subtitlePath); } catch (e) { /* ignore */ }
    
    if (!transcript || transcript.length < 50) {
      throw new Error('Transcript too short or empty');
    }
    
    // Get video metadata
    const metadata = fetchVideoMetadata(videoId);
    const durationMinutes = Math.round(metadata.duration / 60);
    
    // Count words and truncate if needed
    let finalTranscript = transcript;
    const wordCount = transcript.split(/\s+/).length;
    
    if (wordCount > MAX_TRANSCRIPT_WORDS) {
      console.log(`  Truncating transcript from ${wordCount} to ${MAX_TRANSCRIPT_WORDS} words`);
      const words = transcript.split(/\s+/);
      finalTranscript = words.slice(0, MAX_TRANSCRIPT_WORDS).join(' ');
    }
    
    // Format content with context
    const content = `
Video Title: ${metadata.title}
Creator: ${metadata.author}
Duration: ${durationMinutes} minutes
Source: YouTube

--- Video Description ---
${metadata.description.slice(0, 500)}

--- Transcript ---

${finalTranscript}
`.trim();

    console.log(`  ✓ Transcript extracted: ${content.split(/\s+/).length} words`);

    return {
      url,
      title: metadata.title,
      author: metadata.author,
      content,
      wordCount: content.split(/\s+/).length,
      fetchedAt: new Date().toISOString(),
      isYouTube: true,
      videoDuration: durationMinutes,
    };
    
  } catch (error) {
    // Cleanup on error
    try { unlinkSync(vttPath); } catch (e) { /* ignore */ }
    throw new Error(`Failed to get YouTube transcript: ${error.message}`);
  }
}

export default {
  isYouTubeUrl,
  extractVideoId,
  fetchYouTubeTranscript,
};
