const pptxgen = require('pptxgenjs');

/* ---------------------------------------------------------------------------
 * HeatShield — Indradhanu PCCOE IGC 2026 idea-round deck
 *
 * Palette is the subject matter: a pale-yellow → crimson heat ramp used only
 * where something represents risk level, against a clean near-white base.
 * Motif: each section carries a numbered square that steps along that ramp as
 * the deck progresses — the product's own legend, not decoration.
 * ------------------------------------------------------------------------- */

const INK = '1A1614'; // warm near-black
const MUTED = '6B625C';
const FAINT = '9C938C';
const PANEL = 'F3F2F1';
const WHITE = 'FFFFFF';

// The heat ramp. Low → extreme.
const R0 = 'FBE38E'; // pale yellow
const R1 = 'F5B841'; // amber
const R2 = 'E8823C'; // orange
const R3 = 'D1462F'; // red
const R4 = '8C1D18'; // deep crimson — the anchor colour

const RAMP = [R0, R1, R2, R3, R4];

const HEAD = 'Cambria';
const BODY = 'Calibri';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'Team HeatShield';
pres.title = 'HeatShield — PCCOE IGC 2026';

const W = 13.333;
const M = 0.7; // page margin

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Slide title + the numbered section chip that is this deck's motif. */
function sectionHead(slide, n, title, rampColor) {
  slide.addShape(pres.ShapeType.rect, {
    x: M,
    y: 0.46,
    w: 0.46,
    h: 0.46,
    fill: { color: rampColor },
    line: { color: rampColor, width: 0 },
  });
  slide.addText(String(n), {
    x: M,
    y: 0.46,
    w: 0.46,
    h: 0.46,
    isTextBox: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
    fontFace: BODY,
    fontSize: 18,
    bold: true,
    color: n >= 4 ? WHITE : INK,
  });
  slide.addText(title, {
    x: M + 0.66,
    y: 0.4,
    w: W - M * 2 - 0.66,
    h: 0.6,
    isTextBox: true,
    margin: 0,
    valign: 'middle',
    fontFace: HEAD,
    fontSize: 33,
    bold: true,
    color: INK,
  });
}

/** A soft panel. No edge stripes — a tint and a hairline outline only. */
function panel(slide, o) {
  slide.addShape(pres.ShapeType.roundRect, {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    rectRadius: 0.06,
    fill: { color: o.fill || PANEL },
    line: { color: o.line || 'E4E1DE', width: 1 },
  });
}

function heading(slide, text, o) {
  slide.addText(text, {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h || 0.32,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: o.size || 15,
    bold: true,
    color: o.color || INK,
  });
}

function body(slide, text, o) {
  slide.addText(text, {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: o.size || 13,
    color: o.color || MUTED,
    lineSpacingMultiple: 1.18,
    valign: o.valign || 'top',
  });
}

/**
 * A straight connector from (x1,y1) to (x2,y2).
 *
 * OOXML shape extents must be non-negative — a line drawn with a negative
 * width or height produces XML that validators accept and PowerPoint refuses
 * to open at all. Direction is expressed with flipH/flipV instead.
 */
function connector(slide, x1, y1, x2, y2, color) {
  slide.addShape(pres.ShapeType.line, {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
    flipH: x2 < x1,
    flipV: y2 < y1,
    line: { color: color || '8E837C', width: 1.5, endArrowType: 'triangle' },
  });
}

function bullets(slide, items, o) {
  slide.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 14 }, breakLine: i !== items.length - 1 },
    })),
    {
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: o.size || 13,
      color: o.color || MUTED,
      lineSpacingMultiple: 1.12,
      paraSpaceAfter: o.gap === undefined ? 7 : o.gap,
    },
  );
}

