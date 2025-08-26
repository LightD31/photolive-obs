#!/usr/bin/env python3
import os
import time
import datetime
import platform
from PIL import Image, ImageDraw, ImageFont

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
        
        quality = 95 if width * height > 2000000 else 85
        img.save(file_path, 'JPEG', quality=quality, optimize=True)
        
        # Set the file modification time to simulate different photo dates
        timestamp = photo_date.timestamp()
        os.utime(file_path, (timestamp, timestamp))
        
        print(f'✓ Created: {filename} ({width}×{height}) - Date: {photo_date.strftime("%Y-%m-%d")}')
        image_count += 1

print(f'\n🎉 {len(formats) * len(styles)} sample images created with different dates!')
print('Images span from 2020 to 2021+ with 45-day intervals between photos.')
print('File modification times simulate photo dates for testing EXIF functionality.')