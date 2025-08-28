#!/usr/bin/env node

/**
 * Migration script for PhotoLive OBS refactored architecture
 * This script helps migrate from the monolithic server.js to the modular architecture
 */

const fs = require('fs');
const path = require('path');

const BACKUP_SUFFIX = '.backup';
const NEW_SERVER_FILE = 'server-new.js';
const OLD_SERVER_FILE = 'server.js';

console.log('=== PhotoLive OBS Migration Script ===\n');

async function createBackup() {
  const backupPath = OLD_SERVER_FILE + BACKUP_SUFFIX;
  
  try {
    if (fs.existsSync(backupPath)) {
      console.log(`⚠️  Backup file ${backupPath} already exists`);
      return false;
    }
    
    fs.copyFileSync(OLD_SERVER_FILE, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error.message}`);
    return false;
  }
}

async function migrateServer() {
  try {
    if (!fs.existsSync(NEW_SERVER_FILE)) {
      console.error(`❌ Refactored server file ${NEW_SERVER_FILE} not found`);
      return false;
    }
    
    // Replace old server with new one
    fs.copyFileSync(NEW_SERVER_FILE, OLD_SERVER_FILE);
    console.log(`✅ Server migrated: ${OLD_SERVER_FILE} replaced with refactored version`);
    
    // Remove the new server file
    fs.unlinkSync(NEW_SERVER_FILE);
    console.log(`✅ Temporary file ${NEW_SERVER_FILE} removed`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to migrate server: ${error.message}`);
    return false;
  }
}

async function updatePackageJson() {
  try {
    const packagePath = 'package.json';
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Update scripts to use the refactored architecture
    packageData.scripts = {
      ...packageData.scripts,
      'start': 'node server.js',
      'dev': 'node server.js',
      'start:original': 'node server.js.backup'
    };
    
    // Add refactoring note
    if (!packageData.description.includes('refactored')) {
      packageData.description += ' (refactored modular architecture)';
    }
    
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
    console.log('✅ package.json updated');
    return true;
  } catch (error) {
    console.error(`❌ Failed to update package.json: ${error.message}`);
    return false;
  }
}

async function updateTasks() {
  try {
    const tasksPath = '.vscode/tasks.json';
    
    if (!fs.existsSync(tasksPath)) {
      console.log('ℹ️  No VS Code tasks.json found, skipping');
      return true;
    }
    
    const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    
    // Update the main task to use the refactored server
    const mainTask = tasksData.tasks.find(task => 
      task.label === 'Start PhotoLive OBS Server' || 
      task.label === 'Start PhotoLive OBS Server (Refactored)'
    );
    
    if (mainTask) {
      mainTask.label = 'Start PhotoLive OBS Server';
      mainTask.args = ['server.js'];
    }
    
    // Add backup task
    const backupTask = {
      label: 'Start PhotoLive OBS Server (Original)',
      type: 'shell',
      command: 'node',
      args: ['server.js.backup'],
      group: 'build',
      isBackground: true,
      problemMatcher: [],
      presentation: {
        echo: true,
        reveal: 'always',
        focus: false,
        panel: 'new'
      },
      options: {
        cwd: '${workspaceFolder}'
      }
    };
    
    const existingBackupTask = tasksData.tasks.find(task => 
      task.label === 'Start PhotoLive OBS Server (Original)'
    );
    
    if (!existingBackupTask) {
      tasksData.tasks.push(backupTask);
    }
    
    fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, '\t'));
    console.log('✅ VS Code tasks updated');
    return true;
  } catch (error) {
    console.error(`❌ Failed to update tasks: ${error.message}`);
    return false;
  }
}

async function validateMigration() {
  const checks = [
    { file: 'src/app.js', description: 'Main application module' },
    { file: 'src/config/index.js', description: 'Configuration module' },
    { file: 'src/services/imageService.js', description: 'Image service' },
    { file: 'src/controllers/apiController.js', description: 'API controller' },
    { file: OLD_SERVER_FILE, description: 'Migrated server file' },
    { file: OLD_SERVER_FILE + BACKUP_SUFFIX, description: 'Backup file' }
  ];
  
  console.log('\n=== Validation ===');
  let allValid = true;
  
  for (const check of checks) {
    if (fs.existsSync(check.file)) {
      console.log(`✅ ${check.description}: ${check.file}`);
    } else {
      console.log(`❌ ${check.description}: ${check.file} (missing)`);
      allValid = false;
    }
  }
  
  return allValid;
}

async function printSummary() {
  console.log('\n=== Migration Summary ===');
  console.log('✅ Migration completed successfully!');
  console.log('\nWhat happened:');
  console.log(`1. Original server.js backed up to ${OLD_SERVER_FILE + BACKUP_SUFFIX}`);
  console.log('2. New modular server.js is now active');
  console.log('3. package.json and VS Code tasks updated');
  console.log('\nNext steps:');
  console.log('1. Test the new server: npm start');
  console.log('2. Verify all functionality works as expected');
  console.log(`3. If issues arise, restore from backup: mv ${OLD_SERVER_FILE + BACKUP_SUFFIX} ${OLD_SERVER_FILE}`);
  console.log('\nArchitecture benefits:');
  console.log('- Modular, maintainable code structure');
  console.log('- Better error handling and logging');
  console.log('- Enhanced security and validation');
  console.log('- Improved testability and extensibility');
}

async function main() {
  try {
    console.log('Starting migration process...\n');
    
    // Step 1: Create backup
    console.log('1. Creating backup...');
    const backupCreated = await createBackup();
    if (!backupCreated) {
      console.log('❌ Migration aborted due to backup failure');
      return;
    }
    
    // Step 2: Migrate server
    console.log('\n2. Migrating server...');
    const serverMigrated = await migrateServer();
    if (!serverMigrated) {
      console.log('❌ Migration aborted due to server migration failure');
      return;
    }
    
    // Step 3: Update package.json
    console.log('\n3. Updating package.json...');
    await updatePackageJson();
    
    // Step 4: Update VS Code tasks
    console.log('\n4. Updating VS Code tasks...');
    await updateTasks();
    
    // Step 5: Validate migration
    const isValid = await validateMigration();
    if (!isValid) {
      console.log('\n⚠️  Some validation checks failed, please review');
    }
    
    // Step 6: Print summary
    await printSummary();
    
  } catch (error) {
    console.error(`❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  main();
}

module.exports = { main, createBackup, migrateServer, validateMigration };