// ===========================================================================
// 1 — Title
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  // The heat ramp as the one graphic: five stacked bands down the right edge
  // of a contained block — this is the product's risk scale, not a border.
  const bx = 9.55;
  const bw = 3.1;
  RAMP.forEach((c, i) => {
    s.addShape(pres.ShapeType.rect, {
      x: bx,
      y: 1.35 + i * 0.92,
      w: bw,
      h: 0.86,
      fill: { color: c },
      line: { color: c, width: 0 },
    });
  });
  s.addText('Low', {
    x: bx - 1.0,
    y: 1.35,
    w: 0.9,
    h: 0.86,
    isTextBox: true,
    margin: 0,
    align: 'right',
    valign: 'middle',
    fontFace: BODY,
    fontSize: 11,
    color: FAINT,
  });
  s.addText('Extreme', {
    x: bx - 1.0,
    y: 1.35 + 4 * 0.92,
    w: 0.9,
    h: 0.86,
    isTextBox: true,
    margin: 0,
    align: 'right',
    valign: 'middle',
    fontFace: BODY,
    fontSize: 11,
    color: FAINT,
  });

  body(s, 'PCCOE International Grand Challenge 2026  ·  Pune, India', {
    x: M,
    y: 0.75,
    w: 8.4,
    h: 0.3,
    size: 13,
    color: MUTED,
  });
  s.addText('Theme: AI for Climate Change', {
    x: M,
    y: 1.12,
    w: 8.4,
    h: 0.32,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 13,
    bold: true,
    color: R4,
  });

  s.addText('HeatShield', {
    x: M,
    y: 2.0,
    w: 8.4,
    h: 1.35,
    isTextBox: true,
    margin: 0,
    valign: 'middle',
    fontFace: HEAD,
    fontSize: 76,
    bold: true,
    color: INK,
  });
  s.addText('From heatwave alerts to hyperlocal action.', {
    x: M,
    y: 3.42,
    w: 8.4,
    h: 0.5,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 22,
    color: R4,
  });

  s.addShape(pres.ShapeType.line, {
    x: M,
    y: 4.35,
    w: 8.2,
    h: 0,
    line: { color: 'E4E1DE', width: 1 },
  });

  heading(s, 'Team members', { x: M, y: 4.6, w: 8.4, size: 12, color: FAINT });
  s.addText(TEAM_TEXT(), {
    x: M,
    y: 4.95,
    w: 8.4,
    h: 1.7,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 13,
    color: INK,
    lineSpacingMultiple: 1.32,
  });

  s.addNotes(
    'HeatShield turns a citywide heatwave alert into a ward-level action plan. ' +
      'Built for the AI for Climate Change theme at PCCOE IGC 2026.',
  );
}

// ===========================================================================
// 2 — Outline
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText('Outline', {
    x: M,
    y: 0.5,
    w: 6,
    h: 0.7,
    isTextBox: true,
    margin: 0,
    valign: 'middle',
    fontFace: HEAD,
    fontSize: 40,
    bold: true,
    color: INK,
  });

  const items = [
    ['Problem Statement / Idea', 'Heat risk is hyperlocal; response is citywide'],
    ['Objectives', 'Map, forecast, place relief, advise'],
    ['Proposed Solution / Architecture', 'The pipeline and the stack'],
    ['Unique Features / Innovation', 'The action layer, not the map'],
    ['Expected Outcomes', 'Deliverables and impact'],
    ['Conclusion', 'Why this, why now'],
  ];

  const top = 1.6;
  const rowH = 0.86;
  items.forEach((it, i) => {
    const y = top + i * rowH;
    const c = RAMP[Math.min(i, 4)];
    s.addShape(pres.ShapeType.rect, {
      x: M,
      y: y + 0.08,
      w: 0.42,
      h: 0.42,
      fill: { color: c },
      line: { color: c, width: 0 },
    });
    s.addText(String(i + 3), {
      x: M,
      y: y + 0.08,
      w: 0.42,
      h: 0.42,
      isTextBox: true,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: i >= 3 ? WHITE : INK,
    });
    s.addText(it[0], {
      x: M + 0.62,
      y: y,
      w: 5.2,
      h: 0.34,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 16,
      bold: true,
      color: INK,
    });
    s.addText(it[1], {
      x: M + 0.62,
      y: y + 0.33,
      w: 5.6,
      h: 0.3,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 12,
      color: FAINT,
    });
  });

  // Right: the thesis, so the map slide is not content-free.
  panel(s, { x: 7.6, y: 1.6, w: 5.05, h: 4.4, fill: PANEL });
  s.addText('The gap we are closing', {
    x: 8.0,
    y: 2.0,
    w: 4.25,
    h: 0.34,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 13,
    bold: true,
    color: R4,
  });
  s.addText('“Heat mapping in India is\na solved problem.\nHeat action isn’t.”', {
    x: 8.0,
    y: 2.5,
    w: 4.25,
    h: 1.7,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 26,
    bold: true,
    color: INK,
    lineSpacingMultiple: 1.14,
  });
  body(
    s,
    'Sections 3 to 8 follow one line of argument: the risk is hyperlocal, ' +
      'the response is not, and the missing piece is the step from a map to a decision.',
    { x: 8.0, y: 4.35, w: 4.25, h: 1.3, size: 12.5 },
  );

  s.addNotes('Roadmap slide. Six sections, one argument: map to action.');
}

