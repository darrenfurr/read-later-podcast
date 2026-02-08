/**
 * Upload MP3 files to GitHub Releases for public hosting
 */

import { readFileSync, statSync } from 'fs';
import { basename } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_API_KEY || process.env.GITHUB_TOKEN;
const REPO_OWNER = 'darrenfurr';
const REPO_NAME = 'read-later-podcast';

/**
 * Get or create a release for podcast uploads
 */
async function getOrCreateRelease() {
  const tag = 'podcasts';
  
  // Check if release exists
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${tag}`,
    {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );
  
  if (response.ok) {
    return await response.json();
  }
  
  // Create release if it doesn't exist
  const createResponse = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: tag,
        name: 'Podcast Episodes',
        body: 'Auto-generated podcast episodes from read-later-podcast',
        draft: false,
        prerelease: false,
      }),
    }
  );
  
  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create release: ${error}`);
  }
  
  return await createResponse.json();
}

/**
 * Upload MP3 file to GitHub Release
 * @param {string} filePath - Path to the MP3 file
 * @returns {string} Public URL to the uploaded file
 */
export async function uploadToGitHub(filePath) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_API_KEY or GITHUB_TOKEN not set');
  }
  
  console.log(`📤 Uploading to GitHub: ${basename(filePath)}`);
  
  // Get or create release
  const release = await getOrCreateRelease();
  
  // Read file
  const fileBuffer = readFileSync(filePath);
  const fileName = basename(filePath);
  const fileSize = statSync(filePath).size;
  
  // Check if asset already exists (delete if so)
  const existingAsset = release.assets?.find(a => a.name === fileName);
  if (existingAsset) {
    await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existingAsset.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
  }
  
  // Upload new asset
  const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(fileName)}`);
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'audio/mpeg',
      'Content-Length': fileSize.toString(),
    },
    body: fileBuffer,
  });
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload: ${error}`);
  }
  
  const asset = await uploadResponse.json();
  
  console.log(`✅ Uploaded: ${asset.browser_download_url}`);
  
  return asset.browser_download_url;
}

export default { uploadToGitHub };
