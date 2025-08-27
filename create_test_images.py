#!/usr/bin/env python3
"""
PhotoLive OBS Test Image Generator with EXIF Support

This script creates realistic test images with complete EXIF metadata for testing
the PhotoLive OBS application. It generates images with:

- Realistic camera metadata (Canon, Nikon, Sony, Fujifilm, Olympus)
- Camera settings (ISO, aperture, shutter speed, focal length)
- Date/time information matching image content
- GPS location data (every 3rd image: Paris, New York, Tokyo, London, Sydney)
- Lens information and technical specifications
- Proper file modification timestamps

Dependencies:
- Pillow (PIL): pip install Pillow
- piexif: pip install piexif (optional, for EXIF data)

Usage:
    python create_test_images.py

The script will create 9 test images in the ./photos directory with different
formats (landscape, portrait, square) and various metadata.
"""

import os
import time
import datetime
import platform
from PIL import Image, ImageDraw, ImageFont
try:
    import piexif
    EXIF_AVAILABLE = True
except ImportError:
    EXIF_AVAILABLE = False
    print("Warning: piexif not installed. EXIF data will not be added.")
    print("Install with: pip install piexif")

photos_dir = './photos'
os.makedirs(photos_dir, exist_ok=True)

# Cross-platform font detection
def get_system_fonts():
    """Get available system fonts based on the operating system."""
    system = platform.system().lower()
    
    if system == 'windows':
        # Windows font paths
        font_paths = {
            'bold': [
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/calibrib.ttf',  # Calibri Bold
                'C:/Windows/Fonts/tahoma.ttf',
                'C:/Windows/Fonts/verdanab.ttf',  # Verdana Bold
            ],
            'regular': [
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/calibri.ttf',
                'C:/Windows/Fonts/tahoma.ttf',
                'C:/Windows/Fonts/verdana.ttf',
            ]
        }
    elif system == 'darwin':  # macOS
        # macOS font paths
        font_paths = {
            'bold': [
                '/System/Library/Fonts/Helvetica.ttc',
                '/Library/Fonts/Arial Bold.ttf',
                '/System/Library/Fonts/Arial.ttf',
                '/Library/Fonts/Verdana Bold.ttf',
            ],
            'regular': [
                '/System/Library/Fonts/Helvetica.ttc',
                '/Library/Fonts/Arial.ttf',
                '/System/Library/Fonts/Arial.ttf',
                '/Library/Fonts/Verdana.ttf',
            ]
        }
    else:  # Linux and other Unix-like systems
        # Linux font paths
        font_paths = {
            'bold': [
                '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
                '/usr/share/fonts/open-sans/OpenSans-Bold.ttf',
                '/usr/share/fonts/TTF/LiberationSans-Bold.ttf',
                '/usr/share/fonts/noto/NotoSans-Bold.ttf',
                '/usr/share/fonts/google-noto/NotoSans-Bold.ttf',
            ],
            'regular': [
                '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
                '/usr/share/fonts/open-sans/OpenSans-Regular.ttf',
                '/usr/share/fonts/TTF/LiberationSans-Regular.ttf',
                '/usr/share/fonts/noto/NotoSans-Regular.ttf',
                '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
            ]
        }
    
    # Find the first available font for each type
    available_fonts = {'bold': None, 'regular': None}
    
    for font_type in ['bold', 'regular']:
        for font_path in font_paths[font_type]:
            if os.path.exists(font_path):
                available_fonts[font_type] = font_path
                break
    
    return available_fonts

def load_font(font_path, size):
    """Load a font with fallback to default if font path is invalid."""
    if font_path and os.path.exists(font_path):
        try:
            return ImageFont.truetype(font_path, size)
        except:
            pass
    return ImageFont.load_default()

# Get available system fonts
system_fonts = get_system_fonts()
print(f"System: {platform.system()}")
print(f"Available fonts: Bold={system_fonts['bold']}, Regular={system_fonts['regular']}")

formats = [
    {'name': 'Landscape HD', 'width': 1920, 'height': 1080, 'ratio': '16:9'},
    {'name': 'Portrait', 'width': 1080, 'height': 1920, 'ratio': '9:16'},
    {'name': 'Square', 'width': 1080, 'height': 1080, 'ratio': '1:1'},
]