// ===========================================================================
// 3 — Problem Statement / Idea
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 3, 'Problem Statement / Idea', R0);

  // The problem
  heading(s, 'The problem', { x: M, y: 1.28, w: 6.0, size: 15, color: R4 });
  body(
    s,
    'Indian heatwave response is citywide and blind, when heat risk is hyperlocal and predictable. ' +
      'A city issues one red-alert threshold for the whole municipality — but inside that city, risk varies block to block. ' +
      'A dense, tin-roofed, tree-poor pocket can run several degrees hotter than a leafy planned area a few kilometres away, ' +
      'and it is usually home to the people least able to cope: outdoor workers, the elderly, those without cooling.',
    { x: M, y: 1.66, w: 6.0, h: 1.85, size: 13.5 },
  );

  // Why it matters
  heading(s, 'Why it matters', { x: M, y: 3.28, w: 6.0, size: 15, color: R4 });
  body(
    s,
    'Heat is one of India’s fastest-growing climate killers. Ahmedabad’s 2013 Heat Action Plan — South Asia’s ' +
      'first — is credited with averting roughly 1,100+ deaths a year, and worked well enough that the NDMA told ' +
      '23 heat-prone states to build their own. But even good Heat Action Plans mostly stop at citywide alerts.',
    { x: M, y: 3.66, w: 6.0, h: 1.3, size: 13.5 },
  );

  heading(s, 'Current gaps in existing solutions', { x: M, y: 5.0, w: 6.0, size: 15, color: R4 });
  body(
    s,
    'Hyperlocal heat mapping already works — SEEDS with Microsoft, IIT Mandi’s building-level maps — which ' +
      'proves the mapping problem is solvable. But most of that work stops at the map. It rarely closes the loop ' +
      'into “place the cooling centre here, today.”',
    { x: M, y: 5.38, w: 6.0, h: 1.45, size: 13.5 },
  );

  // --- schematic: one alert for a city that is not one temperature --------
  panel(s, { x: 7.2, y: 1.28, w: 5.45, h: 2.86 });

  const G = 0.3;   // cell edge
  const gy = 2.02; // grid top
  const gA = 7.66; // "one alert" grid
  const gB = 10.3; // "actual risk" grid

  // Hand-set, not random: the hot core sits where a dense old city core would.
  const heat = [
    [0, 0, 1, 1, 0],
    [0, 1, 2, 2, 1],
    [1, 2, 4, 3, 1],
    [1, 3, 4, 3, 2],
    [0, 1, 2, 1, 1],
  ];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      s.addShape(pres.ShapeType.rect, {
        x: gA + c * G,
        y: gy + r * G,
        w: G - 0.03,
        h: G - 0.03,
        fill: { color: R2 },
        line: { color: WHITE, width: 1 },
      });
      s.addShape(pres.ShapeType.rect, {
        x: gB + c * G,
        y: gy + r * G,
        w: G - 0.03,
        h: G - 0.03,
        fill: { color: RAMP[heat[r][c]] },
        line: { color: WHITE, width: 1 },
      });
    }
  }

  s.addText('One alert, whole city', {
    x: gA - 0.06,
    y: 1.66,
    w: 1.6,
    h: 0.28,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11.5,
    bold: true,
    color: MUTED,
  });
  s.addText('What is actually happening', {
    x: gB - 0.06,
    y: 1.66,
    w: 2.1,
    h: 0.28,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11.5,
    bold: true,
    color: R4,
  });
  s.addText('vs', {
    x: gA + 1.52,
    y: 2.62,
    w: 1.1,
    h: 0.3,
    isTextBox: true,
    margin: 0,
    align: 'center',
    fontFace: BODY,
    fontSize: 12,
    italic: true,
    color: FAINT,
  });
  s.addText(
    'Same city, same hour. The alert is uniform; the risk is not — and the hottest pockets hold the people least able to cope.',
    {
      x: 7.55,
      y: 3.56,
      w: 4.75,
      h: 0.5,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 11,
      color: MUTED,
    },
  );


  // One-liner, given the weight it deserves
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.2,
    y: 4.34,
    w: 5.45,
    h: 1.95,
    rectRadius: 0.06,
    fill: { color: R4 },
    line: { color: R4, width: 0 },
  });
  heading(s, 'Our idea, in one line', { x: 7.55, y: 4.64, w: 4.8, size: 12, color: 'F0C9C6' });
  s.addText(
    'HeatShield turns a citywide heatwave alert into a ward-level action plan — mapping who is at risk, ' +
      'forecasting it forward, and recommending exactly where to send relief.',
    {
      x: 7.55,
      y: 5.0,
      w: 4.8,
      h: 1.15,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 14,
      bold: true,
      color: WHITE,
      lineSpacingMultiple: 1.16,
    },
  );

  s.addNotes(
    'Anchor on the Ahmedabad 2013 HAP: it proved city-scale heat action saves lives, and the NDMA scaled it to 23 states. ' +
      'The unsolved part is intra-city targeting.',
  );
}

