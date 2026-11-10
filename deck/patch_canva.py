"""
Patch the Canva-exported HeatShield deck.

Constraint from Sahil: keep the background theme and the existing elements as
they are. So nothing here restyles the deck — the cream ground, the navy/orange
palette, the icon sets, the ellipse banner and every section layout are
untouched. What changes is text that was wrong, numbers that were invented,
alignment that was ragged, and two images whose *content* misrepresented the
product.

Technique: cover the old text by pasting back the slide's own background
pixels, then draw the replacement in the same font, size and colour. Redaction
is avoided because apply_redactions() also strips vector art sharing the rect.
"""
import io
import os
import sys

import fitz

SRC = r"C:/Users/Sahil/Downloads/Heatshield ppt 1.pdf"
FONTS = sys.argv[1] if len(sys.argv) > 1 else "fonts"
OUT = sys.argv[2] if len(sys.argv) > 2 else "HeatShield-deck-fixed.pdf"
ASSETS = sys.argv[3] if len(sys.argv) > 3 else "assets"

# Sampled straight out of the deck so nothing shifts hue.
NAVY = (0x00 / 255, 0x16 / 255, 0x3D / 255)
NAVY2 = (0x00 / 255, 0x23 / 255, 0x52 / 255)
NAVY3 = (0x00 / 255, 0x2F / 255, 0x69 / 255)
NAVY4 = (0x00 / 255, 0x16 / 255, 0x47 / 255)
ORANGE = (0xF0 / 255, 0x8A / 255, 0x24 / 255)
WHITE = (1, 1, 1)

F = {
    "reg": os.path.join(FONTS, "Roboto-Regular.ttf"),
    "bold": os.path.join(FONTS, "Roboto-Bold.ttf"),
    "med": os.path.join(FONTS, "Roboto-Medium.ttf"),
    "saira": os.path.join(FONTS, "SairaCondensed-Bold.ttf"),
    "serif": os.path.join(FONTS, "NotoSerif.ttf"),
}
FN = {"reg": "Frg", "bold": "Fbd", "med": "Fmd", "saira": "Fsa", "serif": "Fse"}

_BG = {}

# A pristine copy, used only for locating text. Redaction removes glyphs from
# the working document, so lookups must come from somewhere untouched —
# positions are identical because redaction never reflows anything.
REF = None


def strip_text(page, rects):
    """
    Delete the underlying text objects, not just paint over them.

    Covering alone left the originals in the content stream: the page numbers
    extracted as "2
3", and "Your paragraph" was still in the file. Invisible
    on screen, but it comes straight back if the PDF is converted to PPTX.
    images/graphics are preserved so the icons, ellipse and photos survive.
    """
    for r in rects:
        page.add_redact_annot(r)
    if rects:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                              text=fitz.PDF_REDACT_TEXT_REMOVE)


def _page_bg(page):
    """The full-bleed artwork sitting under everything on this slide."""
    if page.number in _BG:
        return _BG[page.number]
    xref = None
    for im in page.get_image_info(xrefs=True):
        b = fitz.Rect(im["bbox"])
        if b.width > page.rect.width * 0.98 and b.height > page.rect.height * 0.98:
            xref = im["xref"]
    if xref is None:
        _BG[page.number] = None
        return None
    from PIL import Image
    pix = fitz.Pixmap(page.parent, xref)
    if pix.n > 3:
        pix = fitz.Pixmap(fitz.csRGB, pix)
    _BG[page.number] = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    return _BG[page.number]


def cover(page, rect, pad=1.0, solid=None):
    """
    Blank a region by pasting back the slide's own background.

    A flat fill was the first attempt; it left a visible rectangle wherever a
    decorative blob or gradient sat underneath. Cropping the real background is
    exact, which is what keeps the theme untouched.
    """
    r = fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad)
    if solid is not None:
        # Text sitting on a white card: pasting the slide background would
        # stamp a cream rectangle into the middle of the card.
        page.draw_rect(r, color=solid, fill=solid, width=0)
        return
    img = _page_bg(page)
    if img is None:
        pix = page.get_pixmap(clip=fitz.Rect(r.x1 + 4, r.y0, r.x1 + 5, r.y0 + 1))
        c = tuple(v / 255 for v in pix.pixel(0, 0)[:3])
        page.draw_rect(r, color=c, fill=c, width=0)
        return
    sx, sy = img.width / page.rect.width, img.height / page.rect.height
    box = (max(0, int(r.x0 * sx)), max(0, int(r.y0 * sy)),
           min(img.width, int(r.x1 * sx) + 1), min(img.height, int(r.y1 * sy) + 1))
    buf = io.BytesIO()
    img.crop(box).save(buf, format="PNG")
    page.insert_image(r, stream=buf.getvalue(), overlay=True)


