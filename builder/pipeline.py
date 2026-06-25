import shutil
from pathlib import Path

from PIL import Image

from .config import (
    ROOT, ASSETS_DIR, THUMB_DIR,
    UPSCALE_THRESHOLD, UPSCALE_FACTOR, THUMB_SIZE,
    IMAGE_EXTS, COPY_EXTS, THUMB_EXTS,
    log,
)


def should_upscale(src_path: Path) -> bool:
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
    src_path = ROOT / src
    if not src_path.exists():
        log("MISSING", src)
        return None

    dst_path = ASSETS_DIR / dst_src
    thumb_path = THUMB_DIR / dst_src
    is_video = src_path.suffix.lower() == ".mp4"

    if is_video or src_path.suffix.lower() in COPY_EXTS or not should_upscale(src_path):
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
        if not is_video:
            make_thumbnail(src_path, thumb_path, pixel_art=False, dry_run=dry_run)
        return False

    with Image.open(src_path) as img:
        w, h = img.size
        new_size = (w * UPSCALE_FACTOR, h * UPSCALE_FACTOR)
        if not dry_run:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            img.resize(new_size, Image.Resampling.NEAREST).save(dst_path)
        log("UPSCALE", src, f"({w}x{h} -> {new_size[0]}x{new_size[1]})")

    if not dry_run:
        make_thumbnail(dst_path, thumb_path, pixel_art=True, dry_run=dry_run)
    else:
        if thumb_path.suffix.lower() in THUMB_EXTS:
            log("THUMB", str(dst_path.relative_to(ROOT)), f"({new_size[0]}x{new_size[1]} -> {THUMB_SIZE[0]}x{THUMB_SIZE[1]})")
    return True


def infer_type(src: str) -> str:
    ext = Path(src).suffix.lower()
    if ext in (".mp4", ".webm"):
        return "video"
    return "image"
