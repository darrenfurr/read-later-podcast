/**
 * Notion API integration for read-later-podcast
 */

import { Client } from '@notionhq/client';
import { config } from './config.js';

const notion = new Client({ auth: config.notion.apiKey });

/**
 * Get all articles with status "New" from the database
 */
export async function getNewArticles() {
  const response = await notion.databases.query({
    database_id: config.notion.databaseId,
    filter: {
      property: 'Status',
      select: {
        equals: 'New',
      },
    },
    sorts: [
      {
        property: 'Created',
        direction: 'ascending',
      },
    ],
  });

  return response.results.map(page => ({
    id: page.id,
    url: getUrlProperty(page),
    title: getTitleProperty(page),
    created: page.created_time,
  }));
}

/**
 * Update article status
 */
export async function updateStatus(pageId, status) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        select: { name: status },
      },
    },
  });
}

/**
 * Mark article as complete with podcast link
 */
export async function markComplete(pageId, { podcastUrl, category, title }) {
  const properties = {
    Status: {
      select: { name: 'Complete' },
    },
    Processed: {
      date: { start: new Date().toISOString() },
    },
  };

  if (podcastUrl) {
    properties['Podcast Link'] = {
      url: podcastUrl,
    };
  }

  if (category) {
    properties['Category'] = {
      select: { name: category },
    };
  }

  if (title) {
    properties['Title'] = {
      title: [{ text: { content: title } }],
    };
  }

  await notion.pages.update({
    page_id: pageId,
    properties,
  });
}

/**
 * Mark article as errored
 */
export async function markError(pageId, errorMessage) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: {
        select: { name: 'Error' },
      },
      // Could add error notes if there's a Notes column
    },
  });
  console.error(`Error processing ${pageId}: ${errorMessage}`);
}

/**
 * Get database info and stats
 */
export async function getDatabaseStats() {
  const [newArticles, processing, complete, errors] = await Promise.all([
    notion.databases.query({
      database_id: config.notion.databaseId,
      filter: { property: 'Status', select: { equals: 'New' } },
    }),
    notion.databases.query({
      database_id: config.notion.databaseId,
      filter: { property: 'Status', select: { equals: 'Processing' } },
    }),
    notion.databases.query({
      database_id: config.notion.databaseId,
      filter: { property: 'Status', select: { equals: 'Complete' } },
    }),
    notion.databases.query({
      database_id: config.notion.databaseId,
      filter: { property: 'Status', select: { equals: 'Error' } },
    }),
  ]);

  return {
    new: newArticles.results.length,
    processing: processing.results.length,
    complete: complete.results.length,
    errors: errors.results.length,
    total: newArticles.results.length + processing.results.length + 
           complete.results.length + errors.results.length,
  };
}

// Helper functions
function getUrlProperty(page) {
  const urlProp = page.properties.URL;
  if (urlProp?.url) return urlProp.url;
  if (urlProp?.rich_text?.[0]?.plain_text) return urlProp.rich_text[0].plain_text;
  return null;
}

function getTitleProperty(page) {
  const titleProp = page.properties.Title || page.properties.Name;
  if (titleProp?.title?.[0]?.plain_text) return titleProp.title[0].plain_text;
  return null;
}

export default {
  getNewArticles,
  updateStatus,
  markComplete,
  markError,
  getDatabaseStats,
};
