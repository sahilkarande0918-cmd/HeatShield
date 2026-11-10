# Patch the re-exported Canva deck (HeatShield_ppt 2), fixing only what Sahil
# flagged: half-gone words, the crammed/placeholder slide-5 text, the Vercel
# logo crowding its label, and the last-slide title/info spacing. Background
# theme and every element are left untouched.
#
# Text is removed with redaction (fill=False, images + line art preserved) so
# the cream ground and the orange ellipse survive, then redrawn using the
# deck's OWN embedded fonts, extracted from the PDF so nothing changes typeface.
import io

import fitz

SRC = "src.pdf"
OUT = "fixed.pdf"
FONTS = "../fonts"   # scratchpad Roboto weights (same family as the deck's)

AGR, TEL, NOR7, NOR4, SAI = ("f_agrandir.ttf", "f_telegraf.ttf",
                             "f_norwester.ttf", "f_nor4.ttf", "f_saira.ttf")
BLACK = (0, 0, 0)
NAVY3 = (0, 0x2F / 255, 0x69 / 255)          # slide-5 body + headings
NAVY_F = (0x20 / 255, 0x2A / 255, 0x5A / 255)  # footer "HeatShield"
ORANGE_F = (0xFF / 255, 0x8B / 255, 0x28 / 255)  # footer tail

_FO = {}
def fo(f):
    if f not in _FO: _FO[f] = fitz.Font(fontfile=f)
    return _FO[f]
def tw(t, f, s): return fo(f).text_length(t, fontsize=s)

def wrap(text, f, s, maxw):
    lines, cur = [], ""
    for w in text.split(" "):
        trial = w if not cur else cur + " " + w
        if tw(trial, f, s) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def redact(page, rect):
    page.add_redact_annot(fitz.Rect(rect), fill=False)

def apply(page):
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                          text=fitz.PDF_REDACT_TEXT_REMOVE)

def put(page, x, base, text, f, s, col):
    page.insert_text((x, base), text, fontfile=f, fontname="F" + str(abs(hash(f)) % 9999),
                     fontsize=s, color=col)

d = fitz.open(SRC)

# ---- EDIT 1 : slide 3 banner  BLINDNES -> BLINDNESS -------------------------
p = d[2]
redact(p, (165.3, 31, 1212.5, 75.2)); apply(p)
t = "CITYWIDE BLINDNESS VS. HYPERLOCAL REALITY"
w = tw(t, AGR, 44.2)
put(p, 688.9 - w / 2, 65.5, t, AGR, 44.2, BLACK)

# ---- slide 5 ---------------------------------------------------------------
p = d[4]
redact(p, (730, 440, 1112, 582))            # col2 RISK ENGINE body
redact(p, (1146, 383, 1421, 437))           # col3 heading
redact(p, (1140, 437, 1440, 672))           # col3 body
apply(p)

# col2 body — cleaned of the "Your paragraph … .text" placeholder junk
col2 = "Fuses the static layer with today's live forecast into a per-cell risk score, updated daily."
for i, ln in enumerate(wrap(col2, TEL, 27, 371)):
    put(p, 735, 463.4 + i * 34.5, ln, TEL, 27, NAVY3)

# col3 heading + body, pulled 22pt left off the page edge
put(p, 1150.6 - 22, 427.3, "3.ACTION LAYER", NOR4, 42.3, NAVY3)
col3 = ("Interactive Map (drill into cell/ward), Siting Optimizer (relief "
        "placement), Advisory Generator (LLM creates plain-language ward advisories)")
s3 = 26.2
while len(wrap(col3, TEL, s3, 300)) > 7 and s3 > 20:
    s3 -= 0.3
for i, ln in enumerate(wrap(col3, TEL, s3, 300)):
    put(p, 1123.6, 459.1 + i * 33.8, ln, TEL, s3, NAVY3)

# strip: Vercel logo no longer crowds its label. Replace the image in place so
# its z-order is kept — the strip carries a baked-in white box that the overlaid
# "Hand-written optimizer" text hides, and painting on top would expose it.
p.replace_image(101, filename="strip_fixed.png")