// ===========================================================================
// 4 — Objectives
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 4, 'Objectives', R1);


  heading(s, 'Key goals — one chain, four links', { x: M, y: 1.28, w: 8.0, size: 15, color: R4 });

  // A genuine sequence, so it is drawn as one: each stage consumes the last.
  const stages = [
    ['Map', 'Heat vulnerability at grid and ward level — not one number for the whole city.'],
    ['Forecast', 'Push that risk 24–72 hours forward on live weather, so it updates daily instead of sitting frozen.'],
    ['Place', 'Recommend where cooling relief should go, so the resources a city already has protect the most people.'],
    ['Advise', 'Generate ward-level advisories a municipal officer can act on directly.'],
  ];

  const sw = 2.6;    // 4 * 2.6 + 3 * 0.511 = 11.93, inside the 0.7 margins
  const sgap = 0.511;
  const sy = 1.78;
  const sh = 2.3;

  stages.forEach((st, i) => {
    const x = M + i * (sw + sgap);
    const c = RAMP[i + 1];

    panel(s, { x, y: sy, w: sw, h: sh });
    s.addShape(pres.ShapeType.rect, {
      x: x + 0.28,
      y: sy + 0.3,
      w: 0.42,
      h: 0.42,
      fill: { color: c },
      line: { color: c, width: 0 },
    });
    s.addText(String(i + 1), {
      x: x + 0.28,
      y: sy + 0.3,
      w: 0.42,
      h: 0.42,
      isTextBox: true,
      margin: 0,
      align: 'center',
      valign: 'middle',
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: i + 1 >= 3 ? WHITE : INK,
    });
    s.addText(st[0], {
      x: x + 0.28,
      y: sy + 0.86,
      w: sw - 0.56,
      h: 0.36,
      isTextBox: true,
      margin: 0,
      fontFace: HEAD,
      fontSize: 19,
      bold: true,
      color: INK,
    });
    body(s, st[1], { x: x + 0.28, y: sy + 1.28, w: sw - 0.56, h: 0.9, size: 12 });

    if (i < stages.length - 1) {
      connector(s, x + sw + 0.1, sy + sh / 2, x + sw + sgap - 0.1, sy + sh / 2);
    }
  });


  // Impact and beneficiaries sit below the chain, not beside it.
  panel(s, { x: M, y: 4.36, w: 5.86, h: 1.92 });
  heading(s, 'Expected impact', { x: M + 0.32, y: 4.64, w: 5.2, size: 14, color: R4 });
  body(
    s,
    'Better-targeted relief without needing more resources — the same number of cooling centres and water points ' +
      'protecting more people, because they sit where risk actually concentrates. And a faster, more specific ' +
      'municipal response than a citywide alert allows.',
    { x: M + 0.32, y: 5.02, w: 5.2, h: 1.1, size: 12.5 },
  );

  panel(s, { x: 6.77, y: 4.36, w: 5.86, h: 1.92 });
  heading(s, 'End beneficiaries', { x: 7.09, y: 4.64, w: 5.2, size: 14, color: R4 });
  bullets(
    s,
    [
      'Municipal disaster management cells and city health departments — the direct users',
      'Urban poor, outdoor workers and elderly residents — the people hardest to reach through generic alerts',
    ],
    { x: 7.22, y: 5.02, w: 5.07, h: 1.1, size: 12.5, gap: 8 },
  );


  s.addNotes('Four goals map one-to-one onto the four modules on the next slide.');
}

