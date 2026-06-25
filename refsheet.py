"""Reference sheet generator using Pillow.

Composites official variant art, character info, and color palette into a
styled reference-sheet PNG with a white/light background.

Called from build.py during the build pipeline.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent

# ---------- layout constants ----------
PAGE_BG = "#F0F0F0"
CARD_BG = "#FFFFFF"
CARD_BORDER = "#D8D8D8"
TEXT_DARK = "#1A1A1A"
TEXT_GRAY = "#666666"
TEXT_LIGHT = "#999999"

PAGE_WIDTH = 1600
PAD_OUTER = 80
PAD_INNER = 60
CONTENT_WIDTH = PAGE_WIDTH - 2 * (PAD_OUTER + PAD_INNER)

UPSCALE_THRESHOLD = 512
UPSCALE_FACTOR = 8

IMAGE_GAP = 40

SECTION_GAP = 48
HEADING_GAP = 28
TEXT_GAP = 10
LABEL_GAP = 20
PALETTE_GAP = 32

# ---------- helpers ----------


def _hex(name):
    v = name.lstrip("#")
    return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4))


_FONT_CACHE = {}


def _load_font(size, bold=False, cjk=False):
    key = (size, bold, cjk)
    cached = _FONT_CACHE.get(key)
    if cached:
        return cached

    if cjk:
        candidates = [
            "C:/Windows/Fonts/meiryob.ttc",
            "C:/Windows/Fonts/meiryo.ttc",
            "C:/Windows/Fonts/msgothic.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        ]
    elif bold:
        candidates = [
            "C:/Windows/Fonts/arialbd.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ]
    else:
        candidates = [
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]

    for p in candidates:
        if Path(p).exists():
            font = ImageFont.truetype(p, size)
            _FONT_CACHE[key] = font
            return font

    font = ImageFont.load_default()
    _FONT_CACHE[key] = font
    return font


def _bbox_h(draw, text, font):
    return draw.textbbox((0, 0), text, font=font)[3]


def _label_for(tname):
    return tname.replace("_", " ").title()


# ---------- image loading ----------


def _load_prep(src_path):
    """Open and 8x NEAREST upscale if pixel art.  No further rescaling."""
    img = Image.open(src_path).convert("RGBA")
    if max(img.size) <= UPSCALE_THRESHOLD:
        w, h = img.size
        img = img.resize((w * UPSCALE_FACTOR, h * UPSCALE_FACTOR), Image.NEAREST)
    return img


# ---------- main generator ----------


def generate(char_data, dry_run=False, log_fn=None):
    char_id = char_data.get("id", "")
    variants = char_data.get("variants", {})
    if not variants:
        return None

    src_rel = f"characters/{char_id}/reference_sheet.png"
    out_path = ROOT / src_rel

    def _log(action, path, extra=""):
        if log_fn:
            log_fn(action, path, extra)

    if dry_run:
        _log("REFSHEET", src_rel, "(dry-run)")
        return src_rel

    # ---- fonts (all bold for readability) ------------------------------
    f_title = _load_font(46, bold=True)
    f_jpname = _load_font(30, cjk=True)
    f_section = _load_font(32, bold=True)
    f_info = _load_font(24, bold=True)
    f_label = _load_font(20, bold=True)
    f_swatch_name = _load_font(19, bold=True)
    f_swatch_hex = _load_font(16, bold=True)

    # ---- colors --------------------------------------------------------
    accent = _hex(char_data.get("themeColor", "#6366f1"))
    c_bg = _hex(PAGE_BG)
    c_card = _hex(CARD_BG)
    c_border = _hex(CARD_BORDER)
    c_dark = _hex(TEXT_DARK)
    c_gray = _hex(TEXT_GRAY)
    c_light = _hex(TEXT_LIGHT)

    # ---- load variant images (8x upscale only) -------------------------
    vimgs = {}
    all_missing = True
    for vname, vtypes in variants.items():
        for tname, entry in vtypes.items():
            src = entry.get("src", "")
            if not src:
                continue
            sp = ROOT / src
            if not sp.exists():
                continue
            all_missing = False
            vimgs[(vname, tname)] = _load_prep(sp)

    if all_missing:
        return None

    # ---- build variant blocks ------------------------------------------
    var_blocks = []
    for vname in variants:
        keys = [(vname, t) for t in variants[vname].keys() if (vname, t) in vimgs]
        if not keys:
            continue

        imgs = [vimgs[k] for k in keys]
        total_w = sum(i.width for i in imgs) + IMAGE_GAP * (len(imgs) - 1)

        # Scale row down by powers of 1/2 until it fits content width.
        # This keeps pixel blocks at integer sizes (4×4, 2×2, etc.)
        scale = 1.0
        while total_w * scale > CONTENT_WIDTH:
            scale /= 2

        row_imgs = []
        for img in imgs:
            if scale < 1.0:
                nw = int(img.width * scale)
                nh = int(img.height * scale)
                row_imgs.append(img.resize((nw, nh), Image.NEAREST))
            else:
                row_imgs.append(img)

        var_blocks.append((vname, keys, row_imgs))

    # ---- palette data --------------------------------------------------
    palette = char_data.get("colorPalette", {})
    primary = palette.get("primary", [])
    secondary = palette.get("secondary", [])

    # ---- measure layout height -----------------------------------------
    page_dummy = Image.new("RGBA", (PAGE_WIDTH, 100))
    dd = ImageDraw.Draw(page_dummy)

    y = 0

    # header
    y += _bbox_h(dd, char_data["name"]["en"], f_title) + TEXT_GAP
    y += _bbox_h(dd, char_data["name"]["jp"], f_jpname) + HEADING_GAP + 3 + HEADING_GAP
    y += _bbox_h(dd, "Ag", f_info) + SECTION_GAP

    # variant sections
    for vname, _keys, row_imgs in var_blocks:
        sh = _bbox_h(dd, vname.upper() + " VARIANT", f_section)
        row_h = max(i.height for i in row_imgs) if row_imgs else 0
        lbl_h = _bbox_h(dd, "Ag", f_label)
        y += sh + HEADING_GAP + row_h + LABEL_GAP + lbl_h + SECTION_GAP

    # palette
    if primary or secondary:
        y += _bbox_h(dd, "COLOR PALETTE", f_section) + HEADING_GAP
        for pal_row, _pname in [(primary, "PRIMARY"), (secondary, "SECONDARY")]:
            if not pal_row:
                continue
            swatch_size = 44
            swatch_text_h = _bbox_h(dd, "Ag", f_swatch_name) + TEXT_GAP + _bbox_h(dd, "Ag", f_swatch_hex)
            lbl_h = _bbox_h(dd, "Ag", f_label)
            y += lbl_h + TEXT_GAP + swatch_size + LABEL_GAP + swatch_text_h + PALETTE_GAP

    y += PAD_INNER

    card_h = y
    page_h = card_h + 2 * PAD_OUTER

    # ---- draw ----------------------------------------------------------
    page = Image.new("RGBA", (PAGE_WIDTH, page_h), c_bg)
    draw = ImageDraw.Draw(page)

    cx0, cy0 = PAD_OUTER, PAD_OUTER
    cx1, cy1 = PAGE_WIDTH - PAD_OUTER, PAD_OUTER + card_h
    draw.rectangle([cx0, cy0, cx1, cy1], fill=c_card, outline=c_border, width=1)

    x = PAD_OUTER + PAD_INNER
    y = PAD_OUTER + PAD_INNER

    # ---- header --------------------------------------------------------
    name_en = char_data["name"]["en"]
    name_jp = char_data["name"]["jp"]
    draw.text((x, y), name_en, fill=accent, font=f_title)
    y += _bbox_h(draw, name_en, f_title) + TEXT_GAP

    draw.text((x, y), name_jp, fill=c_gray, font=f_jpname)
    y += _bbox_h(draw, name_jp, f_jpname) + HEADING_GAP

    draw.line([(x, y), (x + 200, y)], fill=accent, width=3)
    y += HEADING_GAP

    age = char_data.get("age", "")
    height = char_data.get("height", "")
    parts = []
    if age:
        parts.append(f"Age  {age}")
    if height:
        parts.append(f"Ht   {height}")
    if parts:
        info = "  \u00b7  ".join(parts)
        draw.text((x, y), info, fill=c_gray, font=f_info)
        y += _bbox_h(draw, info, f_info)

    y += SECTION_GAP

    # ---- variant sections ----------------------------------------------
    for vname, keys, row_imgs in var_blocks:
        section_label = vname.upper() + " VARIANT"
        draw.text((x, y), section_label, fill=c_dark, font=f_section)
        y += _bbox_h(draw, section_label, f_section) + HEADING_GAP

        row_h = max(i.height for i in row_imgs)
        total_w = sum(i.width for i in row_imgs) + IMAGE_GAP * (len(row_imgs) - 1)
        row_x = x + (CONTENT_WIDTH - total_w) // 2

        for idx, img in enumerate(row_imgs):
            key = keys[idx]
            img_w, img_h = img.size

            # center image vertically within row height
            img_y = y + (row_h - img_h) // 2

            page.paste(img, (row_x, img_y), img)

            # type label centered below the row
            tname = key[1]
            tlbl = _label_for(tname)
            tw = draw.textbbox((0, 0), tlbl, font=f_label)[2]
            draw.text(
                (row_x + (img_w - tw) // 2, y + row_h + LABEL_GAP),
                tlbl,
                fill=c_light,
                font=f_label,
            )

            row_x += img_w + IMAGE_GAP

        y += row_h + LABEL_GAP + _bbox_h(draw, "Ag", f_label) + SECTION_GAP

    # ---- color palette -------------------------------------------------
    if primary or secondary:
        draw.text((x, y), "COLOR PALETTE", fill=c_dark, font=f_section)
        y += _bbox_h(draw, "COLOR PALETTE", f_section) + HEADING_GAP

        swatch_size = 44

        for pal_row, pname in [(primary, "PRIMARY"), (secondary, "SECONDARY")]:
            if not pal_row:
                continue

            draw.text((x, y), pname, fill=c_gray, font=f_label)
            y += _bbox_h(draw, pname, f_label) + TEXT_GAP

            sw_x = x
            for color in pal_row:
                hex_val = color["hex"]
                rgb = _hex(hex_val)
                name = color["name"]

                draw.rectangle(
                    [sw_x, y, sw_x + swatch_size, y + swatch_size],
                    fill=rgb,
                    outline=c_border,
                    width=1,
                )

                # name on line below swatch
                name_y = y + swatch_size + LABEL_GAP
                draw.text((sw_x, name_y), name, fill=c_gray, font=f_swatch_name)

                # hex on line below name
                hex_tw = draw.textbbox((0, 0), hex_val, font=f_swatch_hex)[2]
                hex_y = name_y + _bbox_h(draw, name, f_swatch_name) + TEXT_GAP
                draw.text(
                    (sw_x + swatch_size - hex_tw, hex_y),
                    hex_val,
                    fill=c_light,
                    font=f_swatch_hex,
                )

                sw_x += swatch_size + 130

            deepest = y + swatch_size + LABEL_GAP + _bbox_h(draw, "Ag", f_swatch_name) + TEXT_GAP + _bbox_h(draw, "Ag", f_swatch_hex)
            y = max(y, deepest) + PALETTE_GAP

    # ---- save ----------------------------------------------------------
    out_path.parent.mkdir(parents=True, exist_ok=True)
    page = page.convert("RGB")
    page.save(out_path, "PNG")
    _log("REFSHEET", src_rel, f"({PAGE_WIDTH}x{page_h})")
    return src_rel