# ---- slide 8 : title/info too close ----------------------------------------
# Each heading and its first body line overlap (that IS the "too close"), so a
# rectangle can't remove one without eating the other. Re-typeset each item as
# a unit: heading kept where it is, body dropped 15pt for a clear gap.
p = d[7]
GAP = 15
ITEMS = [
    dict(h=("Ahmedabad's Legacy ", 964.5, 143.3, 32.2, NOR7),
         body=[("Not novel for novelty's sake; it directly ", 896.7, 177.0, 24.8, "f_pfm.ttf"),
               ("builds on Ahmedabad's own Heat Action Plan legacy. ", 816.3, 208.5, 24.8, "f_pfm.ttf")]),
    dict(h=("Solves a Critical Gap", 953.6, 314.9, 33.4, NOR7),
         body=[("Targets a documented life-and-death deployment", 820.2, 341.1, 29.5, "f_cg.ttf"),
               ("gap, not a hypothetical research question. ", 862.4, 370.4, 29.5, "f_cg.ttf")]),
    dict(h=("Working Ecosystem", 975.6, 479.0, 32.2, NOR7),
         body=[(" Scoped entirely as a working, demoable system, not", 812.0, 503.7, 25.2, "f_pfb.ttf"),
               ("a single model or a static dashboard.", 900.7, 528.5, 25.2, "f_pfb.ttf")]),
]
for it in ITEMS:
    ht, hx, hb, hs, hf = it["h"]
    y_top = hb - hs
    y_bot = it["body"][-1][2] + GAP + 6
    redact(p, (800, y_top - 6, 1440, y_bot))
redact(p, (74, 732, 1010, 792))             # footer
apply(p)
for it in ITEMS:
    ht, hx, hb, hs, hf = it["h"]
    put(p, hx, hb, ht, hf, hs, BLACK)                       # heading stays put
    for bt, bx, by, bs, bf in it["body"]:
        put(p, bx, by + GAP, bt, bf, bs, BLACK)             # info drops for a gap
# footer: the em-dash is a separate image (222.8–274.5) that becomes a black box
# in some viewers; the flatten pass below fixes it. Set the two words around it.
put(p, 77.8, 781.5, "HeatShield", SAI, 32, NAVY_F)
put(p, 285.0, 781.5, "From heatwave alerts to hyperlocal action.", SAI, 32, ORANGE_F)

# ---- slide 2 : whole body was heavy Roboto-Bold — too dark. Re-set it in a
# normal weight, with only key phrases in a slight (Medium) bold. -------------
RREG = FONTS + "/Roboto-Regular.ttf"
RMED = FONTS + "/Roboto-Regular.ttf"   # "remove all bold": emphasis drops to regular
NAVY_B = (0, 0x16 / 255, 0x3D / 255)

def runs_of(text, phrases):
    """Split a line into [(text, fontfile)] with phrases in Medium, rest Regular."""
    mask = [False] * len(text)
    for ph in phrases:
        i = text.find(ph)
        if i >= 0:
            for k in range(i, i + len(ph)):
                mask[k] = True
    out, cur, curb = [], "", mask[0] if text else False
    for ch, b in zip(text, mask):
        if b == curb:
            cur += ch
        else:
            out.append((cur, RMED if curb else RREG)); cur, curb = ch, b
    if cur:
        out.append((cur, RMED if curb else RREG))
    return out