# fitz.get_text_length() only knows the built-in fonts; measuring the real TTF
# is the only way the bold/regular runs line up.
_FONTOBJ = {}


def _fontobj(font):
    if font not in _FONTOBJ:
        _FONTOBJ[font] = fitz.Font(fontfile=F[font])
    return _FONTOBJ[font]


def tw(text, font, size):
    return _fontobj(font).text_length(text, fontsize=size)


def draw(page, x, baseline, text, font, size, colour):
    page.insert_text((x, baseline), text, fontfile=F[font], fontname=FN[font],
                     fontsize=size, color=colour)
    return x + tw(text, font, size)


def runs(page, x, baseline, parts, size, colour, base="reg"):
    """Draw one line made of [(text, 'reg'|'bold'), ...] runs."""
    for text, weight in parts:
        x = draw(page, x, baseline, text, weight or base, size, colour)
    return x


def line_rect(page, text, occurrence=0):
    src = REF[page.number] if REF is not None else page
    h = src.search_for(text)
    return h[occurrence] if h else None


def emphasise(page, text, parts, size, colour, pad=2.0, dx=0.0, dy=0.0, fit=False,
              solid=None, tpad=9.0):
    """
    Re-set an existing line with only the important words in bold.

    `fit` shrinks the size until the new line is no wider than the old one —
    needed where the substitute face is wider than the embedded original (the
    deck uses a condensed serif this machine does not have).
    """
    r = line_rect(page, text)
    if r is None:
        print(f"    !! not found: {text[:50]!r}")
        return
    if fit:
        target = r.width
        while size > 6 and sum(tw(t, w, size) for t, w in parts) > target:
            size -= 0.25
    # Cover the wider of old and new, and clear the full line height. A tight
    # box clipped ascenders and left the tail of the longer original visible.
    new_w = sum(tw(t, w, size) for t, w in parts)
    box = fitz.Rect(r.x0 - 6, r.y0 - tpad, r.x0 + max(r.width, new_w) + 16, r.y1 + 7)
    cover(page, box, pad=pad, solid=solid)
    runs(page, r.x0 + dx, r.y1 - size * 0.215 + dy, parts, size, colour)


def _tokens(para):
    """
    Flatten [(text, weight)] runs into [(word, weight, space_before)].

    Tracking the space separately is what stops a run boundary from injecting
    a space before punctuation — "blind" + ", when" must not become "blind ,".
    """
    out, pending = [], False
    for text, weight in para:
        parts = text.split(" ")
        for i, part in enumerate(parts):
            if part == "":
                pending = True
                continue
            out.append((part, weight, pending or i > 0))
            pending = False
        if text.endswith(" "):
            pending = True
    return out


def bullet_block(page, rect, paras, size, colour, leading, bullet_dx=26.0,
                 text_dx=48.0, para_gap=7.0):
    """
    Re-typeset a bulleted block with only the important words in bold.

    A full re-set rather than a per-line patch: the original lines were
    entirely bold — so nothing stood out — and their indents were ragged by up
    to 8pt. Rebuilding fixes emphasis and alignment in one pass.
    """
    y = rect.y0 + size
    left = rect.x0 + text_dx
    avail = rect.x1 - left
    space = tw(" ", "reg", size)
    for para in paras:
        page.draw_circle(fitz.Point(rect.x0 + bullet_dx, y - size * 0.3),
                         size * 0.11, color=colour, fill=colour)
        line, line_w = [], 0.0
        for word, weight, sp in _tokens(para):
            ww = tw(word, weight, size) + (space if sp and line else 0.0)
            if line and line_w + ww > avail:
                x = left
                for t, wt, s2 in line:
                    if s2 and x > left:
                        x += space
                    x = draw(page, x, y, t, wt, size, colour)
                y += leading
                line, line_w = [], 0.0
                ww = tw(word, weight, size)
            line.append((word, weight, sp))
            line_w += ww
        if line:
            x = left
            for t, wt, s2 in line:
                if s2 and x > left:
                    x += space
                x = draw(page, x, y, t, wt, size, colour)
            y += leading
        y += para_gap
    return y


def swap_image(page, xref, path, rect):
    """Cover an image and drop a corrected one in its place."""
    for im in page.get_image_info(xrefs=True):
        if im["xref"] == xref:
            cover(page, fitz.Rect(im["bbox"]), pad=2)
            break
    page.insert_image(rect, filename=path, overlay=True)


