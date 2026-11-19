"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Cell, Kaleidoscope } from "@/lib/geometry";
import { cellColors, centroid, tone } from "@/lib/palette";
import { styleGlyph, traceContours, type Contour, type GlyphStyle } from "@/lib/style";
import { playBead, playUnbead } from "@/lib/sounds";

interface Props {
  kaleidoscope: Kaleidoscope;
  filled: number[];
  style: GlyphStyle;
  /** which way the chamber last turned: 1 clockwise, -1 counter */
  turn: RefObject<number>;
  /** bumps when the chamber is shaken, for the glitter */
  shaken: number;
  onStrokeStart: () => void;
  onPaint: (indices: number[], on: boolean) => void;
}

/** the disc's radius inside the eyepiece: rim cells reach a little past 1 */
const FIT = 0.93;
const CHAMBER = "#0C0C0C";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
  rot: number;
  /** a glint swells and fades in place; a fleck flies and falls */
  glint: boolean;
}

/**
 * The chamber. Every cell is a bead of glass, dark until you light it. The lit
 * beads are clipped to the styled glyph outline, so what glows here is exactly the
 * shape that goes into the font. Two stacked canvases: the beads themselves (redrawn
 * only when the glyph changes), and the glitter with the pointer's highlight (redrawn
 * every frame).
 */
