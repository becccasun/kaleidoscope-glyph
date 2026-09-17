# Kaleidoscope Font Generator

Draw glyphs on radially symmetric Voronoi patterns and export a real `.otf` — entirely in the browser.

- **Spin** builds a new dihedral-symmetric partition (4–12 fold) from a per-letter seed.
- **Click / drag** cells to fill them black; click a black cell to clear it.
- Every character (A–Z, 0–9, plus any custom glyph) keeps its own seed and fill state in `localStorage`.
- **Export .otf** compiles the filled polygons into glyph outlines with `opentype.js` (1000 upm, 700-unit glyph square on the baseline, 40-unit side bearings).

## Stack

Next.js (App Router, TypeScript, Tailwind v4) · `d3-delaunay` · `opentype.js` · `zustand`

```
lib/geometry.ts   seeded PRNG, kaleidoscope Voronoi generator, SVG path helper
lib/font.ts       metrics + opentype.js font builder
lib/store.ts      persisted glyph state
components/       KaleidoscopeCanvas · GlyphGrid · GlyphThumb · Toolbar · Specimen · Editor
```

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # headless: generate geometry, compile an OTF, parse it back
npm run build
```