# Everything the patch replaces. Removed from the text layer up front so no
# stale wording can resurface later.
STALE = {
    0: ["Name:", "UGC/Branch:", "Institute:", "University:", "TEAM MEMBER 2"],
    1: [],   # slide 2's body is cleared by rect, below
    2: ["CITYWIDE BLINDNES VS. HYPERLOCAL REALITY", "THE IMPACT AND  THE PROBLEM"],
    3: ["Better-targeted relief without needing more",
        "Faster, more specific response vs citywide alert",
        "Municipal disaster management cells & city health",
        "Urban poor, outdoor workers, elderly"],
    4: ["Your paragraph Fuses static", "data and today's live forecast",
        "into a per-cell risk score,", "updating daily.text", "plainlanguage ward"],
    5: ["Our coverage—maximizing algorithm"],
    6: ["Live pilot showcasing optimized", "placement. Highly scalable"],
    7: ["HeatShield — From heatwave alerts to hyperlocal action."],
}
# Slide 2's three bullet blocks are re-typeset wholesale.
STALE_RECTS = {
    1: [fitz.Rect(18, 146, 1425, 344), fitz.Rect(18, 396, 1425, 566),
        fitz.Rect(18, 618, 1345, 792)],
}


def main():
    global REF
    doc = fitz.open(SRC)
    REF = fitz.open(SRC)

    for idx, strings in STALE.items():
        pg = doc[idx]
        rects = []
        for t in strings:
            rects.extend(REF[idx].search_for(t))
        rects.extend(STALE_RECTS.get(idx, []))
        strip_text(pg, rects)

    # ================================================================== p1
    p = doc[0]
    print("page 1  — team block alignment + correct label")
    # "UGC" is the University Grants Commission; the template asks for UG/PG.
    # Columns were also ragged: label left edges varied by up to 16pt within a
    # column and the second chip's text sat 8pt above the other three.
    COLS = [56.0, 407.0, 770.0, 1108.0]
    ROWS = [("Name:", 559.0, 14.5), ("UG / PG, Branch:", 592.0, 13.2),
            ("Institute:", 625.0, 14.9), ("University:", 658.0, 15.2)]
    for old in ["Name:", "UGC/Branch:", "Institute:", "University:"]:
        for r in p.search_for(old):
            cover(p, fitz.Rect(r.x0 - 6, r.y0 - 6, r.x0 + 210, r.y1 + 6), pad=0)
    for x in COLS:
        for label, y, size in ROWS:
            draw(p, x, y + size * 0.79, label, "bold", size, NAVY2)
    # second chip's caption sat high
    r = line_rect(p, "TEAM MEMBER 2")
    if r:
        pix = p.get_pixmap(clip=fitz.Rect(r.x0 - 8, r.y0 + 6, r.x0 - 7, r.y0 + 7))
        chip = tuple(v / 255 for v in pix.pixel(0, 0)[:3])
        p.draw_rect(fitz.Rect(r.x0 - 12, r.y0 - 4, r.x1 + 12, r.y1 + 12),
                    color=chip, fill=chip, width=0)
        draw(p, 528.0, 531.5, "TEAM MEMBER 2", "bold", 13.2, (1, 1, 1))

    # ================================================================== p2
    p = doc[1]
    print("page 2  — emphasis + hyphen")
    B, R = "bold", "reg"
    S, C = 26.5, NAVY
    # Three body blocks, each between the orange section headings.
    for rect, paras in [
        (fitz.Rect(18, 146, 1425, 344), [
            [("Indian heatwave response is ", R), ("citywide and blind", B),
             (", when heat risk is ", R), ("hyperlocal and predictable", B), (".", R)],
            [("A city issues ", R), ("one red-alert threshold for the whole municipality", B),
             (" — but inside that city, ", R), ("risk varies block to block", B), (".", R)],
            [("A dense, tin-roofed, tree-poor pocket can run ", R),
             ("several degrees hotter", B),
             (" than a leafy planned area a few kilometres away, and it is usually home to "
              "the people least able to cope: ", R),
             ("outdoor workers, the elderly, those without cooling", B), (".", R)],
        ]),
        (fitz.Rect(18, 396, 1425, 566), [
            [("Heat is one of India’s ", R), ("fastest-growing climate killers", B), (".", R)],
            [("Ahmedabad’s 2013 Heat Action Plan — South Asia’s first — is credited with "
              "averting roughly ", R), ("1,100+ deaths a year", B),
             (", and worked well enough that the NDMA told ", R),
             ("23 heat-prone states", B), (" to build their own.", R)],
            [("But even good Heat Action Plans ", R), ("mostly stop at citywide alerts", B), (".", R)],
        ]),
        (fitz.Rect(18, 618, 1345, 792), [
            [("Hyperlocal heat mapping already works — SEEDS with Microsoft, IIT Mandi’s "
              "building-level maps — which ", R),
             ("proves the mapping problem is solvable", B), (".", R)],
            [("But ", R), ("most of that work stops at the map", B),
             (". It rarely closes the loop into “place the cooling centre here, today.”", R)],
        ]),
    ]:
        cover(p, rect, pad=0)
        bullet_block(p, rect, paras, S, C, leading=30.5)

    # ================================================================== p3
    p = doc[2]
    print("page 3  — BLINDNESS + spacing")
    r = line_rect(p, "CITYWIDE BLINDNES VS. HYPERLOCAL REALITY")
    if r:
        # Stay strictly inside the solid centre of the orange ellipse. Painting
        # a rectangle across the whole banner squared off its curved ends.
        pix = p.get_pixmap(clip=fitz.Rect(200, 52, 201, 53))
        band = tuple(v / 255 for v in pix.pixel(0, 0)[:3])
        p.draw_rect(fitz.Rect(r.x0 - 10, r.y0 - 7, r.x1 + 60, r.y1 + 8),
                    color=band, fill=band, width=0)
        size = 41.0
        draw(p, r.x0, r.y1 - size * 0.2,
             "CITYWIDE BLINDNESS VS. HYPERLOCAL REALITY", "saira", size, (0, 0, 0))
    r = line_rect(p, "THE IMPACT AND  THE PROBLEM")
    if r:
        cover(p, fitz.Rect(r.x0 - 4, r.y0 - 8, r.x1 + 26, r.y1 + 12), pad=2)
        draw(p, r.x0, r.y1 - 32.5 * 0.2, "THE IMPACT AND THE PROBLEM", "saira", 32.5, NAVY)
        p.draw_line(fitz.Point(r.x0, r.y1 + 5),
                    fitz.Point(r.x0 + tw("THE IMPACT AND THE PROBLEM", "saira", 32.5), r.y1 + 5),
                    color=NAVY, width=1.6)

    # ================================================================== p4
    p = doc[3]
    print("page 4  — completed sentence + emphasis")
    emphasise(p, "Better-targeted relief without needing more",
              [("Better-targeted relief ", "reg"), ("without needing more resources", "bold")],
              25.4, NAVY4)
    emphasise(p, "Faster, more specific response vs citywide alert",
              [("Faster, more specific response", "bold"), (" vs citywide alert", "reg")],
              25.4, NAVY4)
    emphasise(p, "Municipal disaster management cells & city health",
              [("Municipal disaster management cells", "bold"), (" & city health", "reg")],
              22.1, NAVY4, tpad=3.0)
    emphasise(p, "Urban poor, outdoor workers, elderly",
              [("Urban poor, outdoor workers, elderly", "bold")], 22.1, NAVY4)

    # ================================================================== p5
    p = doc[4]
    print("page 5  — placeholder text removed")
    for old in ["Your paragraph Fuses static", "data and today's live forecast",
                "into a per-cell risk score,", "updating daily.text"]:
        r = line_rect(p, old)
        if r:
            cover(p, r, pad=3)
    size = 26.0
    x0, base, lead = 735.0, 462.0, 34.0
    for parts in [
        [("Fuses the ", "reg"), ("static layer", "bold"), (" with", "reg")],
        [("today's ", "reg"), ("live forecast", "bold"), (" into a", "reg")],
        [("per-cell risk score", "bold"), (", updated", "reg")],
        [("daily", "bold"), (".", "reg")],
    ]:
        runs(p, x0, base, parts, size, NAVY3)
        base += lead
    emphasise(p, "plainlanguage ward",
              [("plain-language ward", "reg")], 26.2, NAVY3, pad=4)

    # ================================================================== p6
    p = doc[5]
    print("page 6  — real screenshot + hyphen")
    emphasise(p, "Our coverage—maximizing algorithm",
              [("Our ", "reg"), ("coverage-maximizing algorithm", "bold")], 22.0, NAVY2,
              solid=(1, 1, 1))
    shot = os.path.join(ASSETS, "dashboard.png")
    if os.path.exists(shot):
        cover(p, fitz.Rect(0, 198, 912, 752), pad=2)
        # The original bled off the left edge at x=-131 and cropped its own
        # legend. Reseated inside the slide, at the source aspect.
        swap_image(p, 85, shot, fitz.Rect(26, 206, 886, 743))

    # ================================================================== p7
    p = doc[6]
    print("page 7  — real optimizer figures")
    # "Live pilot" was an overclaim — there is no pilot. Set in the serif the
    # rest of this column uses, auto-fitted because the substitute face is
    # wider than the condensed original.
    emphasise(p, "Live pilot showcasing optimized",
              [("Working prototype on live", "serif")], 28.2, (0, 0, 0), pad=5, fit=True)
    emphasise(p, "placement. Highly scalable",
              [("data. Highly scalable", "serif")], 28.2, (0, 0, 0), pad=5, fit=True)
    chart = os.path.join(ASSETS, "chart.png")
    if os.path.exists(chart):
        swap_image(p, 92, chart, fitz.Rect(635, 186, 1426, 603))

    # ================================================================== p8
    p = doc[7]
    print("page 8  — footer collision")
    r = line_rect(p, "HeatShield — From heatwave alerts to hyperlocal action.")
    if r:
        cover(p, r, pad=4)
        x = draw(p, r.x0, r.y1 - 32.0 * 0.2, "HeatShield", "saira", 32.0, NAVY)
        x = draw(p, x, r.y1 - 32.0 * 0.2, "  —  ", "saira", 32.0, NAVY)
        draw(p, x, r.y1 - 32.0 * 0.2, "From heatwave alerts to hyperlocal action.",
             "saira", 32.0, ORANGE)

    # ============================================================== new p2
    # The organisers' template lists Outline as its own slide and this deck
    # skipped it, which is a visible miss on a checklist they wrote.
    print("inserting Outline slide")
    # Grab the background BEFORE inserting: new_page() renumbers the document
    # and every existing Page handle goes stale.
    bgimg = _page_bg(doc[2])
    bg_bytes = None
    if bgimg is not None:
        buf = io.BytesIO()
        bgimg.save(buf, format="PNG")
        bg_bytes = buf.getvalue()
    w, h = doc[0].rect.width, doc[0].rect.height
    _BG.clear()
    page = doc.new_page(1, width=w, height=h)
    if bg_bytes:
        page.insert_image(page.rect, stream=bg_bytes)
    draw(page, 50, 108, "OUTLINE", "saira", 89.0, NAVY)
    items = [
        ("01", "Problem Statement / Idea", "Heat risk is hyperlocal; the response is citywide"),
        ("02", "Objectives", "Map, forecast, place relief, advise"),
        ("03", "Proposed Solution / Architecture", "The pipeline, the stack, why it scales"),
        ("04", "Unique Features / Innovation", "The action layer, not the map"),
        ("05", "Expected Outcomes", "Deliverables, measured impact, scope to scale"),
        ("06", "Conclusion", "Why this idea, and why now"),
    ]
    y = 232.0
    for num, title, sub in items:
        draw(page, 56, y, num, "saira", 40.0, ORANGE)
        draw(page, 130, y, title, "bold", 28.0, NAVY)
        draw(page, 130, y + 30, sub, "reg", 20.0, (0x4a / 255, 0x54 / 255, 0x5e / 255))
        y += 84.0
    # the deck's own one-liner, so the map slide is not content-free
    draw(page, 56, 762, "HeatShield", "saira", 26.0, NAVY)
    draw(page, 205, 762, "—  From heatwave alerts to hyperlocal action.", "saira", 26.0, ORANGE)
    page.insert_text((1359, 741), "2", fontfile=F["reg"], fontname=FN["reg"],
                     fontsize=20, color=(0.1, 0.1, 0.1))

    # renumber the slides that shifted
    for idx, num in [(2, "3"), (3, "4"), (4, "5"), (5, "6"), (6, "7"), (7, "8"), (8, "9")]:
        pg = doc[idx]
        corner = fitz.Rect(1330, 700, 1440, 780)
        hits = [r for r in pg.search_for(str(idx)) if r in corner]
        if not hits:
            continue
        r = hits[0]
        # Redact just the digit. A whole-corner rect clipped the tail of the
        # line above it, and pasting the page background over the number
        # stamped a cream patch onto the dark tech-stack strip — redaction
        # removes the glyph on its own, so no cover is needed.
        strip_text(pg, [fitz.Rect(r.x0 - 1, r.y0 - 1, r.x1 + 1, r.y1 + 1)])
        # The architecture slide's dark tech-stack strip swallows the folio at
        # its inherited position; lift it clear of the band.
        dy = -26.0 if idx == 5 else 0.0
        pg.insert_text((r.x0, r.y1 + dy), num, fontfile=F["reg"], fontname=FN["reg"],
                       fontsize=20, color=(0.1, 0.1, 0.1))

    doc.save(OUT, garbage=3, deflate=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