export function Scope({ kaleidoscope, filled, style, turn, shaken, onStrokeStart, onPaint }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const beadsRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);

  const drag = useRef<{ on: boolean; last: number; x: number; y: number; done: Set<number> } | null>(null);
  const hover = useRef(-1);
  const sparks = useRef<Spark[]>([]);

  const filledSet = useMemo(() => new Set(filled), [filled]);
  const colors = useMemo(() => cellColors(kaleidoscope), [kaleidoscope]);
  const contours = useMemo(
    () => styleGlyph(kaleidoscope.cells, filled, kaleidoscope.symmetry, style),
    [kaleidoscope, filled, style],
  );

  // what the per-frame loop reads, without restarting it
  const live = useRef({ size, cells: kaleidoscope.cells, colors, filled, filledSet });
  useLayoutEffect(() => {
    live.current = { size, cells: kaleidoscope.cells, colors, filled, filledSet };
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── the beads ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = beadsRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBeads(ctx, size, kaleidoscope.cells, colors, filledSet, contours);
  }, [kaleidoscope, colors, filledSet, contours, size]);

  // ── the chamber turns when its pattern changes ─────────────────────────
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    hover.current = -1;
    const el = turnRef.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { transform: `rotate(${-turn.current * 50}deg) scale(0.9)`, filter: "blur(5px)", opacity: 0.35 },
        { transform: "rotate(0deg) scale(1)", filter: "blur(0px)", opacity: 1 },
      ],
      { duration: 560, easing: "cubic-bezier(0.2, 0.9, 0.25, 1.12)" },
    );
    // turn is read at the moment the pattern changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kaleidoscope]);

  // ── glitter ────────────────────────────────────────────────────────────
  const toPx = (p: readonly [number, number], s: number): [number, number] => [
    s / 2 + p[0] * (s / 2) * FIT,
    s / 2 + p[1] * (s / 2) * FIT,
  ];

  const burst = useCallback((index: number, lit: boolean) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const { size: s, cells } = live.current;
    const cell = cells[index];
    if (!cell) return;
    const [x, y] = toPx(centroid(cell), s);
    const n = lit ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (lit ? 30 : 12) + Math.random() * (lit ? 70 : 20);
      sparks.current.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (lit ? 20 : 0),
        age: 0,
        life: 420 + Math.random() * 420,
        size: lit ? 2.5 + Math.random() * 4 : 1.5 + Math.random() * 1.5,
        color: lit ? "#FFFFFF" : "rgba(255,255,255,0.45)",
        rot: Math.random() * Math.PI,
        glint: false,
      });
    }
  }, []);

  // a shake throws glitter across the whole chamber
  useEffect(() => {
    if (!shaken || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const s = live.current.size;
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (s / 2) * 0.9;
      const v = 40 + Math.random() * 120;
      sparks.current.push({
        x: s / 2 + Math.cos(a) * r,
        y: s / 2 + Math.sin(a) * r,
        vx: Math.cos(a + 1.4) * v,
        vy: Math.sin(a + 1.4) * v,
        age: 0,
        life: 500 + Math.random() * 600,
        size: 2 + Math.random() * 4.5,
        color: i % 3 === 0 ? "#FFFFFF" : "rgba(255,255,255,0.6)",
        rot: Math.random() * Math.PI,
        glint: false,
      });
    }
  }, [shaken]);

  useEffect(() => {
    const canvas = fxRef.current;
    if (!canvas || size === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let prev = 0;
    let sinceGlint = 0;

    const frame = (t: number) => {
      const dt = prev ? Math.min(50, t - prev) : 16;
      prev = t;
      const { size: s, cells, filled: lit, filledSet: set } = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, s, s);

      // the bead under the pointer
      const h = hover.current;
      if (h >= 0 && cells[h]) {
        ctx.beginPath();
        tracePoly(ctx, cells[h], s);
        ctx.fillStyle = set.has(h) ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.2)";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.stroke();
      }

      if (!still) {
        // now and then a lit bead catches the light
        sinceGlint += dt;
        if (lit.length && sinceGlint > Math.max(90, 520 - lit.length * 6)) {
          sinceGlint = 0;
          const cell = cells[lit[Math.floor(Math.random() * lit.length)]];
          if (cell) {
            const [x, y] = toPx(cell[Math.floor(Math.random() * cell.length)], s);
            const [cx, cy] = toPx(centroid(cell), s);
            const k = 0.25 + Math.random() * 0.6;
            sparks.current.push({
              x: cx + (x - cx) * k,
              y: cy + (y - cy) * k,
              vx: 0,
              vy: 0,
              age: 0,
              life: 700 + Math.random() * 500,
              size: 3 + Math.random() * 5,
              color: "#FFFFFF",
              rot: 0,
              glint: true,
            });
          }
        }

        const list = sparks.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.age += dt;
          if (p.age >= p.life) {
            list.splice(i, 1);
            continue;
          }
          const u = p.age / p.life;
          let r = p.size;
          if (p.glint) {
            r *= Math.sin(Math.PI * u);
            ctx.globalAlpha = 0.9;
          } else {
            p.x += (p.vx * dt) / 1000;
            p.y += (p.vy * dt) / 1000;
            p.vx *= 0.985;
            p.vy = p.vy * 0.985 + 0.12 * dt;
            p.rot += dt * 0.004;
            r *= 1 - u * 0.5;
            ctx.globalAlpha = 1 - u * u;
          }
          ctx.fillStyle = p.color;
          star(ctx, p.x, p.y, r, p.rot);
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // ── pointer → bead ─────────────────────────────────────────────────────
  const hit = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      const R = (rect.width / 2) * FIT;
      const x = (clientX - rect.left - rect.width / 2) / R;
      const y = (clientY - rect.top - rect.height / 2) / R;
      return kaleidoscope.find(x, y);
    },
    [kaleidoscope],
  );

  const light = (i: number, on: boolean) => {
    onPaint([i], on);
    burst(i, on);
    if (on) playBead(colors[i]);
    else playUnbead();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const i = hit(e.clientX, e.clientY);
    if (i < 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* a scripted pointer */
    }
    const on = !filledSet.has(i); // dark bead lights, lit bead goes dark
    drag.current = { on, last: i, x: e.clientX, y: e.clientY, done: new Set([i]) };
    onStrokeStart();
    light(i, on);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    hover.current = hit(e.clientX, e.clientY);
    const d = drag.current;
    if (!d) return;
    // walk the line from the last sample, so a fast stroke skips no bead
    const steps = Math.max(1, Math.ceil(Math.hypot(e.clientX - d.x, e.clientY - d.y) / 5));
    for (let n = 1; n <= steps; n++) {
      const i = hit(d.x + ((e.clientX - d.x) * n) / steps, d.y + ((e.clientY - d.y) * n) / steps);
      if (i < 0 || i === d.last) continue;
      d.last = i;
      // `done` covers beads this stroke already changed, before the store re-renders
      if (d.done.has(i) || filledSet.has(i) === d.on) continue;
      d.done.add(i);
      light(i, d.on);
    }
    d.x = e.clientX;
    d.y = e.clientY;
  };

  const endDrag = (e: React.PointerEvent) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="scope">
      <div
        ref={wrapRef}
        className="scope-eye"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          hover.current = -1;
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) drag.current = null;
        }}
        role="img"
        aria-label="Kaleidoscope chamber. Press or drag across the beads to light them."
      >
        <div ref={turnRef} className="scope-turn">
          <canvas ref={beadsRef} style={{ width: size, height: size }} />
        </div>
        <canvas ref={fxRef} className="scope-fx" style={{ width: size, height: size }} />
        <div className="scope-tube" aria-hidden="true" />
      </div>
    </div>
  );
}

