"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { playPick } from "@/lib/sounds";

/* Adapted from Bencho's Jelly tabs (bencho.dev). A row of separate pills: the chosen
   one swells like jelly, its width and height springing at different rates, while the
   rest are nudged aside to make room. Each spring is integrated here in small fixed
   steps and written straight onto the pills; the loop stops when every spring rests. */

const SWELL = 0.14;
const SHRINK = 0.04;
const BARGE = 3;
const STAGGER = 22;
const STIFF = 580;
const BOUNCE = 0.25;
const WOBBLE = 1; // how much the two scales disagree

type Spring = { v: number; vel: number; to: number; k: number; c: number; m: number; at: number };
const spring = (v: number): Spring => ({ v, vel: 0, to: v, k: STIFF, c: 0, m: 1, at: 0 });
const aim = (s: Spring, to: number, k: number, m: number, bounce: number, at: number) => {
  s.to = to;
  s.k = k;
  s.m = m;
  s.c = 2 * Math.sqrt(k * m) * (1 - bounce);
  s.at = at;
};

export interface JellyOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function JellyTabs<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: JellyOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const chosen = Math.max(0, options.findIndex((o) => o.value === value));
  const row = useRef<HTMLDivElement | null>(null);
  const pills = useRef<(HTMLButtonElement | null)[]>([]);
  const widths = useRef<number[]>([]);
  const st = useRef<{ x: Spring[]; sx: Spring[]; sy: Spring[]; raf: number; sel: number } | null>(null);
  st.current ??= {
    x: options.map(() => spring(0)),
    sx: options.map((_, i) => spring(i === chosen ? 1 + SWELL : 1 - SHRINK)),
    sy: options.map((_, i) => spring(i === chosen ? 1 + SWELL : 1 - SHRINK)),
    raf: 0,
    sel: chosen,
  };

  const paint = () => {
    const s = st.current!;
    pills.current.forEach((el, i) => {
      if (el) el.style.transform = `translateX(${s.x[i].v.toFixed(2)}px) scale(${s.sx[i].v.toFixed(4)}, ${s.sy[i].v.toFixed(4)})`;
    });
  };

  const loop = () => {
    const s = st.current!;
    if (s.raf) return;
    let prev = performance.now();
    const run = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      let moving = false;
      const N = 8;
      for (const sp of [...s.x, ...s.sx, ...s.sy]) {
        if (now < sp.at) {
          moving = true;
          continue;
        }
        for (let n = 0; n < N; n++) {
          const h = dt / N;
          const a = (-sp.k * (sp.v - sp.to) - sp.c * sp.vel) / sp.m;
          sp.vel += a * h;
          sp.v += sp.vel * h;
        }
        if (Math.abs(sp.v - sp.to) > 1e-4 || Math.abs(sp.vel) > 1e-3) moving = true;
        else {
          sp.v = sp.to;
          sp.vel = 0;
        }
      }
      paint();
      s.raf = moving ? requestAnimationFrame(run) : 0;
    };
    s.raf = requestAnimationFrame(run);
  };

  const apply = (sel: number, instant: boolean) => {
    const s = st.current!;
    const push = ((widths.current[sel] ?? 0) * SWELL) / 2 + BARGE;
    const now = performance.now();
    for (let i = 0; i < options.length; i++) {
      const on = i === sel;
      const far = Math.abs(i - sel);
      const x = Math.sign(i - sel) * push;
      const sc = on ? 1 + SWELL : 1 - SHRINK;
      if (instant) {
        for (const sp of [s.x[i], s.sx[i], s.sy[i]]) sp.vel = 0;
        s.x[i].v = s.x[i].to = x;
        s.sx[i].v = s.sx[i].to = sc;
        s.sy[i].v = s.sy[i].to = sc;
        continue;
      }
      const k = STIFF * (1 - 0.12 * Math.min(far, 3));
      const busy = [s.x[i], s.sx[i], s.sy[i]].some((sp) => Math.abs(sp.v - sp.to) > 1e-3 || Math.abs(sp.vel) > 1e-3);
      const delay = busy ? 0 : far * STAGGER;
      aim(s.x[i], x, k, 0.9, BOUNCE, now + delay);
      aim(s.sx[i], sc, k * (1 + 0.24 * WOBBLE), 0.9 - 0.1 * WOBBLE, Math.min(0.85, BOUNCE + 0.3 * WOBBLE), now + delay);
      aim(s.sy[i], sc, k * (1 - 0.14 * WOBBLE), 0.9 + 0.05 * WOBBLE, BOUNCE, now + delay + 50 * WOBBLE);
    }
    if (instant) paint();
    else loop();
  };

  useLayoutEffect(() => {
    widths.current = pills.current.map((el) => el?.offsetWidth ?? 0);
    apply(st.current!.sel, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the choice can change from outside (undo, a keyboard pick): follow it
  useEffect(() => {
    const s = st.current!;
    if (chosen === s.sel) return;
    s.sel = chosen;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    apply(chosen, !!still);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(
    () => () => {
      const s = st.current!;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    },
    [],
  );

  const choose = (i: number) => {
    if (i === chosen) return;
    playPick();
    onChange(options[i].value);
  };

  return (
    <div ref={row} className="jlt-row" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            pills.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === chosen}
          tabIndex={i === chosen ? 0 : -1}
          className="jlt-pill"
          data-on={i === chosen || undefined}
          onClick={() => choose(i)}
          onKeyDown={(e) => {
            const by = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!by) return;
            e.preventDefault();
            const next = (i + by + options.length) % options.length;
            choose(next);
            pills.current[next]?.focus();
          }}
        >
          <span className="jlt-face">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}