// ===========================================================================
// 5 — Proposed Solution / Architecture
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 5, 'Proposed Solution / Architecture', R2);

  function box(o) {
    s.addShape(pres.ShapeType.roundRect, {
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      rectRadius: 0.05,
      fill: { color: o.fill },
      line: { color: o.line || o.fill, width: 1 },
    });
    s.addText(o.title, {
      x: o.x + 0.14,
      y: o.y + 0.1,
      w: o.w - 0.28,
      h: 0.26,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 12.5,
      bold: true,
      color: o.fg || INK,
    });
    s.addText(o.sub, {
      x: o.x + 0.14,
      y: o.y + 0.37,
      w: o.w - 0.28,
      h: o.h - 0.47,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 10.5,
      color: o.subFg || MUTED,
      lineSpacingMultiple: 1.06,
    });
  }

  // --- inputs -------------------------------------------------------------
  s.addText('Data ingestion', {
    x: M,
    y: 1.22,
    w: 2.9,
    h: 0.26,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11,
    bold: true,
    color: FAINT,
  });
  box({
    x: M,
    y: 1.55,
    w: 2.9,
    h: 1.28,
    fill: 'FDF3D6',
    line: 'F0DDA4',
    title: 'Static vulnerability layer',
    sub: 'Satellite land-surface temperature, tree cover, building density, census vulnerability. Precomputed once per city.',
  });
  box({
    x: M,
    y: 3.12,
    w: 2.9,
    h: 1.28,
    fill: 'FDF3D6',
    line: 'F0DDA4',
    title: 'Live weather forecast',
    sub: 'Open-Meteo 24–72 h temperature and humidity, refreshed daily.',
  });

  // --- risk engine --------------------------------------------------------
  s.addText('Risk engine', {
    x: 4.35,
    y: 1.22,
    w: 3.0,
    h: 0.26,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11,
    bold: true,
    color: FAINT,
  });
  box({
    x: 4.35,
    y: 1.9,
    w: 3.0,
    h: 2.5,
    fill: R4,
    line: R4,
    fg: WHITE,
    subFg: 'F2D3D0',
    title: 'Per-cell risk score',
    sub:
      'Fuses the static layer with today’s forecast into a grid-level heat-risk surface that updates daily — ' +
      'not a frozen historical atlas.',
  });

  connector(s, 3.6, 2.19, 4.32, 3.04);
  connector(s, 3.6, 3.76, 4.32, 3.06);

  // --- outputs ------------------------------------------------------------
  s.addText('Action layer', {
    x: 8.5,
    y: 1.22,
    w: 4.15,
    h: 0.26,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11,
    bold: true,
    color: FAINT,
  });
  const outs = [
    ['Interactive map', 'Renders the risk surface; drill into any cell or ward for its vulnerability breakdown.', 'FDE7DA', 'F5C9AE'],
    ['Siting optimizer', 'Reads the surface against existing hospitals and water points, then recommends where new relief should go.', 'FADFD8', 'EFB6AA'],
    ['Advisory generator', 'An LLM turns a ward’s risk data into a short, plain-language advisory an officer can send.', 'F7D8D5', 'E7A8A3'],
  ];
  const oTop = 1.5;
  const oH = 0.94;
  const oGap = 0.22;
  outs.forEach((o, i) => {
    const y = oTop + i * (oH + oGap);
    box({ x: 8.5, y, w: 4.15, h: oH, fill: o[2], line: o[3], title: o[0], sub: o[1] });
    connector(s, 7.45, 3.15, 8.4, y + oH / 2);
  });

  // --- stack + scalability ------------------------------------------------
  s.addShape(pres.ShapeType.line, {
    x: M,
    y: 4.9,
    w: W - M * 2,
    h: 0,
    line: { color: 'E4E1DE', width: 1 },
  });

  heading(s, 'Key technologies', { x: M, y: 5.1, w: 6.5, size: 13, color: R4 });
  body(
    s,
    'Next.js + TypeScript frontend  ·  MapLibre GL for the interactive map  ·  Neon (Postgres) for storage  ·  ' +
      'hand-written coverage-optimisation algorithm  ·  Gemini API for advisory text  ·  deployed on Vercel.',
    { x: M, y: 5.46, w: 6.5, h: 1.0, size: 12.5 },
  );

  heading(s, 'Scalability and feasibility', { x: 7.5, y: 5.1, w: 5.15, size: 13, color: R4 });
  body(
    s,
    'The architecture is city-agnostic. The same pipeline runs for any Indian city once its static ' +
      'vulnerability layer is precomputed — built to extend city by city, not rebuilt per city.',
    { x: 7.5, y: 5.46, w: 5.15, h: 1.0, size: 12.5 },
  );

  s.addNotes(
    'Read the diagram left to right: two data sources merge into one risk surface, which feeds three ' +
      'consumers. The optimizer is the piece comparable projects do not attempt.',
  );
}

