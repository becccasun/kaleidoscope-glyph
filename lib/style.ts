import type { Cell, Point } from "./geometry";

export type FillPattern = "solid" | "dots" | "rings";

export interface GlyphStyle {
  /** 0 = sharp polygon corners, 1 = fully blobby */
  roundness: number;
  fill: FillPattern;
  /** pattern rings from center to rim — higher is denser */
  grain: number;
}

export const DEFAULT_STYLE: GlyphStyle = { roundness: 0, fill: "solid", grain: 12 };

/** A segment ends at `to`; with `c` it is a quadratic curve through control `c`. */
export interface Seg {
  c?: Point;
  to: Point;
}
/** A closed outline in normalized disc space. */
export interface Contour {
  start: Point;
  segs: Seg[];
}

/** Anything that can trace a path: canvas context, opentype.js Path, SVG string builder. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadTo(cx: number, cy: number, x: number, y: number): void;
  close(): void;
}

/** Roundness at which every corner is fully filleted; above it the outline itself is smoothed. */
const FILLET_PHASE = 0.4;
/** Smoothing passes at roundness 1, over an outline resampled every SMOOTH_SPACING units. */
const MAX_SMOOTHING = 40;
const SMOOTH_SPACING = 0.02;

/**
 * Turns a glyph's filled cells into its final outlines:
 * 1. union the cells into boundary loops (shared edges cancel),
 * 2. round it by `roundness` (see roundLoop),
 * 3. for dots, keep the dots whose centers land inside that shape; for rings, keep the
 *    stretches of each concentric band that run inside it.
 */
export function styleGlyph(
  cells: Cell[],
  filled: Iterable<number>,
  symmetry: number,
  style: GlyphStyle,
): Contour[] {
  const loops = unionLoops(cells, filled);
  const shape = loops.map((l) => roundLoop(l, style.roundness));
  if (style.fill === "solid") return shape;

  const inside = insideTester(shape.map((c) => flatten(c, 4)));
  if (style.fill === "rings") return ringBands(inside, symmetry, style.grain);
  const s = 1 / style.grain;
  const out: Contour[] = [];
  for (const [x, y] of patternSites(symmetry, style.grain)) {
    if (inside(x, y)) out.push(dot(x, y, s * 0.36));
  }
  return out;
}

export function traceContours(contours: Contour[], transform: (p: Point) => Point, sink: PathSink) {
  for (const { start, segs } of contours) {
    const [sx, sy] = transform(start);
    sink.moveTo(sx, sy);
    for (const { c, to } of segs) {
      const [x, y] = transform(to);
      if (c) {
        const [cx, cy] = transform(c);
        sink.quadTo(cx, cy, x, y);
      } else sink.lineTo(x, y);
    }
    sink.close();
  }
}

export function contoursToSvgPath(
  contours: Contour[],
  transform: (p: Point) => Point,
  precision = 2,
): string {
  let d = "";
  const f = (n: number) => n.toFixed(precision);
  traceContours(contours, transform, {
    moveTo: (x, y) => (d += `M${f(x)} ${f(y)}`),
    lineTo: (x, y) => (d += `L${f(x)} ${f(y)}`),
    quadTo: (cx, cy, x, y) => (d += `Q${f(cx)} ${f(cy)} ${f(x)} ${f(y)}`),
    close: () => (d += "Z"),
  });
  return d;
}

// ── union ────────────────────────────────────────────────────────────────

interface Edge {
  a: Point;
  ka: string;
  kb: string;
}

/**
 * Voronoi neighbours share bit-identical vertices and all cells carry the same
 * winding, so an edge between two filled cells appears once in each direction.
 * Dropping those pairs leaves only the outer boundary (and holes, reversed).
 */
