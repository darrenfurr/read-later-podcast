#!/bin/bash
# Process all new articles from Notion database

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Add infsh to PATH
export PATH="/data/.local/bin:$PATH"

# Run the processor
node scripts/process-articles.js "$@"
