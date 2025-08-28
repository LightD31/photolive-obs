#!/usr/bin/env node

/**
 * PhotoLive OBS Server
 * Refactored modular architecture
 */

const PhotoLiveApp = require('./src/app');

// Create and start the application
const app = new PhotoLiveApp();

app.start().catch((error) => {
  console.error('Failed to start PhotoLive OBS Server:', error);
  process.exit(1);
});
