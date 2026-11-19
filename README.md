# becca's kaleidoglyph

Light the beads of a kaleidoscope to draw each letter, then export a real `.otf`. Entirely in the browser.

- **The chamber** is the whole stage. Every Voronoi cell is a bead of glass, dark until you press or drag across it. The interface is black, gray and white only. What glows is clipped to the glyph outline, so the chamber shows exactly what goes into the font.
- **The letter dial** rings the chamber: turn it like a collar, press a lens, use the arrow keys, or just type a character to bring it in.
- **Shake** (space) tumbles the current letter into a new pattern from a fresh seed. *Radial splicing* (4 to 12 fold) and *Facets* recut every letter, so once anything is drawn they ask before clearing it.
- **Fill**: Glass (solid), Beads (dots) or Rings (concentric bands), plus *Roundness* and the number of pattern rings. Fill applies to the whole font and never clears a drawing.
- **The word** along the bottom is set in your font from the same outlines. Dotted rings are letters you have not drawn yet: press one to draw it.
- **Preview font** (top right) shows the whole set at once, like a font manager: every glyph loose in a preview, then the repertoire as labelled tiles, with a size slider and the fill switch. Press any glyph to draw it.
- **Delete** or Backspace clears only the letter in the chamber.
- **Undo / redo**: ⌘Z and ⇧⌘Z on Mac, Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) on Windows, the header buttons, or the Undo on the note that appears after anything that clears drawings.
- **Export .otf** compiles the outlines with `opentype.js` (1000 upm, 700-unit glyph square on the baseline, 40-unit side bearings).

Every character keeps its own seed and drawing in `localStorage`.

Several controls are adapted from [Bencho](https://bencho.dev) blocks (Jelly tabs, Tape, Hold to delete, Picker wheel) and the sounds are Bencho's, synthesised with Web Audio.

## Stack

Next.js (App Router, TypeScript, Tailwind v4) · `d3-delaunay` · `opentype.js` · `zustand`

```
lib/geometry.ts   seeded PRNG, kaleidoscope Voronoi generator, SVG path helper
lib/style.ts      cell union, corner rounding, dot/star pattern fills → outline contours
lib/font.ts       metrics + opentype.js font builder
lib/store.ts      persisted glyph state
lib/palette.ts    tones of white per cell, symmetric across the mirrors
lib/sounds.ts     Web Audio voices
components/       Studio · Scope · LetterDial · WordRow · FontBook · ExportButton · GlyphThumb · JellyTabs · Tape · Hold
```

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # headless: generate geometry, compile an OTF, parse it back
npm run build
```
