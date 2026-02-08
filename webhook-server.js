#!/usr/bin/env node
/**
 * Webhook server for Notion → podcast generation
 */

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.WEBHOOK_PORT || 3456;

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'read-later-podcast-webhook' });
});

// Notion webhook endpoint
app.post('/webhook/notion', async (req, res) => {
  console.log('\n📥 Webhook received from Notion');
  
  // Respond immediately so Notion doesn't timeout
  res.json({ status: 'processing', message: 'Podcast generation started' });

  // Process in background
  try {
    console.log('  Starting podcast generation...');
    const { stdout, stderr } = await execAsync(
      'npm run process',
      { cwd: '/data/projects/read-later-podcast', timeout: 600000 }
    );
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('  ✓ Processing complete');
  } catch (error) {
    console.error('  ✗ Processing failed:', error.message);
  }
});

// Manual trigger endpoint (for testing)
app.post('/trigger', async (req, res) => {
  console.log('\n🔧 Manual trigger received');
  res.json({ status: 'processing', message: 'Podcast generation started' });

  try {
    const { stdout, stderr } = await execAsync(
      'npm run process',
      { cwd: '/data/projects/read-later-podcast', timeout: 600000 }
    );
    console.log(stdout);
    if (stderr) console.error(stderr);
    console.log('  ✓ Processing complete');
  } catch (error) {
    console.error('  ✗ Processing failed:', error.message);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎙️  Webhook server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Webhook: http://localhost:${PORT}/webhook/notion`);
  console.log(`   Manual: http://localhost:${PORT}/trigger\n`);
});
