---
name: read-later-podcast
description: |
  Convert saved articles to engaging AI-generated podcasts.
  Integrates with Notion database, fetches articles, generates two-host conversation scripts,
  and produces 15+ minute podcasts using AI TTS.
  Triggers: read later podcast, article to podcast, notion podcast, saved articles audio,
  convert article podcast, ai podcast generator, url to podcast
allowed-tools: Bash(node *), Bash(npx *), Bash(infsh *)
---

# Read Later Podcast

Convert your saved articles into engaging, professionally-produced podcasts.

## Overview

Drop a URL into your Notion database → Get a 15+ minute podcast with two hosts discussing the content in the style of "How I Built This" with Guy Raz.

## Features

- **Notion Integration**: Reads URLs from your database, writes back podcast links
- **Smart Content Expansion**: If articles are too short, researches and supplements with recent findings
- **Two-Host Format**: Warm, curious interviewer + knowledgeable guest
- **Auto-Categorization**: Automatically tags content (Tech, Finance, AI, Parenting, etc.)
- **Quality Audio**: Uses Kokoro TTS with natural voices

## Quick Start

```bash
# Process all new articles in Notion
./scripts/process-articles.sh

# Process a single URL
./scripts/generate-podcast.sh "https://example.com/article"

# Check Notion database status
./scripts/notion-status.sh
```

## Setup

### Environment Variables

```bash
export NOTION_API_KEY="your-notion-api-key"
export NOTION_DATABASE_ID="your-database-id"
export INFSH_API_KEY="your-inference-sh-key"  # or run `infsh login`
```

### Notion Database Schema

The database should have these columns:
- `URL` (URL) - Article link to process
- `Title` (Title) - Article title (auto-filled)
- `Category` (Select) - Tech/Finance/AI/Parenting/Self Improvement/etc.
- `Status` (Select) - New/Processing/Complete/Error
- `Podcast Link` (URL) - Generated podcast URL
- `Created` (Date) - When added
- `Processed` (Date) - When podcast was generated

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Notion    │────▶│   Fetcher    │────▶│   Script    │
│  Database   │     │  (web_fetch) │     │  Generator  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                           ┌────────────────────┘
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   TTS Gen   │────▶│   Upload    │
                    │  (infsh)    │     │   & Link    │
                    └─────────────┘     └─────────────┘
```

## Podcast Style

Inspired by Guy Raz's "How I Built This":
- **Host**: Warm, curious, asks great follow-up questions
- **Guest**: Knowledgeable, shares insights and anecdotes
- **Tone**: Conversational but informative
- **Humor**: Well-timed, natural, not forced
- **Length**: 15-25 minutes (no filler)

## Scripts

| Script | Description |
|--------|-------------|
| `process-articles.sh` | Main entry - processes all new Notion entries |
| `generate-podcast.sh` | Generate podcast from single URL |
| `notion-status.sh` | Check database status |
| `lib/notion.js` | Notion API helpers |
| `lib/content.js` | Article fetching and expansion |
| `lib/script-gen.js` | Podcast script generation |
| `lib/tts.js` | Text-to-speech generation |

## Voice Configuration

Default voices (configurable):
- **Host**: `am_michael` - American male, authoritative yet warm
- **Guest**: `af_sarah` - American female, conversational

## Categories

Auto-detected categories:
- Technology / AI / Programming
- Finance / Investing / Crypto
- Parenting / Family
- Self Improvement / Productivity
- Science / Health
- Business / Entrepreneurship
- Culture / Entertainment

## Cron Integration

```bash
# Check for new articles every hour
0 * * * * /path/to/read-later-podcast/scripts/process-articles.sh
```

Or via OpenClaw cron:
```json
{
  "schedule": { "kind": "cron", "expr": "0 * * * *" },
  "payload": { "kind": "systemEvent", "text": "Check read-later-podcast for new articles" }
}
```

## Output

Podcasts are saved to:
- Local: `./output/{date}-{slug}.mp3`
- Remote: Uploaded to configured storage (S3, etc.)

## Troubleshooting

**Article too short?**
The system will automatically research the topic and expand content.

**TTS quality issues?**
Try adjusting voice speed or switching voices in `lib/tts.js`.

**Notion sync issues?**
Check `NOTION_API_KEY` permissions and database sharing settings.
