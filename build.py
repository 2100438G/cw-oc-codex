"""Build script for the Card Wars Codex site.

Generates a self-contained deployable site in _site/ from the source files
referenced by the character JSONs.

Modes
-----
python build.py            Full build (verbose log + summary).
python build.py --dry-run  Print the action log without writing files.
python build.py --verify   Only check every JSON src exists; report missing.

For each media entry in a character JSON:
  - PNG image with max(w, h) <= UPSCALE_THRESHOLD  -> 8x NEAREST upscale
  - Any other image / video                        -> copied as-is
  - Each image also gets a 200x150 thumbnail in assets/thumb/<src>
Each built JSON entry gains a "pixelArt" boolean used by the frontend.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent

UPSCALE_THRESHOLD = 512
UPSCALE_FACTOR = 8
THUMB_SIZE = (200, 150)

# All build output goes into _site/ (self-contained deploy folder).
# assets/ lives inside _site/ so local dev and production both serve the
# built JSONs (with the pixelArt flag) alongside the generated images.
SITE_DIR = ROOT / "_site"
ASSETS_DIR = SITE_DIR / "assets"
THUMB_DIR = ASSETS_DIR / "thumb"

# Files copied verbatim into _site/
STATIC_FILES = [
    "index.html",
    "style.css",
    "script.js",
    "characters.json",
    "favicon.ico",
    "favicon.svg",
]

# Source extensions treated as images that may be upscaled.
IMAGE_EXTS = {".png"}
# Extensions that are always copied (never upscaled).
COPY_EXTS = {".jpg", ".jpeg", ".mp4", ".webm", ".gif", ".webp"}
# Extensions that get a thumbnail (images only, not videos).
THUMB_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def log(action: str, path: str, extra: str = "") -> None:
    msg = f"[{action:9s}] {path}"
    if extra:
        msg += f"  {extra}"
    print(msg)


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def should_upscale(src_path: Path) -> bool:
    """True if the file is a small PNG that needs 8x NEAREST upscaling."""
    if src_path.suffix.lower() not in IMAGE_EXTS:
        return False
    try:
        with Image.open(src_path) as img:
            w, h = img.size
    except Exception as e:
        log("ERROR", str(src_path), f"cannot open: {e}")
        return False
    return max(w, h) <= UPSCALE_THRESHOLD


def make_thumbnail(src_path: Path, dst_path: Path, pixel_art: bool, dry_run: bool) -> None:
    """Generate a 200x150 thumbnail. NEAREST for pixel art, LANCZOS otherwise."""
    if src_path.suffix.lower() not in THUMB_EXTS:
        return
    try:
        with Image.open(src_path) as img:
            orig = img.size
            resample = Image.Resampling.NEAREST if pixel_art else Image.Resampling.LANCZOS
            if not dry_run:
                dst_path.parent.mkdir(parents=True, exist_ok=True)
                thumb = img.copy()
                thumb.thumbnail(THUMB_SIZE, resample)
                thumb.save(dst_path)
                thumb.close()
            log("THUMB", str(src_path.relative_to(ROOT)), f"({orig[0]}x{orig[1]} -> {THUMB_SIZE[0]}x{THUMB_SIZE[1]})")
    except Exception as e:
        log("ERROR", str(src_path), f"thumbnail failed: {e}")


def process_media_entry(src: str, dst_src: Path, dry_run: bool):
    """Process one image/video entry. Returns (pixelArt: bool) or None on failure."""
    src_path = ROOT / src
    if not src_path.exists():
        log("MISSING", src)
        return None

    dst_path = ASSETS_DIR / dst_src
    thumb_path = THUMB_DIR / dst_src
    is_video = src_path.suffix.lower() == ".mp4"

    if is_video or src_path.suffix.lower() in COPY_EXTS or not should_upscale(src_path):
        # Copy as-is (large image, JPG, video, etc.)
        if not dry_run:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_path, dst_path)
        if is_video:
            log("COPY", src, "(video)")
        else:
            try:
                with Image.open(src_path) as img:
                    sz = img.size
                log("COPY", src, f"({sz[0]}x{sz[1]})")
            except Exception:
                log("COPY", src)
        # Generate thumbnail for non-video images (use source file for thumb)
        if not is_video:
            make_thumbnail(src_path, thumb_path, pixel_art=False, dry_run=dry_run)
        return False

    # Upscale small pixel art PNGs, then thumbnail from the upscaled output.
    with Image.open(src_path) as img:
        w, h = img.size
        new_size = (w * UPSCALE_FACTOR, h * UPSCALE_FACTOR)
        if not dry_run:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            img.resize(new_size, Image.Resampling.NEAREST).save(dst_path)
        log("UPSCALE", src, f"({w}x{h} -> {new_size[0]}x{new_size[1]})")

    # Thumbnail from the upscaled output (so thumb matches the deployed asset).
    # In dry-run the upscaled file doesn't exist on disk, so log the expected
    # dimensions directly without opening a file.
    if not dry_run:
        make_thumbnail(dst_path, thumb_path, pixel_art=True, dry_run=dry_run)
    else:
        if thumb_path.suffix.lower() in THUMB_EXTS:
            log("THUMB", str(dst_path.relative_to(ROOT)), f"({new_size[0]}x{new_size[1]} -> {THUMB_SIZE[0]}x{THUMB_SIZE[1]})")
    return True


def build_character_json(char_id: str, dry_run: bool) -> int:
    """Process one character. Returns count of MISSING entries."""
    json_path = ROOT / "characters" / char_id / f"{char_id}.json"
    if not json_path.exists():
        log("MISSING", str(json_path.relative_to(ROOT)), "(character json)")
        return 1

    data = read_json(json_path)
    missing = 0
    media_fields = ["images", "videos"]
    for field in media_fields:
        entries = data.get(field, []) or []
        for entry in entries:
            src = entry.get("src")
            if not src:
                continue
            # dst_src is the path relative to assets/ that mirrors the source path
            dst_src = Path(src)
            result = process_media_entry(src, dst_src, dry_run)
            if result is None:
                missing += 1
                entry["pixelArt"] = False
            else:
                entry["pixelArt"] = result

    # Write built JSON to _site/characters/<id>/<id>.json
    if not dry_run:
        out_json = SITE_DIR / "characters" / char_id / f"{char_id}.json"
        out_json.parent.mkdir(parents=True, exist_ok=True)
        with out_json.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent="\t", ensure_ascii=False)
    return missing


def copy_static(dry_run: bool) -> int:
    """Copy static files into _site/. Returns count of missing."""
    missing = 0
    for name in STATIC_FILES:
        src = ROOT / name
        if not src.exists():
            log("MISSING", name, "(static)")
            missing += 1
            continue
        if not dry_run:
            dst = SITE_DIR / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        log("COPY", name, "(static)")
    return missing


def clean_dirs(dry_run: bool) -> None:
    if dry_run:
        log("CLEAN", str(SITE_DIR.relative_to(ROOT)), "(skipped, dry-run)")
        return
    if SITE_DIR.exists():
        shutil.rmtree(SITE_DIR)
    SITE_DIR.mkdir(parents=True)
    log("CLEAN", str(SITE_DIR.relative_to(ROOT)))


# --------------------------------------------------------------------------
# Modes
# --------------------------------------------------------------------------
def run_build(dry_run: bool) -> int:
    clean_dirs(dry_run)

    chars = read_json(ROOT / "characters.json")
    upscaled = 0
    copied = 0
    missing = 0

    for char in chars:
        cid = char["id"]
        print()
        log("CHAR", cid)
        m = build_character_json(cid, dry_run)
        missing += m

    print()
    missing += copy_static(dry_run)

    print()
    print("=" * 60)
    mode = "DRY-RUN" if dry_run else "BUILD"
    print(f"{mode} complete: {missing} missing")
    if missing > 0:
        print("See [MISSING] entries above.")
    return 1 if missing > 0 else 0


def run_verify() -> int:
    chars = read_json(ROOT / "characters.json")
    missing = 0
    for char in chars:
        cid = char["id"]
        json_path = ROOT / "characters" / cid / f"{cid}.json"
        if not json_path.exists():
            log("MISSING", str(json_path.relative_to(ROOT)), "(character json)")
            missing += 1
            continue
        data = read_json(json_path)
        for field in ["images", "videos"]:
            for entry in data.get(field, []) or []:
                src = entry.get("src")
                if not src:
                    continue
                src_path = ROOT / src
                if not src_path.exists():
                    log("MISSING", src)
                    missing += 1
                else:
                    log("OK", src)
    print()
    print("=" * 60)
    print(f"VERIFY complete: {missing} missing")
    return 1 if missing > 0 else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Card Wars Codex site.")
    parser.add_argument(
        "--dry-run", action="store_true", help="Print actions without writing files."
    )
    parser.add_argument(
        "--verify", action="store_true", help="Only check that all JSON src files exist."
    )
    args = parser.parse_args()

    if args.verify:
        return run_verify()

    return run_build(dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
