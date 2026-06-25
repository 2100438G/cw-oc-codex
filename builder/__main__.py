"""Build pipeline orchestration for the Card Wars Codex site.

Modes
-----
python build.py            Full build (verbose log + summary).
python build.py --dry-run  Print the action log without writing files.
python build.py --verify   Only check every JSON src exists; report missing.
"""

import argparse
import shutil
import sys

from .config import ROOT, SITE_DIR, STATIC_FILES, CHARACTER_INDEX, log, read_json
from .generator import build_character_json


def clean_dirs(dry_run: bool) -> None:
    if dry_run:
        log("CLEAN", str(SITE_DIR.relative_to(ROOT)), "(skipped, dry-run)")
        return
    if SITE_DIR.exists():
        shutil.rmtree(SITE_DIR)
    SITE_DIR.mkdir(parents=True)
    log("CLEAN", str(SITE_DIR.relative_to(ROOT)))


def copy_static(dry_run: bool) -> int:
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


def run_build(dry_run: bool) -> int:
    import json

    clean_dirs(dry_run)

    if not CHARACTER_INDEX.exists():
        log("MISSING", str(CHARACTER_INDEX.relative_to(ROOT)), "(character_index.txt)")
        return 1

    char_ids = [line.strip() for line in CHARACTER_INDEX.read_text(encoding="utf-8").splitlines() if line.strip()]
    chars = []
    missing = 0

    for cid in char_ids:
        json_path = ROOT / "characters" / cid / f"{cid}.json"
        if not json_path.exists():
            log("MISSING", str(json_path.relative_to(ROOT)), f"(character json for {cid})")
            missing += 1
            continue
        char_data = read_json(json_path)
        chars.append({
            "id": cid,
            "name": char_data.get("name", {}),
            "themeColor": char_data.get("themeColor", "#6366f1"),
            "tagline": char_data.get("tagline")
        })
        print()
        log("CHAR", cid)
        m = build_character_json(cid, dry_run)
        missing += m

    if not dry_run:
        out = SITE_DIR / "characters.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8") as f:
            json.dump(chars, f, indent="\t", ensure_ascii=False)
        log("GEN", "characters.json", f"({len(chars)} characters)")

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
    from .pipeline import log as vlog

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
