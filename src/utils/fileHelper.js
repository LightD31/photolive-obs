const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Ensure a directory exists, create it if it doesn't
 * @param {string} dirPath - Directory path to ensure
 */
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info(`Created directory: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats safely
 * @param {string} filePath - File path
 * @returns {Promise<object|null>} File stats or null
 */
async function getFileStats(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    logger.debug(`Error getting stats for ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Read directory contents safely
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>} Array of filenames
 */
async function readDirectory(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    logger.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Validate file path to prevent directory traversal
 * @param {string} filePath - File path to validate
 * @param {string} basePath - Base path for validation
 * @returns {boolean} True if path is valid
 */
function isPathSafe(filePath, basePath) {
  const normalizedPath = path.normalize(filePath);
  const resolvedPath = path.resolve(basePath, normalizedPath);
  return resolvedPath.startsWith(path.resolve(basePath));
}

/**
 * Get file extension in lowercase
 * @param {string} filename - Filename
 * @returns {string} File extension with dot
 */
function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

/**
 * Shuffle an array in place
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

module.exports = {
  ensureDirectoryExists,
  fileExists,
  getFileStats,
  readDirectory,
  isPathSafe,
  getFileExtension,
  shuffleArray
};