styles = [
    {'theme': 'Blue', 'bg_color': (52, 152, 219), 'text_color': (255, 255, 255)},
    {'theme': 'Green', 'bg_color': (46, 204, 113), 'text_color': (255, 255, 255)},
    {'theme': 'Red', 'bg_color': (231, 76, 60), 'text_color': (255, 255, 255)},
]

def create_exif_data(photo_date, width, height, image_count):
    """Create realistic EXIF data for test images."""
    if not EXIF_AVAILABLE:
        return None
    
    # Camera models and manufacturers
    cameras = [
        {"make": "Canon", "model": "Canon EOS R5", "lens": "RF 24-70mm f/2.8L IS USM"},
        {"make": "Nikon", "model": "D850", "lens": "AF-S NIKKOR 24-70mm f/2.8E ED VR"},
        {"make": "Sony", "model": "α7R IV", "lens": "FE 24-70mm F2.8 GM"},
        {"make": "Fujifilm", "model": "X-T4", "lens": "XF 16-55mm F2.8 R LM WR"},
        {"make": "Olympus", "model": "OM-D E-M1 Mark III", "lens": "M.ZUIKO DIGITAL ED 12-40mm F2.8 PRO"},
    ]
    
    # Choose camera based on image count for consistency
    camera = cameras[image_count % len(cameras)]
    
    # Generate realistic camera settings
    iso_values = [100, 200, 400, 800, 1600, 3200]
    apertures = [1.4, 1.8, 2.8, 4.0, 5.6, 8.0, 11.0]
    shutter_speeds = [(1, 60), (1, 125), (1, 250), (1, 500), (1, 1000), (1, 2000)]
    focal_lengths = [24, 35, 50, 70, 85, 105, 135]
    
    # Use deterministic selection based on image count for consistent results
    import random
    random.seed(image_count)
    
    iso = random.choice(iso_values)
    aperture = random.choice(apertures)
    shutter_speed = random.choice(shutter_speeds)
    focal_length = random.choice(focal_lengths)
    
    # Convert datetime to EXIF format
    date_str = photo_date.strftime("%Y:%m:%d %H:%M:%S")
    
    # Create EXIF dictionary
    exif_dict = {
        "0th": {
            piexif.ImageIFD.Make: camera["make"].encode('utf-8'),
            piexif.ImageIFD.Model: camera["model"].encode('utf-8'),
            piexif.ImageIFD.DateTime: date_str.encode('utf-8'),
            piexif.ImageIFD.Software: "PhotoLive OBS Test Image Generator".encode('utf-8'),
            piexif.ImageIFD.ImageWidth: width,
            piexif.ImageIFD.ImageLength: height,
            piexif.ImageIFD.Orientation: 1,
            piexif.ImageIFD.XResolution: (72, 1),
            piexif.ImageIFD.YResolution: (72, 1),
            piexif.ImageIFD.ResolutionUnit: 2,
        },
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: date_str.encode('utf-8'),
            piexif.ExifIFD.DateTimeDigitized: date_str.encode('utf-8'),
            piexif.ExifIFD.ExposureTime: shutter_speed,
            piexif.ExifIFD.FNumber: (int(aperture * 10), 10),
            piexif.ExifIFD.ExposureProgram: 3,  # Aperture priority
            piexif.ExifIFD.ISOSpeedRatings: iso,
            piexif.ExifIFD.ExifVersion: b"0231",
            piexif.ExifIFD.ComponentsConfiguration: b"\x01\x02\x03\x00",
            piexif.ExifIFD.FlashpixVersion: b"0100",
            piexif.ExifIFD.ColorSpace: 1,
            piexif.ExifIFD.PixelXDimension: width,
            piexif.ExifIFD.PixelYDimension: height,
            piexif.ExifIFD.FocalLength: (focal_length, 1),
            piexif.ExifIFD.WhiteBalance: 0,  # Auto
            piexif.ExifIFD.SceneCaptureType: 0,  # Standard
        },
        "GPS": {},
        "1st": {},
        "thumbnail": None
    }
    
    # Add lens information if available
    if "lens" in camera:
        exif_dict["Exif"][piexif.ExifIFD.LensModel] = camera["lens"].encode('utf-8')
    
    # Add GPS data for some images (simulated locations)
    if image_count % 3 == 0:  # Add GPS to every third image
        locations = [
            {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
            {"name": "New York", "lat": 40.7128, "lon": -74.0060},
            {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
            {"name": "London", "lat": 51.5074, "lon": -0.1278},
            {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
        ]
        
        location = locations[image_count % len(locations)]
        
        # Convert decimal degrees to GPS format (degrees, minutes, seconds)
        def decimal_to_dms(decimal_deg):
            degrees = int(abs(decimal_deg))
            minutes_float = (abs(decimal_deg) - degrees) * 60
            minutes = int(minutes_float)
            seconds = (minutes_float - minutes) * 60
            return [(degrees, 1), (minutes, 1), (int(seconds * 1000), 1000)]
        
        lat_dms = decimal_to_dms(location["lat"])
        lon_dms = decimal_to_dms(location["lon"])
        
        exif_dict["GPS"] = {
            piexif.GPSIFD.GPSVersionID: (2, 0, 0, 0),
            piexif.GPSIFD.GPSLatitudeRef: ('N' if location["lat"] >= 0 else 'S').encode('utf-8'),
            piexif.GPSIFD.GPSLatitude: lat_dms,
            piexif.GPSIFD.GPSLongitudeRef: ('E' if location["lon"] >= 0 else 'W').encode('utf-8'),
            piexif.GPSIFD.GPSLongitude: lon_dms,
            piexif.GPSIFD.GPSAltitudeRef: 0,
            piexif.GPSIFD.GPSAltitude: (100, 1),  # 100 meters
            piexif.GPSIFD.GPSTimeStamp: ((photo_date.hour, 1), (photo_date.minute, 1), (photo_date.second, 1)),
            piexif.GPSIFD.GPSDateStamp: photo_date.strftime("%Y:%m:%d").encode('utf-8'),
        }
    
    try:
        return piexif.dump(exif_dict)
    except Exception as e:
        print(f"Warning: Failed to create EXIF data for image {image_count}: {e}")
        return None

# Create images with different dates (simulated by file modification times)
base_date = datetime.datetime(2020, 1, 1, 10, 0, 0)
image_count = 1

for format_info in formats:
    for style in styles:
        width, height = format_info['width'], format_info['height']
        img = Image.new('RGB', (width, height), style['bg_color'])
        draw = ImageDraw.Draw(img)
        
        # Function to find the largest font size that fits the text in given dimensions
        def get_max_font_size(text, max_width, max_height, font_path=None):
            # Start with a reasonable estimate based on height
            start_size = int(max_height * 0.7)  # Start at 70% of available height
            
            # Binary search for the optimal size
            min_size = 20  # Increased minimum for better readability
            max_size = min(start_size * 2, 400)  # Increased maximum for better scaling
            best_size = min_size
            
            # Check if we have a valid font path
            has_font = font_path and os.path.exists(font_path)
            
            while min_size <= max_size:
                mid_size = (min_size + max_size) // 2
                
                try:
                    if has_font:
                        test_font = ImageFont.truetype(font_path, mid_size)
                    else:
                        test_font = ImageFont.load_default()
                        # For default font, use smaller size range
                        if mid_size > 60:
                            max_size = 60
                            continue
                        
                    bbox = draw.textbbox((0, 0), text, font=test_font)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                    
                    # Allow text to use 90% of available space
                    width_fits = text_width <= max_width * 0.9
                    height_fits = text_height <= max_height * 0.9
                    
                    if width_fits and height_fits:
                        best_size = mid_size
                        min_size = mid_size + 1  # Try larger
                    else:
                        max_size = mid_size - 1  # Try smaller
                        
                except Exception as e:
                    # If font loading fails, fall back to simple calculation
                    char_width = mid_size * 0.6
                    estimated_width = len(text) * char_width
                    estimated_height = mid_size * 1.2
                    
                    width_fits = estimated_width <= max_width * 0.9
                    height_fits = estimated_height <= max_height * 0.9
                    
                    if width_fits and height_fits:
                        best_size = mid_size
                        min_size = mid_size + 1
                    else:
                        max_size = mid_size - 1
            
            return max(best_size, 20)  # Ensure minimum readable size
        
        # Create a date for this image (spread over multiple years)
        days_offset = (image_count - 1) * 45  # 45 days between each photo
        photo_date = base_date + datetime.timedelta(days=days_offset)
        
        # Prepare all text content
        title = f'Test Image {image_count:02d}'
        subtitle = f"{format_info['name']} • {format_info['ratio']} • {style['theme']}"
        date_text = photo_date.strftime('%Y-%m-%d')
        
        # Calculate available space (leave smaller margins for bigger text)
        margin = min(width, height) * 0.02  # Reduced to 2% margin for more space
        available_width = width - (2 * margin)
        available_height = height - (2 * margin)
        
        # More generous space allocation: 60% for title, 25% for subtitle, 15% for date
        title_height = available_height * 0.6
        subtitle_height = available_height * 0.25
        date_height = available_height * 0.15
        
        # Calculate font sizes for each text element
        # Title font (bold)
        title_font_size = get_max_font_size(title, available_width, title_height, system_fonts['bold'])
        title_font = load_font(system_fonts['bold'], title_font_size)
        
        # Subtitle font (regular)
        subtitle_font_size = get_max_font_size(subtitle, available_width, subtitle_height, system_fonts['regular'])
        subtitle_font = load_font(system_fonts['regular'], subtitle_font_size)
        
        # Date font (regular)
        date_font_size = get_max_font_size(date_text, available_width, date_height, system_fonts['regular'])
        date_font = load_font(system_fonts['regular'], date_font_size)
        
        # Calculate positions for each text element
        # Title at the top
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_text_height = title_bbox[3] - title_bbox[1]
        title_x = (width - title_width) // 2
        title_y = margin
        
        # Subtitle in the middle
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        subtitle_text_height = subtitle_bbox[3] - subtitle_bbox[1]
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = margin + title_height + (subtitle_height - subtitle_text_height) // 2
        
        # Date at the bottom
        date_bbox = draw.textbbox((0, 0), date_text, font=date_font)
        date_width = date_bbox[2] - date_bbox[0]
        date_text_height = date_bbox[3] - date_bbox[1]
        date_x = (width - date_width) // 2
        # Position date higher to avoid truncation, with more generous bottom margin
        date_y = height - margin - date_text_height - margin
        
        # Draw text with shadows
        shadow_offset = max(1, min(width, height) // 500)  # Adaptive shadow offset
        
        # Draw title
        draw.text((title_x + shadow_offset, title_y + shadow_offset), title, fill=(0, 0, 0, 128), font=title_font)
        draw.text((title_x, title_y), title, fill=style['text_color'], font=title_font)
        
        # Draw subtitle
        draw.text((subtitle_x + shadow_offset, subtitle_y + shadow_offset), subtitle, fill=(0, 0, 0, 100), font=subtitle_font)
        draw.text((subtitle_x, subtitle_y), subtitle, fill='white', font=subtitle_font)
        
        # Draw date
        draw.text((date_x + shadow_offset, date_y + shadow_offset), date_text, fill=(0, 0, 0, 100), font=date_font)
        draw.text((date_x, date_y), date_text, fill='white', font=date_font)
        
        filename = f'test_image_{image_count:02d}_{format_info["name"].lower().replace(" ", "_")}_{style["theme"].lower()}.jpg'
        file_path = os.path.join(photos_dir, filename)
        
        # Create EXIF data for this image
        exif_data = create_exif_data(photo_date, width, height, image_count)
        
        quality = 95 if width * height > 2000000 else 85
        
        # Save with EXIF data if available
        if EXIF_AVAILABLE and exif_data:
            img.save(file_path, 'JPEG', quality=quality, optimize=True, exif=exif_data)
            exif_status = "with EXIF"
        else:
            img.save(file_path, 'JPEG', quality=quality, optimize=True)
            exif_status = "no EXIF"
        
        # Set the file modification time to simulate different photo dates
        timestamp = photo_date.timestamp()
        os.utime(file_path, (timestamp, timestamp))
        
        print(f'✓ Created: {filename} ({width}×{height}) - Date: {photo_date.strftime("%Y-%m-%d")} [{exif_status}]')
        image_count += 1

print(f'\n🎉 {len(formats) * len(styles)} sample images created with different dates!')
print('Images span from 2020 to 2021+ with 45-day intervals between photos.')
print('File modification times simulate photo dates for testing EXIF functionality.')

if EXIF_AVAILABLE:
    print('\n📸 EXIF Data Features:')
    print('  • Realistic camera metadata (Canon, Nikon, Sony, Fujifilm, Olympus)')
    print('  • Camera settings (ISO, aperture, shutter speed, focal length)')
    print('  • Date/time information matching image content')
    print('  • GPS location data (every 3rd image: Paris, New York, Tokyo, London, Sydney)')
    print('  • Lens information and technical specifications')
else:
    print('\n⚠️  EXIF data not added - piexif library not installed')
    print('   Install with: pip install piexif')
    print('   Then re-run this script to add EXIF metadata')