function unionLoops(cells: Cell[], filled: Iterable<number>): Point[][] {
  // Snap to an integer grid. toFixed would print a vertex on a mirror axis as "-0.000000"
  // in one cell and "0.000000" in its neighbour, so their shared edge never cancelled and
  // the outline tore open; Math.round gives both the same 0.
  const key = (p: Point) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  const edges = new Map<string, Edge>();
  for (const i of filled) {
    const cell = cells[i];
    if (!cell) continue;
    for (let j = 0; j < cell.length; j++) {
      const a = cell[j];
      const ka = key(a);
      const kb = key(cell[(j + 1) % cell.length]);
      if (ka === kb) continue;
      const rev = `${kb}>${ka}`;
      if (edges.has(rev)) edges.delete(rev);
      else edges.set(`${ka}>${kb}`, { a, ka, kb });
    }
  }

  const outgoing = new Map<string, Edge[]>();
  for (const e of edges.values()) {
    const list = outgoing.get(e.ka);
    if (list) list.push(e);
    else outgoing.set(e.ka, [e]);
  }

  const loops: Point[][] = [];
  for (const list of outgoing.values()) {
    while (list.length) {
      const first = list.pop()!;
      const loop: Point[] = [first.a];
      let cur = first;
      while (cur.kb !== first.ka) {
        const next = outgoing.get(cur.kb)?.pop();
        if (!next) break;
        loop.push(next.a);
        cur = next;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

// ── rounding ─────────────────────────────────────────────────────────────

/**
 * Roundness runs in two phases so the whole slider range keeps changing the shape:
 * - 0 → FILLET_PHASE: corners are cut back along both edges and curved through the
 *   vertex, growing until neighbouring curves meet at edge midpoints (a smooth spline
 *   through the original polygon).
 * - FILLET_PHASE → 1: the polygon itself is smoothed first, ironing out the Voronoi
 *   wobble into broad, blobby curves.
 */
function roundLoop(loop: Point[], roundness: number): Contour {
  if (roundness <= 0) {
    return { start: loop[0], segs: loop.slice(1).map((to) => ({ to })) };
  }
  if (roundness <= FILLET_PHASE) return filletLoop(loop, roundness / FILLET_PHASE);
  // Start from the fully filleted outline (what FILLET_PHASE draws) so the phases join
  // seamlessly, then smooth it. Eased so each slider step changes the shape by a similar amount.
  const t = (roundness - FILLET_PHASE) / (1 - FILLET_PHASE);
  const dense = resample(flatten(filletLoop(loop, 1), 4), SMOOTH_SPACING);
  return filletLoop(smoothLoop(dense, MAX_SMOOTHING * t ** 1.6), 1);
}

/**
 * Cuts every corner back along both edges (by `fillet` × half of each edge) and curves
 * through the vertex. At fillet 1 neighbouring curves meet at edge midpoints, giving a
 * smooth spline through the polygon.
 */
function filletLoop(pts: Point[], fillet: number): Contour {
  const n = pts.length;
  const cuts = pts.map((v, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    return { a: lerp(v, prev, fillet / 2), v, b: lerp(v, next, fillet / 2) };
  });
  const segs: Seg[] = [];
  cuts.forEach(({ v, b }, i) => {
    segs.push({ c: v, to: b });
    const nextA = cuts[(i + 1) % n].a;
    if (i < n - 1 && dist(b, nextA) > 1e-9) segs.push({ to: nextA });
  });
  return { start: cuts[0].a, segs };
}

/**
 * Laplacian smoothing with a partial inflate step after each pass: pointed tips and
 * wobble melt into broad curves, while the inflate keeps strokes from thinning out.
 * (Full Taubin compensation preserves the tips too, so the top of the slider barely
 * changed.) Fractional `passes` blend between whole passes, keeping the slider continuous.
 */
/** Even arc-length spacing, so every smoothing pass reaches the same distance along the outline. */
function resample(loop: Point[], spacing: number): Point[] {
  const n = loop.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += dist(loop[i], loop[(i + 1) % n]);
  const count = Math.max(8, Math.round(total / spacing));
  const step = total / count;
  const out: Point[] = [];
  let i = 0;
  let along = 0; // distance from loop[i] to the next sample
  for (let k = 0; k < count; k++) {
    let len = dist(loop[i], loop[(i + 1) % n]);
    while (along > len && i < n - 1) {
      along -= len;
      i++;
      len = dist(loop[i], loop[(i + 1) % n]);
    }
    out.push(lerp(loop[i], loop[(i + 1) % n], len > 0 ? Math.min(1, along / len) : 0));
    along += step;
  }
  return out;
}

function smoothLoop(loop: Point[], passes: number): Point[] {
  let pts = loop;
  const step = (src: Point[], k: number): Point[] =>
    src.map((p, i) => {
      const a = src[(i - 1 + src.length) % src.length];
      const b = src[(i + 1) % src.length];
      return [p[0] + k * ((a[0] + b[0]) / 2 - p[0]), p[1] + k * ((a[1] + b[1]) / 2 - p[1])];
    });
  const pass = (src: Point[]) => step(step(src, 0.6), -0.3);
  const whole = Math.floor(passes);
  for (let i = 0; i < whole; i++) pts = pass(pts);
  const frac = passes - whole;
  if (frac > 0) {
    const next = pass(pts);
    pts = pts.map((p, i) => lerp(p, next[i], frac));
  }
  return pts;
}

const dist = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const lerp = (p: Point, q: Point, t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

// ── pattern fill ─────────────────────────────────────────────────────────

/**
 * Concentric rings of sites. Each ring's count is a multiple of `symmetry` and
 * rings alternate a half-step offset, so the pattern keeps the kaleidoscope's
 * dihedral symmetry. Returns [x, y, outward angle].
 */
function patternSites(symmetry: number, grain: number): Array<[number, number, number]> {
  const s = 1 / grain;
  const sites: Array<[number, number, number]> = [[0, 0, -Math.PI / 2]];
  for (let k = 1; k <= grain; k++) {
    const r = k * s;
    const n = Math.max(1, Math.round((2 * Math.PI * k) / symmetry)) * symmetry;
    const offset = (k % 2) * 0.5;
    for (let j = 0; j < n; j++) {
      const a = ((j + offset) / n) * Math.PI * 2;
      sites.push([r * Math.cos(a), r * Math.sin(a), a]);
    }
  }
  return sites;
}

function dot(x: number, y: number, r: number): Contour {
  // circle from 8 quadratic arcs
  const k = 8;
  const rc = r / Math.cos(Math.PI / k);
  const at = (a: number, rr: number): Point => [x + rr * Math.cos(a), y + rr * Math.sin(a)];
  const segs: Seg[] = [];
  for (let i = 1; i <= k; i++) {
    const a = (i / k) * Math.PI * 2;
    segs.push({ c: at(a - Math.PI / k, rc), to: at(a, r) });
  }
  return { start: at(0, r), segs };
}

/**
 * Concentric bands, one per ring of the dot pattern, cut where they leave the shape.
 * Each ring is split into short steps (a multiple of `symmetry`, so the cuts keep the
 * kaleidoscope's symmetry); consecutive steps inside the shape join into one arc, so a
 * band reads as a continuous line rather than a row of tiles. The center is a dot.
 */
function ringBands(inside: (x: number, y: number) => boolean, symmetry: number, grain: number): Contour[] {
  const s = 1 / grain;
  const half = s * 0.3; // band 0.6 of the pitch, gap 0.4
  const out: Contour[] = [];
  if (inside(0, 0)) out.push(dot(0, 0, half));
  for (let k = 1; k <= grain; k++) {
    const r = k * s;
    const n = Math.max(1, Math.round((2 * Math.PI * r) / (s * 0.35) / symmetry)) * symmetry;
    const da = (Math.PI * 2) / n;
    const on = Array.from({ length: n }, (_, j) => inside(r * Math.cos((j + 0.5) * da), r * Math.sin((j + 0.5) * da)));
    if (on.every(Boolean)) {
      out.push(...arcBand(r - half, r + half, 0, n, da, true));
      continue;
    }
    // start the walk on a gap so no run wraps past the end
    const from = on.indexOf(false);
    let run = -1;
    for (let t = 1; t <= n; t++) {
      const j = (from + t) % n;
      if (on[j] && run < 0) run = from + t;
      if ((!on[j] || t === n) && run >= 0) {
        out.push(...arcBand(r - half, r + half, run, from + t, da, false));
        run = -1;
      }
    }
  }
  return out;
}

/**
 * The band between radii r0 and r1 from step a to step b. A full ring is an outer circle
 * and a reversed inner one, so nonzero winding leaves the middle open.
 */
function arcBand(r0: number, r1: number, a: number, b: number, da: number, full: boolean): Contour[] {
  const at = (step: number, r: number): Point => [r * Math.cos(step * da), r * Math.sin(step * da)];
  const ctl = (step: number, r: number) => at(step + 0.5, r / Math.cos(da / 2));
  const outer: Seg[] = [];
  for (let i = a; i < b; i++) outer.push({ c: ctl(i, r1), to: at(i + 1, r1) });
  const inner: Seg[] = [];
  for (let i = b; i > a; i--) inner.push({ c: ctl(i - 1, r0), to: at(i - 1, r0) });
  if (full) return [{ start: at(a, r1), segs: outer }, { start: at(b, r0), segs: inner }];
  return [{ start: at(a, r1), segs: [...outer, { to: at(b, r0) }, ...inner] }];
}

/** Contour → polyline, sampling each quadratic `steps` times. */
function flatten({ start, segs }: Contour, steps: number): Point[] {
  const out: Point[] = [start];
  let p = start;
  for (const { c, to } of segs) {
    if (c) {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        out.push([
          u * u * p[0] + 2 * u * t * c[0] + t * t * to[0],
          u * u * p[1] + 2 * u * t * c[1] + t * t * to[1],
        ]);
      }
    } else out.push(to);
    p = to;
  }
  // the last segment returns to start; drop the duplicate point
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-9) out.pop();
  return out;
}

/**
 * Point-in-shape tester with nonzero winding across all rings, so holes (reversed
 * loops) are excluded. Edges are bucketed into horizontal bands so each query only
 * walks the edges that cross its row.
 */
function insideTester(rings: Point[][]): (x: number, y: number) => boolean {
  const BANDS = 64;
  const y0 = -1.2;
  const h = 2.4 / BANDS;
  const bands: number[][] = Array.from({ length: BANDS }, () => []);
  const band = (y: number) => Math.min(BANDS - 1, Math.max(0, Math.floor((y - y0) / h)));
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % n];
      for (let b = band(Math.min(y1, y2)); b <= band(Math.max(y1, y2)); b++) bands[b].push(x1, y1, x2, y2);
    }
  }
  return (x, y) => {
    const e = bands[band(y)];
    let w = 0;
    for (let i = 0; i < e.length; i += 4) {
      const x1 = e[i], y1 = e[i + 1], x2 = e[i + 2], y2 = e[i + 3];
      if (y1 <= y) {
        if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) w++;
      } else if (y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) w--;
    }
    return w !== 0;
  };
}