// ===========================================================================
// 6 — Unique Features / Innovation
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 6, 'Unique Features / Innovation', R3);

  // The headline differentiator, given the most weight.
  s.addShape(pres.ShapeType.roundRect, {
    x: M,
    y: 1.3,
    w: W - M * 2,
    h: 1.5,
    rectRadius: 0.06,
    fill: { color: R4 },
    line: { color: R4, width: 0 },
  });
  s.addText('The differentiator is the action layer, not the map.', {
    x: M + 0.4,
    y: 1.5,
    w: 11.5,
    h: 0.5,
    isTextBox: true,
    margin: 0,
    fontFace: HEAD,
    fontSize: 26,
    bold: true,
    color: WHITE,
  });
  s.addText(
    'Hyperlocal heat mapping already exists in India — SEEDS with Microsoft, IIT Mandi. HeatShield’s contribution is ' +
      'closing the loop from risk map to resource placement: a siting optimizer most comparable projects do not attempt.',
    {
      x: M + 0.4,
      y: 2.05,
      w: 11.5,
      h: 0.65,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 13.5,
      color: 'F2D3D0',
      lineSpacingMultiple: 1.14,
    },
  );

  const cards = [
    [
      'Live, not static',
      'The risk surface moves with the daily forecast instead of being a fixed historical vulnerability atlas. ' +
        'It answers “where is it dangerous today,” not just “where is it historically hot.”',
      R1,
    ],
    [
      'Built for the last mile',
      'Auto-generated ward-level advisories mean the output is something a municipal officer can act on directly — ' +
        'not one more dashboard for analysts.',
      R2,
    ],
    [
      'Optimisation, not just visualisation',
      'A coverage-maximising algorithm turns the map into a ranked list of placements, with the population gain ' +
        'each one buys made explicit.',
      R3,
    ],
  ];

  const cw = 3.87;
  const cgap = 0.42;
  cards.forEach((c, i) => {
    const x = M + i * (cw + cgap);
    panel(s, { x, y: 3.15, w: cw, h: 2.75 });
    s.addShape(pres.ShapeType.rect, {
      x: x + 0.32,
      y: 3.47,
      w: 0.34,
      h: 0.34,
      fill: { color: c[2] },
      line: { color: c[2], width: 0 },
    });
    s.addText(c[0], {
      x: x + 0.32,
      y: 3.95,
      w: cw - 0.64,
      h: 0.62,
      isTextBox: true,
      margin: 0,
      fontFace: BODY,
      fontSize: 15,
      bold: true,
      color: INK,
      lineSpacingMultiple: 1.06,
    });
    body(s, c[1], { x: x + 0.32, y: 4.62, w: cw - 0.64, h: 1.15, size: 12.5 });
  });

  s.addNotes('If a judge asks “this exists already” — yes, the map does. The placement decision does not.');
}

