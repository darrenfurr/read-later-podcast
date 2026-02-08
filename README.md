# Read Later Podcast 🎙️

Convert your saved articles into engaging, professionally-produced podcasts.

Drop a URL into your Notion database → Get a 15+ minute podcast with two hosts discussing the content in the style of "How I Built This" with Guy Raz.

## Features

- **Notion Integration**: Reads URLs from your database, writes back podcast links
- **Smart Content Expansion**: If articles are too short, researches and supplements with recent findings  
- **Two-Host Format**: Warm, curious interviewer + knowledgeable guest
- **Auto-Categorization**: Automatically tags content (Tech, Finance, AI, Parenting, etc.)
- **Quality Audio**: Uses Kokoro TTS with natural voices

## Quick Start

```bash
# Clone and install
git clone https://github.com/darrenfurr/read-later-podcast.git
cd read-later-podcast
npm install

# Set environment variables
export NOTION_API_KEY="your-notion-api-key"
export NOTION_DATABASE_ID="your-database-id"

# Login to inference.sh (for TTS)
infsh login

# Process all new articles
./scripts/process-articles.sh

# Or generate from a single URL
./scripts/generate-podcast.sh "https://example.com/article"
```

## Setup

### 1. Notion Database

Create a database with these columns:
- `Title` (Title) - Article title
- `URL` (URL) - Article link to process  
- `Status` (Select) - Options: New, Processing, Complete, Error
- `Category` (Select) - Auto-filled: Tech, Finance, AI, Parenting, etc.
- `Podcast Link` (URL) - Filled after generation
- `Created` (Date) - When added
- `Processed` (Date) - When podcast was generated

Share the database with your Notion integration.

### 2. Environment Variables

```bash
# Required
export NOTION_API_KEY="secret_xxx"      # From notion.so/my-integrations
export NOTION_DATABASE_ID="xxx"         # From database URL

# Optional
export INFSH_PATH="/path/to/infsh"      # Default: /data/.local/bin/infsh
```

### 3. inference.sh Login

```bash
curl -fsSL https://cli.inference.sh | sh
infsh login
```

### 4. Dependencies

- Node.js 18+
- ffmpeg (for audio merging)

```bash
# Ubuntu/Debian
apt-get install ffmpeg

# macOS
brew install ffmpeg
```

## Usage

### Process All New Articles

```bash
npm run process
# or
./scripts/process-articles.sh
```

### Generate from Single URL

```bash
npm run generate -- "https://example.com/article"
# or
./scripts/generate-podcast.sh "https://example.com/article"
```

### Check Database Status

```bash
npm run status
# or
node scripts/notion-status.js
```

## Configuration

Edit `lib/config.js` to customize:

```javascript
export const config = {
  // Target podcast length
  content: {
    targetPodcastMinutes: 15,
    maxPodcastMinutes: 25,
  },

  // Voice selection
  voices: {
    host: 'am_michael',     // American male
    guest: 'af_sarah',      // American female
  },

  // Audio settings
  audio: {
    introOutroEnabled: true,
    backgroundMusicEnabled: false,
  },
};
```

### Available Voices

| Voice ID | Description |
|----------|-------------|
| `am_michael` | American male, authoritative |
| `am_adam` | American male, casual |
| `af_sarah` | American female, warm |
| `af_nicole` | American female, professional |
| `bf_emma` | British female, refined |
| `bm_george` | British male, classic |

## Automation

### Cron Job

```bash
# Check for new articles every hour
0 * * * * cd /path/to/read-later-podcast && ./scripts/process-articles.sh
```

### OpenClaw Cron

```json
{
  "schedule": { "kind": "cron", "expr": "0 * * * *" },
  "payload": { 
    "kind": "systemEvent", 
    "text": "Check read-later-podcast Notion database and process new articles" 
  }
}
```

## Output

Podcasts are saved to `./output/` with format:
```
YYYY-MM-DD-article-title-slug.mp3
```

## Podcast Style

Inspired by "How I Built This" with Guy Raz:

- **Host**: Warm, curious, asks great follow-up questions
- **Guest**: Knowledgeable, shares insights and anecdotes
- **Tone**: Conversational but informative
- **Humor**: Well-timed, natural, not forced
- **Length**: 15-25 minutes (no filler)

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
                    │   TTS Gen   │────▶│   Merge &   │
                    │  (infsh)    │     │   Output    │
                    └─────────────┘     └─────────────┘
```

## Troubleshooting

**"NOTION_API_KEY not set"**
- Ensure environment variable is exported
- Check integration permissions at notion.so/my-integrations

**"Content too short"**
- System will automatically research and expand
- If expansion fails, check infsh login status

**"ffmpeg not available"**
- Install ffmpeg: `apt-get install ffmpeg` or `brew install ffmpeg`

**TTS quality issues**
- Try different voices in `lib/config.js`
- Adjust crossfade timing in audio settings

## License

MIT