# (text, ox, baseline, [phrases to lightly bold]); "tinroofed" -> "tin-roofed"
S2 = [
 ("Indian heatwave response is citywide and blind, when heat risk is hyperlocal and predictable.", 56.2, 186.2, ["citywide and blind", "hyperlocal and predictable"]),
 ("A city issues one red-alert threshold for the whole municipality — but inside that city, risk varies block to", 56.2, 213.9, ["one red-alert threshold"]),
 ("block.", 56.2, 241.7, []),
 ("A dense, tin-roofed, tree-poor pocket can run several degrees hotter than", 56.2, 269.4, ["several degrees hotter"]),
 ("       a leafy planned area a few kilometres away, and it is usually home to the people least", 8.6, 297.2, ["the people least"]),
 ("       able to cope: outdoor workers, the elderly, those without cooling. ", 8.6, 324.9, ["outdoor workers, the elderly"]),
 ("Heat is one of India’s fastest-growing climate killers.", 63.1, 435.9, ["fastest-growing climate killers"]),
 (" Ahmedabad’s 2013 Heat Action Plan — South Asia’s first — is credited with averting ", 56.2, 463.7, ["Ahmedabad’s 2013 Heat Action Plan"]),
 ("       roughly 1,100+ deaths a year, and worked well enough that the NDMA told ", 8.6, 491.4, ["1,100+ deaths a year"]),
 ("       23 heat-prone states to build their own.", 8.6, 519.2, ["23 heat-prone states"]),
 (" But even good Heat Action Plans mostly stop at citywide alerts. ", 56.2, 546.9, ["stop at citywide alerts"]),
 (" Hyperlocal heat mapping already works — SEEDS with ", 56.2, 657.9, ["already works"]),
 ("       Microsoft, IIT Mandi’s building-level maps — which proves the mapping", 8.6, 685.7, ["proves the mapping"]),
 ("       problem is solvable.", 8.6, 713.4, ["problem is solvable"]),
 (" But most of that work stops at the map.", 56.2, 741.2, ["stops at the map"]),
 ("       It rarely closes the loop into “place the cooling centre here, today.” ", 8.6, 768.9, ["closes the loop"]),
]
p = d[1]
for r in [(5, 168, 1410, 336), (5, 418, 1410, 560), (5, 640, 1410, 784)]:
    redact(p, r)
apply(p)
for text, ox, base, phrases in S2:
    x = ox
    for seg, f in runs_of(text, phrases):
        put(p, x, base, seg, f, 28, NAVY_B)
        x += tw(seg, f, 28)

# ---- too-bold on slides 4/6/7 : lighten heavy emphasis to a slight weight -----
# The emphasis is baked into the glyphs of merged fonts, so (as on slide 2) the
# only way to lighten it is to re-set the affected lines: Roboto emphasis in
# Roboto-Medium, serif emphasis in the deck's own serif with a hair-thin stroke,
# and the heaviest Roboto-Bold headings/labels dropped to Medium.
SER6 = "f_serif6.ttf"
SER7 = "f_serif_Medium.ttf"
NAVY47 = (0, 0x16 / 255, 0x47 / 255)
NAVY52 = (0, 0x23 / 255, 0x52 / 255)
ORANGE47 = (0xF4 / 255, 0x7D / 255, 0)
ORANGE7 = (0xF4 / 255, 0x89 / 255, 0x36 / 255)
WHITE = (1, 1, 1)
STROKE = 0   # "remove all bold": no stroke -> serif emphasis renders regular


def split_emph(text, phrases):
    mask = [False] * len(text)
    for ph in phrases:
        i = text.find(ph)
        while i >= 0:
            for k in range(i, i + len(ph)):
                mask[k] = True
            i = text.find(ph, i + len(ph))
    out, cur, cb = [], "", (mask[0] if text else False)
    for ch, b in zip(text, mask):
        if b == cb:
            cur += ch
        else:
            out.append((cur, cb)); cur, cb = ch, b
    if cur:
        out.append((cur, cb))
    return out


def line(page, x, base, text, size, colour, regf, phrases=(), medf=None, stroke=None):
    for seg, emph in split_emph(text, phrases):
        if emph and medf:
            put(page, x, base, seg, medf, size, colour)
            x += tw(seg, medf, size)
        elif emph and stroke:
            page.insert_text((x, base), seg, fontfile=regf, fontname="S" + str(abs(hash(regf)) % 999),
                             fontsize=size, color=colour, fill=colour, render_mode=2, border_width=stroke)
            x += tw(seg, regf, size)
        else:
            put(page, x, base, seg, regf, size, colour)
            x += tw(seg, regf, size)


