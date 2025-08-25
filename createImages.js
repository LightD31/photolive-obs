const fs = require('fs');
const path = require('path');

// Create simple PNG files with solid colors
const photosDir = path.join(__dirname, 'photos');

// Create different colored 1x1 PNG files for testing
// Red 1x1 PNG
const redPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

// Green 1x1 PNG 
const greenPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// Blue 1x1 PNG
const bluePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkaP/PcA8AAn4CPMIEd/0AAAAASUVORK5CYII=', 'base64');

// Write test images
fs.writeFileSync(path.join(photosDir, 'test1.png'), redPng);
fs.writeFileSync(path.join(photosDir, 'test2.png'), greenPng);
fs.writeFileSync(path.join(photosDir, 'test3.png'), bluePng);

console.log('Test images created in:', photosDir);