// ── drawing ──────────────────────────────────────────────────────────────

function tracePoly(ctx: CanvasRenderingContext2D, cell: Cell, size: number) {
  const c = size / 2;
  const R = c * FIT;
  cell.forEach((p, j) => {
    const x = c + p[0] * R;
    const y = c + p[1] * R;
    if (j === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function drawBeads(
  ctx: CanvasRenderingContext2D,
  size: number,
  cells: Cell[],
  colors: number[],
  lit: Set<number>,
  contours: Contour[],
) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.clip();

  const bg = ctx.createRadialGradient(c, c, 0, c, c, c);
  bg.addColorStop(0, "#232323");
  bg.addColorStop(1, CHAMBER);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // unlit glass: every bead shows faintly; painted ones a little more,
  // so a glyph stays readable under dots and glitter
  cells.forEach((cell, i) => {
    ctx.beginPath();
    tracePoly(ctx, cell, size);
    ctx.globalAlpha = lit.has(i) ? 0.3 : 0.1;
    ctx.fillStyle = tone(colors[i]);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // the leading between beads
  ctx.beginPath();
  cells.forEach((cell) => tracePoly(ctx, cell, size));
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.stroke();

  drawLit(ctx, size, cells, colors, contours, true);
  ctx.restore();
}

/** Lit glass, clipped to the glyph's outline: the same contours that go into the font. */
function drawLit(
  ctx: CanvasRenderingContext2D,
  size: number,
  cells: Cell[],
  colors: number[],
  contours: Contour[],
  glassy: boolean,
) {
  if (!contours.length) return;
  const c = size / 2;
  const R = c * FIT;
  ctx.save();
  ctx.beginPath();
  traceContours(contours, ([x, y]) => [c + x * R, c + y * R], {
    moveTo: (x, y) => ctx.moveTo(x, y),
    lineTo: (x, y) => ctx.lineTo(x, y),
    quadTo: (cx, cy, x, y) => ctx.quadraticCurveTo(cx, cy, x, y),
    close: () => ctx.closePath(),
  });
  ctx.clip();

  // every bead is drawn lit; the clip decides which parts show, so an outline that
  // rounding has pushed past its cells still picks up the neighbouring glass
  cells.forEach((cell, i) => {
    ctx.beginPath();
    tracePoly(ctx, cell, size);
    ctx.fillStyle = tone(colors[i]);
    ctx.fill();
    if (!glassy) return;
    // a soft highlight off the upper left of each bead
    let x = 0;
    let y = 0;
    let far = 0;
    for (const p of cell) {
      x += p[0];
      y += p[1];
    }
    x = c + (x / cell.length) * R;
    y = c + (y / cell.length) * R;
    for (const p of cell) far = Math.max(far, Math.hypot(c + p[0] * R - x, c + p[1] * R - y));
    const g = ctx.createRadialGradient(x - far * 0.35, y - far * 0.4, 0, x, y, far);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.5, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = g;
    ctx.fill();
  });

  if (glassy) {
    ctx.beginPath();
    cells.forEach((cell) => tracePoly(ctx, cell, size));
    ctx.lineJoin = "round";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.stroke();
  }
  ctx.restore();
}

/** A four-point glint. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  if (r <= 0.2) return;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.24 : r;
    const px = x + rr * Math.cos(a);
    const py = y + rr * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
