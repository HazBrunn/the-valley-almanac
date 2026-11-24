"""Generate the app's ORIGINAL pixel-art icons (an almanac book with a sprout).
Run: python3 scripts/make-icons.py  (needs Pillow). Output: public/icons/*.png, public/favicon.svg"""
from PIL import Image
import os

ART = [
    "................",
    "........GG......",
    ".......GLLG.....",
    "......GLLG......",
    ".....GG.GG......",
    "...WWWWSWWWWW...",
    "..WBBBBSBBBBBW..",
    "..WBPPPSPPPPBW..",
    "..WBPYYSPYYPBW..",
    "..WBPPPSPPPPBW..",
    "..WBPYYSPYYPBW..",
    "..WBPPPSPPPPBW..",
    "..WBBBBSBBBBBW..",
    "...WWWWWWWWWW...",
    "................",
    "................",
]
PAL = {"W": (74, 59, 45), "B": (139, 90, 60), "P": (251, 241, 220), "Y": (190, 144, 96), "S": (104, 84, 65), "G": (78, 120, 56), "L": (128, 168, 98)}
BG = (245, 236, 216)

def render(size, pad_frac):
    img = Image.new("RGBA", (size, size), BG + (255,))
    cell = int(size * (1 - 2 * pad_frac)) // 16
    off = (size - cell * 16) // 2
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            if ch in PAL:
                for dy in range(cell):
                    for dx in range(cell):
                        img.putpixel((off + x * cell + dx, off + y * cell + dy), PAL[ch] + (255,))
    return img

root = os.path.join(os.path.dirname(__file__), "..", "public")
render(192, 0.06).save(os.path.join(root, "icons", "icon-192.png"))
render(512, 0.06).save(os.path.join(root, "icons", "icon-512.png"))
render(512, 0.18).save(os.path.join(root, "icons", "icon-maskable-512.png"))
render(180, 0.08).save(os.path.join(root, "icons", "apple-touch-icon.png"))

rects = []
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        if ch in PAL:
            r, g, b = PAL[ch]
            rects.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="rgb({r},{g},{b})"/>')
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" rx="3" fill="rgb(245,236,216)"/>' + "".join(rects) + "</svg>"
open(os.path.join(root, "favicon.svg"), "w").write(svg)
print("icons written")
