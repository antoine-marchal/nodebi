"""Generate the NodeBI application icon from the ProductMark geometry."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
MASTER_SIZE = 1024
ICON_SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)

PRIMARY = "#e4002b"
PRIMARY_LIGHT = "#ff4d6b"


def asymmetric_rounded_rectangle(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    radii: tuple[int, int, int, int],
    fill: str,
) -> None:
    """Draw a rectangle with independent TL, TR, BR, BL corner radii."""
    left, top, right, bottom = box
    tl, tr, br, bl = radii
    width, height = right - left + 1, bottom - top + 1
    mask = Image.new("L", (width, height), 0)
    pixels = mask.load()

    for y in range(height):
        for x in range(width):
            inside = True
            if x < tl and y < tl:
                inside = (x - tl) ** 2 + (y - tl) ** 2 <= tl**2
            elif x >= width - tr and y < tr:
                inside = (x - (width - tr - 1)) ** 2 + (y - tr) ** 2 <= tr**2
            elif x >= width - br and y >= height - br:
                inside = (x - (width - br - 1)) ** 2 + (y - (height - br - 1)) ** 2 <= br**2
            elif x < bl and y >= height - bl:
                inside = (x - bl) ** 2 + (y - (height - bl - 1)) ** 2 <= bl**2
            if inside:
                pixels[x, y] = 255

    solid = Image.new("RGBA", (width, height), fill)
    draw._image.paste(solid, (left, top), mask)


def make_master() -> Image.Image:
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # ProductMark is a 30 px square: 13.5 px tiles separated by a 3 px gap.
    padding = 96
    gap = 96
    tile = (MASTER_SIZE - 2 * padding - gap) // 2
    small_radius = 18
    large_radius = 96
    positions = (
        (padding, padding),
        (padding + tile + gap, padding),
        (padding, padding + tile + gap),
        (padding + tile + gap, padding + tile + gap),
    )

    for index, (x, y) in enumerate(positions):
        alternating = (large_radius, small_radius, large_radius, small_radius)
        mirrored = (small_radius, large_radius, small_radius, large_radius)
        radii = alternating if index in (0, 3) else mirrored
        color = PRIMARY_LIGHT if index == 1 else PRIMARY
        asymmetric_rounded_rectangle(draw, (x, y, x + tile, y + tile), radii, color)

    return image


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    master = make_master()
    png = master.resize((512, 512), Image.Resampling.LANCZOS)
    png.save(ASSETS / "nodebi-icon.png", optimize=True)
    master.save(ASSETS / "nodebi.ico", format="ICO", sizes=[(size, size) for size in ICON_SIZES])


if __name__ == "__main__":
    main()
