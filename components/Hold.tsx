"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Adapted from Bencho's Hold to delete (bencho.dev). An action you have to mean:
   press and hold and a fill sweeps across the pill, the label turning white exactly
   where the edge has reached. Let go early and it drains from wherever it got to.
   The elapsed hold is the state, not a CSS transition, so it can turn round halfway. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Phase = "idle" | "hold" | "done" | "reset";

export function Hold({
  label,
  doneLabel,
  onDone,
  seconds = 1.1,
}: {
  label: string;
  doneLabel: string;
  onDone: () => void;
  seconds?: number;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const box = useRef<HTMLButtonElement>(null);
  const p = useRef(0);
  const down = useRef(false);
  const raf = useRef(0);
  const later = useRef(0);
  const ph = useRef<Phase>("idle");
  const done = useRef(onDone);
  useLayoutEffect(() => {
    ph.current = phase;
    done.current = onDone;
  });

  const still = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const paint = () => box.current?.style.setProperty("--p", p.current.toFixed(4));

  const finish = () => {
    setPhase("done");
    done.current();
    clearTimeout(later.current);
    later.current = window.setTimeout(() => {
      setPhase("reset");
      later.current = window.setTimeout(() => {
        p.current = 0;
        paint();
        setPhase("idle");
      }, 260);
    }, 1300);
  };

  const run = () => {
    if (raf.current) return;
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? Math.min(0.05, (t - prev) / 1000) : 0;
      prev = t;
      if (ph.current === "hold" || ph.current === "idle") {
        if (down.current) p.current += dt / seconds;
        else p.current -= dt / 0.5;
        p.current = clamp(p.current, 0, 1);
      }
      paint();
      if (down.current && p.current >= 1) {
        down.current = false;
        finish();
      }
      const busy = down.current || (p.current > 0 && (ph.current === "hold" || ph.current === "idle"));
      if (!busy && ph.current === "hold") setPhase("idle");
      raf.current = busy ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      clearTimeout(later.current);
    },
    [],
  );

  const start = () => {
    if (ph.current === "done" || ph.current === "reset") return;
    down.current = true;
    setPhase("hold");
    if (still()) {
      clearTimeout(later.current);
      later.current = window.setTimeout(() => {
        if (!down.current) return;
        down.current = false;
        p.current = 1;
        paint();
        finish();
      }, seconds * 1000);
      return;
    }
    run();
  };

  const stop = () => {
    if (!down.current) return;
    down.current = false;
    if (still()) {
      clearTimeout(later.current);
      setPhase("idle");
      return;
    }
    run();
  };

  const word = phase === "done" || phase === "reset" ? doneLabel : phase === "hold" ? "Keep holding" : label;
  const face = (
    <span key={word} className="hld-word">
      {word}
    </span>
  );

  return (
    <button
      type="button"
      ref={box}
      className="hld"
      data-phase={phase}
      aria-label={`${label}. Press and hold to confirm.`}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* a scripted pointer */
        }
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          stop();
        }
      }}
      onBlur={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="hld-base">{face}</span>
      <span className="hld-fill" aria-hidden="true">
        {face}
      </span>
    </button>
  );
}
