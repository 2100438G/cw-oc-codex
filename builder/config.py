import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

UPSCALE_THRESHOLD = 512
UPSCALE_FACTOR = 8
THUMB_SIZE = (200, 150)

SITE_DIR = ROOT / "_site"
ASSETS_DIR = SITE_DIR / "assets"
THUMB_DIR = ASSETS_DIR / "thumb"

STATIC_FILES = [
    "index.html",
    "style.css",
    "script.js",
    "character_index.txt",
    "lang.json",
    "favicon.ico",
    "favicon.svg",
]

IMAGE_EXTS = {".png"}
COPY_EXTS = {".jpg", ".jpeg", ".mp4", ".webm", ".gif", ".webp"}
THUMB_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

FONT_PATH = ROOT / "fonts" / "MPLUS1p-Bold.ttf"
CHARACTER_INDEX = ROOT / "character_index.txt"


def log(action: str, path: str, extra: str = "") -> None:
    msg = f"[{action:9s}] {path}"
    if extra:
        msg += f"  {extra}"
    print(msg)


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)