// ===========================================================================
// 7 — Expected Outcomes
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 7, 'Expected Outcomes', R4);

  heading(s, 'Deliverables', { x: M, y: 1.28, w: 6.2, size: 15, color: R4 });
  bullets(
    s,
    [
      'A working web dashboard with a live, interactive ward-level heat-risk map',
      'A siting-recommendation tool showing coverage gained against current facility placement',
      'Auto-generated advisory text for any selected ward',
    ],
    { x: M + 0.15, y: 1.68, w: 6.05, h: 1.6, size: 13.5 },
  );

  heading(s, 'Short-term impact', { x: M, y: 3.42, w: 6.2, size: 15, color: R4 });
  body(
    s,
    'A demonstrable prototype for one Indian city showing measurably better relief placement than the status quo — ' +
      'a concrete “current placement protects X people, recommended placement protects Y” comparison, computed live.',
    { x: M, y: 3.8, w: 6.2, h: 1.15, size: 13.5 },
  );

  heading(s, 'Long-term impact', { x: M, y: 5.02, w: 6.2, size: 15, color: R4 });
  body(
    s,
    'A template municipalities could adopt city by city, to make Heat Action Plans hyperlocal and actionable ' +
      'rather than citywide and generic.',
    { x: M, y: 5.4, w: 6.2, h: 0.95, size: 13.5 },
  );

  // Right: the coverage comparison, drawn as a schematic — targets, not results.
  panel(s, { x: 7.5, y: 1.28, w: 5.15, h: 3.02 });
  heading(s, 'The number the demo produces', { x: 7.85, y: 1.58, w: 4.45, size: 13, color: R4 });
  body(
    s,
    'Coverage of the at-risk population, before and after the optimizer’s recommended placements:',
    { x: 7.85, y: 1.95, w: 4.45, h: 0.6, size: 12 },
  );

  const barX = 7.85;
  const barW = 4.45;
  s.addText('Current placement', {
    x: barX,
    y: 2.62,
    w: barW,
    h: 0.24,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11.5,
    color: MUTED,
  });
  s.addShape(pres.ShapeType.rect, {
    x: barX,
    y: 2.9,
    w: barW,
    h: 0.3,
    fill: { color: 'E8E5E2' },
    line: { color: 'E8E5E2', width: 0 },
  });
  s.addShape(pres.ShapeType.rect, {
    x: barX,
    y: 2.9,
    w: barW * 0.32,
    h: 0.3,
    fill: { color: FAINT },
    line: { color: FAINT, width: 0 },
  });

  s.addText('With recommended placements', {
    x: barX,
    y: 3.32,
    w: barW,
    h: 0.24,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 11.5,
    color: MUTED,
  });
  s.addShape(pres.ShapeType.rect, {
    x: barX,
    y: 3.6,
    w: barW,
    h: 0.3,
    fill: { color: 'E8E5E2' },
    line: { color: 'E8E5E2', width: 0 },
  });
  s.addShape(pres.ShapeType.rect, {
    x: barX,
    y: 3.6,
    w: barW * 0.72,
    h: 0.3,
    fill: { color: R3 },
    line: { color: R3, width: 0 },
  });
  s.addText('Illustrative — the live figure is computed per city and per day, not fixed.', {
    x: barX,
    y: 3.94,
    w: barW,
    h: 0.24,
    isTextBox: true,
    margin: 0,
    fontFace: BODY,
    fontSize: 9.5,
    italic: true,
    color: FAINT,
  });

  panel(s, { x: 7.5, y: 4.35, w: 5.15, h: 1.95 });
  heading(s, 'Scope to scale', { x: 7.85, y: 4.62, w: 4.45, size: 13, color: R4 });
  bullets(
    s,
    [
      'More cities, by precomputing their vulnerability layers',
      'Beyond heat — flooding, air quality — on the same map → forecast → optimise → advise pattern',
    ],
    { x: 7.98, y: 4.98, w: 4.3, h: 1.2, size: 12, gap: 8 },
  );

  s.addNotes(
    'The bar chart is schematic and labelled as illustrative. The real figure is produced live by the ' +
      'optimizer for whichever city and day is on screen.',
  );
}

