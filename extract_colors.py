from PIL import Image
from collections import Counter

def get_dominant_colors(image_path, num_colors=5):
    try:
        image = Image.open(image_path)
        image = image.convert("RGB")
        image = image.resize((150, 150))  # Resize to speed up processing
        pixels = list(image.getdata())
        
        # Filter out near-white and near-black pixels to find the colors
        filtered_pixels = [
            p for p in pixels 
            if not (p[0] > 240 and p[1] > 240 and p[2] > 240) and # Not white
               not (p[0] < 15 and p[1] < 15 and p[2] < 15)        # Not black
        ]
        
        counts = Counter(filtered_pixels)
        dominant = counts.most_common(num_colors)
        
        print(f"Dominant colors in {image_path}:")
        for color, count in dominant:
            hex_color = '#{:02x}{:02x}{:02x}'.format(color[0], color[1], color[2])
            print(f"- {hex_color} (RGB: {color}) - Count: {count}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_dominant_colors("public/brand/logo.png")
