"""
Generates the PWA icons in public/icons/ from public/trybemarket.png.

    python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow
    /tmp/venv/bin/python scripts/generate-pwa-icons.py

The source logo is a yellow disc on a transparent 512x512 canvas with wide
padding, so it is cropped to the disc first. Outputs:

  icon-192.png / icon-512.png   purpose "any"      disc on transparent background
  icon-maskable-512.png         purpose "maskable" disc on a solid brand-yellow square,
                                inside the 80% safe zone (Android crops it to a circle,
                                squircle, etc. and must not clip the figures)
  apple-touch-icon.png (180)    opaque — iOS renders transparency as black
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "trybemarket.png"
OUT = ROOT / "public" / "icons"


def brand_yellow(disc):
    # The disc's own flat colour, sampled just inside its edge, so the solid
    # square background is indistinguishable from it.
    w, h = disc.size
    return disc.getpixel((int(w * 0.5), int(h * 0.06)))[:3] + (255,)


def on_square(disc, size, disc_fraction, background):
    canvas = Image.new("RGBA", (size, size), background)
    d = round(size * disc_fraction)
    scaled = disc.resize((d, d), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - d) // 2, (size - d) // 2))
    return canvas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    logo = Image.open(SRC).convert("RGBA")
    disc = logo.crop(logo.getchannel("A").getbbox())
    yellow = brand_yellow(disc)

    for size in (192, 512):
        on_square(disc, size, 0.94, (0, 0, 0, 0)).save(OUT / f"icon-{size}.png", optimize=True)

    on_square(disc, 512, 0.68, yellow).save(OUT / "icon-maskable-512.png", optimize=True)
    on_square(disc, 180, 0.80, yellow).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
    print("wrote", ", ".join(sorted(p.name for p in OUT.iterdir())))


if __name__ == "__main__":
    main()
