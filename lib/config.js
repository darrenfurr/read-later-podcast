/**
 * Configuration for read-later-podcast
 */

export const config = {
  // Notion
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
  },

  // Content settings
  content: {
    minWordsForPodcast: 2000, // ~15 min podcast needs ~2000 words of source
    targetPodcastMinutes: 15,
    maxPodcastMinutes: 25,
    wordsPerMinute: 150, // Spoken word rate
  },

  // Voice configuration
  voices: {
    host: 'am_michael',     // Warm, authoritative male
    guest: 'af_sarah',      // Conversational female
  },

  // Audio settings
  audio: {
    crossfadeMs: 400,
    introOutroEnabled: true,
    backgroundMusicEnabled: false, // Set true if desired
    backgroundVolume: 0.1,
  },

  // Categories for auto-detection
  categories: [
    'Technology',
    'AI',
    'Finance',
    'Parenting',
    'Self Improvement',
    'Science',
    'Health',
    'Business',
    'Culture',
    'Programming',
    'Productivity',
  ],

  // Output
  output: {
    dir: './output',
    format: 'mp3',
  },

  // infsh CLI path
  infshPath: process.env.INFSH_PATH || '/data/.local/bin/infsh',
};

export default config;
