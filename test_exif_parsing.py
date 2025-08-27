#!/usr/bin/env python3
"""
Test script to create images with EXIF data and test EXIF parsing in PhotoLive OBS
"""
import os
import subprocess
from PIL import Image
from PIL.ExifTags import TAGS
import datetime

def create_image_with_exif():
    """Create a test image with EXIF data"""
    # Create a simple test image
    img = Image.new('RGB', (800, 600), color='lightblue')
    
    # Create EXIF data dictionary
    from PIL.ExifTags import TAGS
    from PIL import ExifTags
    
    # Note: PIL's EXIF creation is limited, but we can test with exiftool instead
    img_path = '/home/runner/work/photolive-obs/photolive-obs/test_images/test_exif.jpg'
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    
    # Save basic image first
    img.save(img_path, 'JPEG', quality=95)
    print(f"Created test image: {img_path}")
    
    # Try to use exiftool to add EXIF data if available
    try:
        # Add EXIF date data using exiftool
        test_date = "2024:03:15 14:30:25"
        subprocess.run([
            'exiftool', 
            f'-DateTimeOriginal={test_date}',
            f'-DateTime={test_date}', 
            f'-CreateDate={test_date}',
            '-overwrite_original',
            img_path
        ], check=True, capture_output=True)
        print(f"Added EXIF data with date: {test_date}")
        return img_path
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("exiftool not available, using basic image without EXIF dates")
        return img_path

def test_exifr_parsing():
    """Test EXIF parsing using the same method as PhotoLive OBS"""
    import subprocess
    import json
    
    img_path = create_image_with_exif()
    
    # Test with Node.js exifr library (same as PhotoLive OBS)
    test_script = '''
const exifr = require('exifr');
const path = process.argv[2];

async function testExif() {
    try {
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
        
        const exifData = await exifr.parse(path, options);
        console.log('EXIF data found:');
        console.log(JSON.stringify(exifData, null, 2));
        
        const photoDate = exifData?.DateTimeOriginal || 
                         exifData?.DateTime || 
                         exifData?.CreateDate;
        
        console.log('\\nExtracted photo date:', photoDate);
        console.log('Date type:', typeof photoDate);
        console.log('Is Date object:', photoDate instanceof Date);
        console.log('Is valid date:', photoDate instanceof Date && !isNaN(photoDate));
        
    } catch (error) {
        console.error('EXIF parsing error:', error.message);
    }
}

testExif();
'''
    
    # Write test script
    script_path = '/home/runner/work/photolive-obs/photolive-obs/test_exif.js'
    with open(script_path, 'w') as f:
        f.write(test_script)
    
    # Run test
    try:
        result = subprocess.run(['node', script_path, img_path], 
                              capture_output=True, text=True, 
                              cwd='/home/runner/work/photolive-obs/photolive-obs')
        print("=== EXIF Parsing Test Results ===")
        print("STDOUT:", result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        print("Return code:", result.returncode)
    except Exception as e:
        print(f"Error running test: {e}")

if __name__ == '__main__':
    test_exifr_parsing()