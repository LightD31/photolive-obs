#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

photos_dir = './photos'
os.makedirs(photos_dir, exist_ok=True)

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

image_count = 1
for format_info in formats:
    for style in styles:
        width, height = format_info['width'], format_info['height']
        img = Image.new('RGB', (width, height), style['bg_color'])
        draw = ImageDraw.Draw(img)
        
        try:
            title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 60)
            subtitle_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 32)
        except:
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
        
        title = f'Test Image {image_count:02d}'
        bbox = draw.textbbox((0, 0), title, font=title_font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        title_x = (width - text_width) // 2
        title_y = height // 2 - text_height
        
        draw.text((title_x + 2, title_y + 2), title, fill=(0, 0, 0, 128), font=title_font)
        draw.text((title_x, title_y), title, fill=style['text_color'], font=title_font)
        
        subtitle = f"{format_info['name']} • {format_info['ratio']} • {style['theme']}"
        subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + text_height + 20
        
        draw.text((subtitle_x + 1, subtitle_y + 1), subtitle, fill=(0, 0, 0, 100), font=subtitle_font)
        draw.text((subtitle_x, subtitle_y), subtitle, fill='white', font=subtitle_font)
        
        filename = f'test_image_{image_count:02d}_{format_info["name"].lower().replace(" ", "_")}_{style["theme"].lower()}.jpg'
        quality = 95 if width * height > 2000000 else 85
        img.save(os.path.join(photos_dir, filename), 'JPEG', quality=quality, optimize=True)
        print(f'✓ Created: {filename} ({width}×{height})')
        image_count += 1

print(f'\n🎉 {len(formats) * len(styles)} sample images created!')