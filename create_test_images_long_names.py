#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

photos_dir = './photos'
os.makedirs(photos_dir, exist_ok=True)

# Create test images with very long filenames to test overflow
long_filenames = [
    'this_is_a_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_very_long_filename_that_should_cause_overflow_issues_in_the_preview_section_001.jpg',
    'another_extremely_long_filename_with_lots_of_descriptive_text_that_goes_on_and_on_and_on_and_should_definitely_overflow_the_preview_container_002.jpg',
    'super_duper_mega_ultra_extremely_incredibly_ridiculously_long_filename_that_would_break_any_ui_component_that_does_not_handle_text_overflow_properly_003.jpg',
    'short_name.jpg',
    'medium_length_filename_with_some_descriptive_text.jpg'
]

colors = [
    (52, 152, 219),  # Blue
    (46, 204, 113),  # Green
    (231, 76, 60),   # Red
    (155, 89, 182),  # Purple
    (241, 196, 15)   # Yellow
]

for i, filename in enumerate(long_filenames):
    width, height = 1920, 1080
    color = colors[i % len(colors)]
    
    img = Image.new('RGB', (width, height), color)
    draw = ImageDraw.Draw(img)
    
    try:
        title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 60)
        subtitle_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 32)
    except:
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
    
    title = f'Test Image {i+1:02d}'
    bbox = draw.textbbox((0, 0), title, font=title_font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    title_x = (width - text_width) // 2
    title_y = height // 2 - text_height
    
    # Add shadow
    draw.text((title_x + 2, title_y + 2), title, fill=(0, 0, 0, 128), font=title_font)
    draw.text((title_x, title_y), title, fill=(255, 255, 255), font=title_font)
    
    # Add filename as subtitle
    display_name = filename[:50] + "..." if len(filename) > 50 else filename
    subtitle = f"Filename: {display_name}"
    subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_x = (width - subtitle_width) // 2
    subtitle_y = title_y + text_height + 20
    
    draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, fill=(0, 0, 0, 100), font=subtitle_font)
    draw.text((subtitle_x, subtitle_y), subtitle, fill='white', font=subtitle_font)
    
    filepath = os.path.join(photos_dir, filename)
    img.save(filepath, 'JPEG', quality=95, optimize=True)
    print(f'✓ Created: {filename} ({len(filename)} chars)')

print(f'\n🎉 {len(long_filenames)} test images with long filenames created!')