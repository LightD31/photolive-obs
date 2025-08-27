const exifr = require('exifr');
const fs = require('fs').promises;
const path = require('path');

async function testExifParsing() {
    const photosDir = './photos';
    
    try {
        const files = await fs.readdir(photosDir);
        const imageFiles = files.filter(file => 
            file.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/));
        
        console.log(`Found ${imageFiles.length} images to test EXIF parsing:`);
        
        for (const file of imageFiles.slice(0, 3)) { // Test first 3 images
            const filePath = path.join(photosDir, file);
            console.log(`\n=== Testing ${file} ===`);
            
            try {
                // Get file stats
                const stats = await fs.stat(filePath);
                console.log('File stats:');
                console.log('  Created:', stats.birthtime);
                console.log('  Modified:', stats.mtime);
                
                // Test EXIF parsing with same options as PhotoLive OBS
                const options = {
                    pick: ['DateTimeOriginal', 'DateTime', 'CreateDate'],
                    skip: ['thumbnail', 'ifd1', 'interop'],
                    translateValues: true,
                    reviveValues: true,
                    translateKeys: true,
                    mergeOutput: false,
                    sanitize: false,
                    chunked: false,
                    tiff: {
                        skip: ['thumbnail', 'ifd1']
                    }
                };
                
                const exifData = await exifr.parse(filePath, options);
                console.log('EXIF data:', exifData);
                
                const photoDate = exifData?.DateTimeOriginal || 
                                 exifData?.DateTime || 
                                 exifData?.CreateDate;
                
                console.log('Extracted photo date:', photoDate);
                console.log('Photo date type:', typeof photoDate);
                console.log('Is Date object:', photoDate instanceof Date);
                
                if (photoDate instanceof Date && !isNaN(photoDate)) {
                    console.log('✓ Valid EXIF date found');
                } else {
                    console.log('✗ No valid EXIF date, would fall back to file mtime:', stats.mtime);
                }
                
            } catch (error) {
                console.log('EXIF parsing error:', error.message);
                console.log('Would fall back to file mtime:', stats.mtime);
            }
        }
        
    } catch (error) {
        console.error('Error reading photos directory:', error.message);
    }
}

testExifParsing();