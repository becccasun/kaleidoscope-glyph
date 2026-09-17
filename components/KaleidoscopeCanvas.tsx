"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Cell } from "@/lib/geometry";
import type { Kaleidoscope } from "@/lib/geometry";

interface Props {
  kaleidoscope: Kaleidoscope;
  filled: number[];
  onPaint: (indices: number[], on: boolean) => void;
}

const OUTLINE = "#D1D5DB";
const HOVER = "#000000";

export function KaleidoscopeCanvas({ kaleidoscope, filled, onPaint }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [hover, setHover] = useState(-1);

  // paint gesture state (ref: no re-render per pointermove)
  const drag = useRef<{ on: boolean; last: number } | null>(null);
  const filledSet = useMemo(() => new Set(filled), [filled]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── draw ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const c = size / 2;
    const R = size / 2 - 8;
    const px = (x: number, y: number): [number, number] => [c + x * R, c + y * R];

    const { cells } = kaleidoscope;
    const set = filledSet;
    const trace = (cell: Cell) => {
      cell.forEach((p, j) => {
        const [x, y] = px(p[0], p[1]);
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    };

    ctx.lineJoin = "round";

    // pass 1: empty cells (thin grey outline)
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    cells.forEach((cell, i) => {
      if (set.has(i)) return;
      trace(cell);
    });
    ctx.stroke();

    // pass 2: filled cells (solid black, slight stroke to hide AA seams)
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    cells.forEach((cell, i) => {
      if (!set.has(i)) return;
      trace(cell);
    });
    ctx.fill();
    ctx.stroke();

    // pass 3: hover ring
    if (hover >= 0 && cells[hover]) {
      ctx.strokeStyle = set.has(hover) ? "#FFF" : HOVER;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      trace(cells[hover]);
      ctx.stroke();
    }
  }, [kaleidoscope, filledSet, hover, size]);

  // ── pointer → cell index ───────────────────────────────────────────────
  const hit = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const R = rect.width / 2 - 8;
      const x = (e.clientX - rect.left - rect.width / 2) / R;
      const y = (e.clientY - rect.top - rect.height / 2) / R;
      return kaleidoscope.find(x, y);
    },
    [kaleidoscope],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const i = hit(e);
    if (i < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const on = !filledSet.has(i); // toggle: black → clear, clear → black
    drag.current = { on, last: i };
    onPaint([i], on);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const i = hit(e);
    setHover(i);
    const d = drag.current;
    if (!d || i < 0 || i === d.last) return;
    d.last = i;
    if (filledSet.has(i) !== d.on) onPaint([i], d.on);
  };

  const endDrag = (e: React.PointerEvent) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div ref={wrapRef} className="w-full aspect-square select-none">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, touchAction: "none" }}
        className={hover >= 0 ? "cursor-crosshair" : "cursor-default"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={(e) => {
          setHover(-1);
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) drag.current = null;
        }}
        aria-label="Kaleidoscope glyph canvas"
        role="img"
      />
    </div>
  );
}