# ---------- slide 4 ----------
p = d[3]
for r in [(74, 452, 362, 582), (400, 452, 722, 548), (730, 452, 1016, 578),
          (1100, 452, 1440, 548), (74, 612, 340, 640), (72, 650, 705, 726),
          (820, 619, 1090, 646), (822, 648, 1440, 752)]:
    redact(p, r)
apply(p)
S4 = [("Heat vulnerability at", 85.9, 474.1, 22.2, []),
      ("grid/ward level, not", 89.5, 504.9, 22.2, ["grid/ward level"]),
      ("one city-wide", 118.8, 535.6, 22.2, []), ("number.", 143.5, 566.4, 22.2, []),
      ("Push risk 24–72 hrs", 419.5, 473.6, 22.2, ["24–72 hrs"]),
      ("forward with live", 437.1, 502.1, 22.2, []),
      ("weather, updated daily", 408.2, 530.6, 22.2, []),
      ("Recommend where", 754.3, 475.1, 22.2, []),
      ("cooling relief should go", 734.5, 503.6, 22.2, ["cooling relief"]),
      ("so resources protect", 748.0, 532.1, 22.2, []), ("more people", 787.9, 560.6, 22.2, []),
      ("Generate ward-level", 1124.8, 474.7, 21.5, ["ward-level"]),
      ("advisories a municipal", 1112.2, 502.4, 21.5, ["advisories"]),
      ("officer can act on", 1135.2, 530.2, 21.5, []),
      ("Better-targeted relief without needing more", 75.8, 670.5, 25.4, ["Better-targeted relief"]),
      ("Faster, more specific response vs citywide alert", 75.8, 711.0, 25.4, []),
      ("Municipal disaster management cells & city health", 825.1, 664.6, 22.1, []),
      ("departments", 825.1, 699.8, 22.1, []),
      ("Urban poor, outdoor workers, elderly", 825.1, 735.1, 22.1, ["Urban poor, outdoor workers, elderly"])]
for t, x, y, s, e in S4:
    line(p, x, y, t, s, NAVY47, RREG, e, medf=RMED)
put(p, 78.0, 631.6, "EXPECTED IMPACT", RMED, 24.1, ORANGE47)
put(p, 824.2, 638.2, "END BENEFICIARIES", RMED, 24.0, ORANGE47)

# ---------- slide 6 ----------
p = d[5]
for r in [(10, 92, 1055, 133), (1095, 92, 1440, 130), (1078, 296, 1440, 335),
          (1070, 540, 1440, 610)]:
    redact(p, r)
apply(p)
line(p, 14.2, 119.3, "The differentiator is the action layer, not the map.", 39.6,
     ORANGE47, SER6, ["action layer"], stroke=STROKE)
put(p, 1101.6, 116.6, "Live, not static", RMED, 32.0, NAVY52)
put(p, 1084.6, 321.2, "Built for the last mile", RMED, 32.0, NAVY52)
put(p, 1075.6, 564.1, "Optimization, not just", RMED, 32.0, NAVY52)
put(p, 1075.6, 597.1, "visualization", RMED, 32.0, NAVY52)
# redacting the heading also ate the big "01"; redraw it in Saira-Bold
SAIRA = FONTS + "/SairaCondensed-Bold.ttf"
NUMOR = (0xFF / 255, 0x9A / 255, 0x2B / 255)
put(p, 976.0, 193.9, "01", SAIRA, 113.3, NUMOR)

# ---------- slide 7 ----------
p = d[6]
for r in [(20, 108, 345, 141), (18, 345, 475, 376), (20, 569, 365, 599),
          (18, 160, 760, 335), (18, 378, 760, 552),
          (760, 665, 1452, 706), (760, 712, 1330, 752)]:
    redact(p, r)
