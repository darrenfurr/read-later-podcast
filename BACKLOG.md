# Read Later Podcast - Feature Backlog

Ideas and enhancements for future development.

---

## 📻 Podcast Summarization Pipeline

**Status:** Planned  
**Priority:** Medium  
**Requested:** 2026-02-08

### Overview
Add support for processing podcast links (in addition to article URLs) - download, transcribe, and create condensed audio summaries with humor.

### User Story
"I want to add podcast links to the same Notion DB, have the system summarize the content (highlight reel with interesting parts + humor), and output a shorter, more concise podcast version with all filler removed."

### Technical Approach

**Input:**
- Podcast link in Notion database (Spotify, Apple Podcasts, YouTube, etc.)

**Pipeline:**
1. **Download:** Use `yt-dlp` to fetch audio from most podcast platforms
2. **Transcribe:** Whisper or similar transcription service
3. **Summarize:** Claude analyzes transcript → extract key insights, remove filler, inject humor
4. **Generate:** TTS the summary using multi-voice conversation style (like current article podcasts)
5. **Output:** Save condensed podcast to output folder, update Notion with link

**Length:**
- Flexible based on content
- Target: Remove ~70-80% filler (10-min original → 2-3 min summary)

**Voice Style:**
- Match existing two-host format (host + guest)
- Keep humor natural and conversational
- Cut: Ads, intros/outros, repetitive segments, tangents

### Dependencies
- `yt-dlp` (podcast download)
- Whisper API or local model (transcription)
- Claude API (summarization + humor injection)
- Existing Kokoro TTS pipeline (voice generation)

### Configuration Options
```javascript
podcast: {
  summarization: {
    targetCompressionRatio: 0.3,  // Keep 30% of original length
    includeHumor: true,
    removeFiller: true,
    removeAds: true,
  },
  platforms: [
    'spotify',
    'apple',
    'youtube',
    'overcast',
    'pocketcasts',
  ],
}
```

### Detection Logic
Detect if URL is a podcast vs. article:
- URL patterns (spotify.com/episode, podcasts.apple.com, etc.)
- Content-Type headers (audio/*)
- Metadata in Notion (optional "Type" field: Article | Podcast)

### Notion Database Updates
**Option 1:** Same database, auto-detect type  
**Option 2:** Add "Content Type" select field (Article | Podcast)

Recommendation: Option 1 (simpler for user - just paste any link)

### Example Output
```
Input:  60-minute podcast episode
Output: 8-minute highlight reel with:
        - Key insights
        - Best quotes
        - Funny moments
        - Actionable takeaways
        - Zero filler
```

### Open Questions
- Should we preserve original speaker attribution, or blend into host/guest format?
- Should condensed podcasts be marked differently in Notion? (e.g., "Podcast Summary" category)
- Do we want to support chapters/timestamps in output?

### Estimated Effort
- **Small:** 4-6 hours (basic implementation)
- **Medium:** 8-12 hours (with robust platform support + quality checks)

---

## 🎯 Other Ideas

### Multi-Language Support
- Translate articles/podcasts before generating
- Support voices in other languages (Spanish, French, etc.)

### Playlist Mode
- Combine multiple short articles into one longer podcast episode
- Theme-based playlists (e.g., "This Week in AI")

### Voice Customization
- Let users pick voices per database (different collections, different vibes)
- Support custom voice cloning (ElevenLabs integration)

### Smart Scheduling
- Process articles at specific times (e.g., generate overnight for morning commute)
- Priority queue (urgent reads processed first)

### Analytics
- Track which categories get the most engagement
- Suggest related articles based on listening history

---

**Last Updated:** 2026-02-08
