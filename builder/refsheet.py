"""Reference sheet generator using Pillow.

Composites official variant art, misc items, character info, and color palette
into a styled reference-sheet PNG with a white/light background.

Called from builder.generator during the build pipeline.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .config import ROOT, FONT_PATH

# ---------- layout constants ----------
PAGE_BG = "#F0F0F0"
CARD_BG = "#FFFFFF"
CARD_BORDER = "#D8D8D8"
TEXT_DARK = "#1A1A1A"
TEXT_GRAY = "#666666"
TEXT_LIGHT = "#999999"

PAGE_WIDTH = 1600
PAD_OUTER = 32
PAD_INNER = 36
CONTENT_WIDTH = PAGE_WIDTH - 2 * (PAD_OUTER + PAD_INNER)

UPSCALE_THRESHOLD = 512
UPSCALE_FACTOR = 8

IMAGE_GAP = 24

SECTION_GAP = 20
HEADING_GAP = 14
TEXT_GAP = 6
LABEL_GAP = 12
PALETTE_GAP = 20

# ---------- helpers ----------


def _hex(name):
    v = name.lstrip("#")
    return tuple(int(v[i : i + 2], 16) for i in (0, 2, 4))


def _font(size):
    return ImageFont.truetype(str(FONT_PATH), size)


def _bbox_h(draw, text, font):
    return draw.textbbox((0, 0), text, font=font)[3]


def _text_w(draw, text, font):
    return draw.textbbox((0, 0), text, font=font)[2]


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


# ---------- layout helpers ----------


def _layout_group(imgs, labels, scale):
    """Scale all images by *scale*, then flow-wrap into rows.
    Each image keeps its own height.  Returns list of rows."""
    scaled = []
    for img, lbl in zip(imgs, labels):
        if scale < 1.0:
            nw = int(img.size[0] * scale)
            nh = int(img.size[1] * scale)
            img = img.resize((nw, nh), Image.NEAREST)
        scaled.append((lbl, img))

    rows = []
    cur_row = []
    cur_w = 0
    for lbl, img in scaled:
        iw = img.size[0]
        if cur_row and cur_w + IMAGE_GAP + iw > CONTENT_WIDTH:
            rows.append(cur_row)
            cur_row = []
            cur_w = 0
        cur_row.append((lbl, img))
        cur_w += iw + (IMAGE_GAP if len(cur_row) > 1 else 0)

    if cur_row:
        rows.append(cur_row)
    return rows


# ---------- main generator ----------


def generate(char_data, dry_run=False, log_fn=None):
    char_id = char_data.get("id", "")
    variants = char_data.get("variants", {})
    misc = char_data.get("misc", {})

    src_rel = f"characters/{char_id}/reference_sheet.png"
    out_path = ROOT / src_rel

    def _log(action, path, extra=""):
        if log_fn:
            log_fn(action, path, extra)

    if dry_run:
        _log("REFSHEET", src_rel, "(dry-run)")
        return src_rel

    # ---- fonts ---------------------------------------------------------
    f_title = _font(46)
    f_jpname = _font(30)
    f_section = _font(32)
    f_info = _font(24)
    f_label = _font(20)
    f_swatch_name = _font(19)
    f_swatch_hex = _font(16)

    # ---- colors --------------------------------------------------------
    accent = _hex(char_data.get("themeColor", "#6366f1"))
    c_bg = _hex(PAGE_BG)
    c_card = _hex(CARD_BG)
    c_border = _hex(CARD_BORDER)
    c_dark = _hex(TEXT_DARK)
    c_gray = _hex(TEXT_GRAY)
    c_light = _hex(TEXT_LIGHT)

    # ---- load all images (variants + misc) -----------------------------
    all_groups = []  # [(name, imgs, labels)]

    for vname in variants:
        vtypes = variants[vname]
        imgs = []
        labels = []
        for tname, entry in vtypes.items():
            src = entry.get("src", "")
            if not src:
                continue
            sp = ROOT / src
            if not sp.exists():
                continue
            imgs.append(_load_prep(sp))
            labels.append(_label_for(tname))
        if imgs:
            all_groups.append((vname.upper(), imgs, labels))

    for group_name, entries in misc.items():
        imgs = []
        labels = []
        for e in entries:
            src = e.get("src", "")
            if not src:
                continue
            if Path(src).suffix.lower() in (".mp4", ".webm"):
                continue
            sp = ROOT / src
            if not sp.exists():
                continue
            imgs.append(_load_prep(sp))
            label = e.get("label", {}).get("en", "")
            if not label:
                label = Path(src).stem.replace("_", " ").title()
            labels.append(label)
        if imgs:
            all_groups.append((group_name.upper(), imgs, labels))

    if not all_groups:
        return None

    # ---- compute global scale ------------------------------------------
    # Find the widest group (sum of image widths + gaps) and compute the
    # power-of-2 scale needed so that every group fits in one row.
    global_scale = 1.0
    for _gname, imgs, _labels in all_groups:
        total_w = sum(i.size[0] for i in imgs) + IMAGE_GAP * (len(imgs) - 1)
        s = 1.0
        while total_w * s > CONTENT_WIDTH:
            s /= 2
        if s < global_scale:
            global_scale = s

    # ---- layout all groups at global scale ------------------------------
    layout = []
    for gname, imgs, labels in all_groups:
        rows = _layout_group(imgs, labels, global_scale)
        layout.append((gname, rows))

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

    # all groups
    for gname, rows in layout:
        sh = _bbox_h(dd, gname, f_section)
        y += sh + HEADING_GAP
        for row in rows:
            row_h = max(i.size[1] for _, i in row) if row else 0
            y += row_h + LABEL_GAP + _bbox_h(dd, "Ag", f_label) + SECTION_GAP

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

    # ---- all groups ----------------------------------------------------
    for gname, rows in layout:
        draw.text((x, y), gname, fill=c_dark, font=f_section)
        y += _bbox_h(draw, gname, f_section) + HEADING_GAP

        for row in rows:
            row_h = max(i.size[1] for _, i in row)
            total_w = sum(i.size[0] for _, i in row) + IMAGE_GAP * (len(row) - 1)
            row_x = x + (CONTENT_WIDTH - total_w) // 2

            for label, img in row:
                img_w, img_h = img.size
                img_y = y + (row_h - img_h) // 2

                page.paste(img, (row_x, img_y), img)

                tw = _text_w(draw, label, f_label)
                draw.text(
                    (row_x + (img_w - tw) // 2, y + row_h + LABEL_GAP),
                    label,
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

                # name centered under swatch
                name_y = y + swatch_size + LABEL_GAP
                name_tw = _text_w(draw, name, f_swatch_name)
                draw.text(
                    (sw_x + (swatch_size - name_tw) // 2, name_y),
                    name,
                    fill=c_gray,
                    font=f_swatch_name,
                )

                # hex centered under name
                hex_tw = _text_w(draw, hex_val, f_swatch_hex)
                hex_y = name_y + _bbox_h(draw, name, f_swatch_name) + TEXT_GAP
                draw.text(
                    (sw_x + (swatch_size - hex_tw) // 2, hex_y),
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