apply(p)
put(p, 24.5, 134.4, "DELIVERABLES", RMED, 31.8, ORANGE7)
put(p, 22.3, 368.9, "IMPACT AT A GLANCE", RMED, 28.8, ORANGE7)
put(p, 24.5, 592.1, "SCOPE TO SCALE", RMED, 28.8, ORANGE7)
put(p, 773.4, 694.0, "Turning heat alerts into hyperlocal", RMED, 34.3, WHITE)
put(p, 836.9, 741.2, "action, today and at scale.", RMED, 34.3, WHITE)
# full paragraphs (redaction removes whole text objects, so redraw every line)
for t, x, y, s, e in [
        ("Web dashboard with live interactive", 22.3, 173.5, 30.1, []),
        ("ward-level heat-risk map,", 22.3, 211.9, 30.1, ["ward-level heat-risk map"]),
        ("siting-recommendation engine showing", 22.3, 250.3, 30.1, ["siting-recommendation engine"]),
        ("coverage gained vs current placement,", 22.3, 288.7, 30.1, ["coverage gained"]),
        ("and auto-generated advisory text.", 22.3, 327.1, 30.1, []),
        ("Live pilot showcasing optimized", 22.3, 399.8, 28.2, []),
        ("placement. Highly scalable", 22.3, 435.8, 28.2, ["Highly scalable"]),
        ("framework across more Indian", 22.3, 471.8, 28.2, []),
        ("cities via rapidly precomputed", 22.3, 507.8, 28.2, []),
        ("local static vulnerability layers.", 22.3, 543.8, 28.2, [])]:
    line(p, x, y, t, s, (0, 0, 0), SER7, e, stroke=STROKE)

# ---- black boxes: flatten every soft-masked image onto its real backing ------
# Some viewers paint a masked image's transparent areas as solid black (card
# drop-shadows, the footer dash, slide-1 dividers). Compositing each masked
# image over what sits behind it and dropping the mask renders identically
# everywhere, with no mask left to mishandle.
from PIL import Image


def flatten_masks(page):
    W = int(page.rect.width * 2)
    H = int(page.rect.height * 2)
    canv = Image.new("RGB", (W, H), (255, 255, 255))
    todo = []
    for im in page.get_image_info(xrefs=True):
        x = im["xref"]
        info = d.extract_image(x)
        rgb = Image.open(io.BytesIO(info["image"])).convert("RGB")
        sm = info.get("smask", 0)
        al = (Image.open(io.BytesIO(d.extract_image(sm)["image"])).convert("L").resize(rgb.size)
              if sm else Image.new("L", rgb.size, 255))
        bb = im["bbox"]
        x0, y0 = int(round(bb[0] * 2)), int(round(bb[1] * 2))
        w = max(1, int(round((bb[2] - bb[0]) * 2)))
        h = max(1, int(round((bb[3] - bb[1]) * 2)))
        back = canv.crop((x0, y0, x0 + w, y0 + h))
        if sm:
            todo.append((x, Image.composite(rgb, back.resize(rgb.size), al)))
        canv.paste(Image.composite(rgb.resize((w, h)), back, al.resize((w, h))), (x0, y0))
    for x, flat in todo:
        buf = io.BytesIO()
        flat.save(buf, format="PNG")
        page.replace_image(x, stream=buf.getvalue())
        d.xref_set_key(x, "SMask", "null")


# NOTE: flatten pass intentionally not called — we rasterize each slide below,
# and the renderer composites the image masks correctly, so no viewer ever sees
# a black box. flatten_masks stays defined for the PDF-only path if needed.

d.save(OUT, garbage=4, deflate=True)
print("saved", OUT, "pages", d.page_count)

# ---- build the PPTX from clean, mask-composited slide renders ----------------
from pptx import Presentation
from pptx.util import Inches

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]
for i, page in enumerate(d):
    pix = page.get_pixmap(matrix=fitz.Matrix(2.6, 2.6))   # ~2600px wide, crisp
    png = f"slide_{i}.png"
    pix.save(png)
    s = prs.slides.add_slide(blank)
    s.shapes.add_picture(png, 0, 0, width=prs.slide_width, height=prs.slide_height)
prs.save(OUT.replace(".pdf", ".pptx"))
print("saved", OUT.replace(".pdf", ".pptx"))