// ===========================================================================
// 8 — Conclusion
// ===========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionHead(s, 8, 'Conclusion', R4);

  s.addText(
    'Heat mapping in India is a solved problem.\nHeat action isn’t.',
    {
      x: M,
      y: 1.5,
      w: 7.9,
      h: 2.0,
      isTextBox: true,
      margin: 0,
      fontFace: HEAD,
      fontSize: 31,
      bold: true,
      color: INK,
      lineSpacingMultiple: 1.14,
    },
  );
  body(
    s,
    'HeatShield takes proven hyperlocal risk-mapping and closes the gap the existing tools leave open — ' +
      'turning a citywide alert into a live, ward-level plan for exactly where to send relief.',
    { x: M, y: 3.66, w: 7.6, h: 1.0, size: 15, color: INK },
  );

  heading(s, 'Why it should be selected', { x: M, y: 4.78, w: 7.4, size: 15, color: R4 });
  bullets(
    s,
    [
      'Not novel for novelty’s sake — it builds on India’s own Ahmedabad Heat Action Plan legacy',
      'It targets a documented life-and-death gap, not a hypothetical one',
      'Scoped as a working, demoable system — not a single model or a static dashboard',
    ],
    { x: M + 0.15, y: 5.16, w: 7.4, h: 1.6, size: 13.5 },
  );

  // Closing mark: the ramp again, as the deck's motif resolving.
  RAMP.forEach((c, i) => {
    s.addShape(pres.ShapeType.rect, {
      x: 8.9,
      y: 1.5 + i * 0.78,
      w: 3.75,
      h: 0.72,
      fill: { color: c },
      line: { color: c, width: 0 },
    });
  });
  s.addText('HeatShield', {
    x: 8.9,
    y: 5.55,
    w: 3.75,
    h: 0.45,
    isTextBox: true,
    margin: 0,
    align: 'right',
    fontFace: HEAD,
    fontSize: 22,
    bold: true,
    color: INK,
  });
  s.addText('From heatwave alerts to hyperlocal action.', {
    x: 8.9,
    y: 5.98,
    w: 3.75,
    h: 0.3,
    isTextBox: true,
    margin: 0,
    align: 'right',
    fontFace: BODY,
    fontSize: 11.5,
    color: MUTED,
  });

  s.addNotes('Close on the one-liner. Invite questions on the optimizer — that is the strongest ground.');
}

function TEAM_TEXT() {
  return require('./team.js');
}

pres.writeFile({ fileName: process.argv[2] || 'HeatShield.pptx' }).then((f) => {
  console.log('wrote', f);
});
