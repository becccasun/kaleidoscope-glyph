"use client";

import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { playRatchet } from "@/lib/sounds";

/* Adapted from Bencho's Tape slider (bencho.dev). One line: a track whose fill you
   drag by a short grip. Dragging is continuous under the hand, every step it crosses
   ticks, and letting go slides it onto the step. */

const KNOB = 30;

export function Tape({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  format = String,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
}) {
  const [drag, setDrag] = useState<number | null>(null); // the raw value under the hand
  const track = useRef<HTMLDivElement | null>(null);
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const toStep = (v: number) => clamp(Math.round(v / step) * step);
  const shown = drag ?? value;
  const p = (shown - min) / (max - min);
  const held = drag !== null;

  const fromX = (clientX: number) => {
    const el = track.current;
    if (!el) return latest.current;
    const r = el.getBoundingClientRect();
    const k = (KNOB / el.offsetWidth) * r.width;
    const at = (clientX - r.left - k / 2) / (r.width - k);
    return clamp(min + Math.min(1, Math.max(0, at)) * (max - min));
  };

  const commit = (raw: number) => {
    const next = toStep(raw);
    if (next === latest.current) return;
    latest.current = next;
    playRatchet(0.3);
    onChange(next);
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    track.current?.focus({ preventScroll: true });
    try {
      track.current?.setPointerCapture(e.pointerId);
    } catch {
      /* a scripted pointer */
    }
    const first = fromX(e.clientX);
    setDrag(first);
    commit(first);
    const move = (ev: PointerEvent) => {
      const now = fromX(ev.clientX);
      setDrag(now);
      commit(now);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      try {
        track.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* never captured */
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const key = (e: React.KeyboardEvent) => {
    const big = Math.max(step, (max - min) / 10);
    const by = e.shiftKey ? big : step;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") commit(value + by);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") commit(value - by);
    else if (e.key === "Home") commit(min);
    else if (e.key === "End") commit(max);
    else return;
    e.preventDefault();
  };

  return (
    <div className="tpe" data-drag={held || undefined} style={{ "--tpe-p": p, "--tpe-k": `${KNOB}px` } as CSSProperties}>
      <div
        ref={track}
        className="tpe-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        onPointerDown={down}
        onKeyDown={key}
      >
        <span className="tpe-fill">
          <svg className="tpe-grip" viewBox="-15 -15 30 30" aria-hidden="true">
            <path d={held ? "M 0 -8 V 8" : "M 0 -6 V 6"} />
          </svg>
        </span>
      </div>
      <span className="tpe-val" aria-hidden="true">
        {format(toStep(shown))}
      </span>
    </div>
  );
}
