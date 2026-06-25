import json
from pathlib import Path

from . import refsheet
from .config import ROOT, SITE_DIR, log, read_json
from .pipeline import process_media_entry, infer_type


def flatten_assets(data: dict) -> list:
    char_id = data.get("id", "")

    if "assets" in data and isinstance(data["assets"], list):
        return data["assets"]

    assets = []

    main = data.get("main")
    if main and main.get("src"):
        assets.append({
            "type": infer_type(main["src"]),
            "src": main["src"],
            "label": main.get("label", {}),
            "category": "official",
        })

    variants = data.get("variants", {})
    for _vname, vtypes in variants.items():
        for _tname, entry in vtypes.items():
            if entry.get("src"):
                item = {
                    "type": infer_type(entry["src"]),
                    "src": entry["src"],
                    "label": entry.get("label", {}),
                    "category": "official",
                }
                if entry.get("omit_website"):
                    item["omit_website"] = True
                assets.append(item)

    misc = data.get("misc", {})
    for _group, entries in misc.items():
        for entry in entries:
            if entry.get("src"):
                item = {
                    "type": infer_type(entry["src"]),
                    "src": entry["src"],
                    "label": entry.get("label", {}),
                    "category": "other",
                }
                if entry.get("omit_website"):
                    item["omit_website"] = True
                assets.append(item)

    gallery = data.get("gallery", [])
    for entry in gallery:
        if entry.get("src"):
            item = {
                "type": infer_type(entry["src"]),
                "src": entry["src"],
                "label": entry.get("label", {}),
                "category": "skeb",
            }
            if entry.get("artist"):
                item["artist"] = entry["artist"]
            if entry.get("omit_website"):
                item["omit_website"] = True
            assets.append(item)

    ref_path = ROOT / f"characters/{char_id}/reference_art.png"
    if ref_path.exists():
        assets.append({
            "type": "image",
            "src": f"characters/{char_id}/reference_art.png",
            "label": {"en": "Reference Sheet", "jp": "参考資料"},
            "category": "reference",
        })

    return assets


def build_character_json(char_id: str, dry_run: bool) -> int:
    json_path = ROOT / "characters" / char_id / f"{char_id}.json"
    if not json_path.exists():
        log("MISSING", str(json_path.relative_to(ROOT)), "(character json)")
        return 1

    data = read_json(json_path)
    data["assets"] = flatten_assets(data)

    refsheet_src = refsheet.generate(data, dry_run=dry_run, log_fn=log)
    if refsheet_src:
        existing_refs = {e["src"] for e in data["assets"]}
        if refsheet_src not in existing_refs:
            data["assets"].append({
                "type": "image",
                "src": refsheet_src,
                "label": {"en": "Reference Sheet (Auto)", "jp": "参考資料 (自動)"},
                "category": "reference",
                "omit_website": True,
            })

    missing = 0
    for entry in data["assets"]:
        src = entry.get("src")
        if not src:
            continue
        dst_src = Path(src)
        result = process_media_entry(src, dst_src, dry_run)
        if result is None:
            missing += 1
            entry["pixelArt"] = False
        else:
            entry["pixelArt"] = result

    data["assets"] = [e for e in data["assets"] if not e.get("omit_website")]

    if not dry_run:
        out_json = SITE_DIR / "characters" / char_id / f"{char_id}.json"
        out_json.parent.mkdir(parents=True, exist_ok=True)
        with out_json.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent="\t", ensure_ascii=False)
    return missing
