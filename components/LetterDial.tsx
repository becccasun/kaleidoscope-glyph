"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { playRatchet } from "@/lib/sounds";

/* The character set as a ring of small lenses around the chamber. The letter at the
   top is the one in the chamber. Turn the ring like the collar of a kaleidoscope and
   it clicks from letter to letter; press any lens and the ring rolls it to the top.

   One number is the ring: `pos`, in letters, never wrapped. Every lens is placed from
   it each frame and written straight to the element, the way Bencho's picker wheel
   places its rows, so a drag is sixty positions a second and none of them a render. */

const mod = (a: number, b: number) => ((a % b) + b) % b;

interface Props {
  /** the dial's outer diameter, px */
  size: number;
  /** one lens's diameter, px */
  lens: number;
  chars: string[];
  current: string;
  /** dir is the way the ring turned: 1 forward through the set, -1 back */
  onSelect: (char: string, dir: number) => void;
  renderLens: (char: string) => ReactNode;
  children: ReactNode;
}

export function LetterDial({ size, lens, chars, current, onSelect, renderLens, children }: Props) {
  const N = chars.length;
  const idx = Math.max(0, chars.indexOf(current));
  const root = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const s = useRef({ pos: idx, to: idx, raf: 0 });
  const held = useRef<{ a: number; moved: number; last: number } | null>(null);
  const geo = useRef({ size, lens, N });
  useLayoutEffect(() => {
    geo.current = { size, lens, N };
  });

  const radius = () => geo.current.size / 2 - geo.current.lens * 0.78;

  const paint = () => {
    const { size: S, lens: L, N: n } = geo.current;
    const R = radius();
    const step = (Math.PI * 2) / n;
    els.current.forEach((el, i) => {
      if (!el) return;
      let d = i - s.current.pos;
      d -= n * Math.round(d / n);
      const a = d * step - Math.PI / 2;
      const near = Math.max(0, 1 - Math.abs(d));
      const x = S / 2 + R * Math.cos(a) - L / 2;
      const y = S / 2 + R * Math.sin(a) - L / 2;
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${(1 + 0.42 * near).toFixed(3)})`;
      el.style.zIndex = near > 0.5 ? "2" : "1";
    });
  };

  const loop = () => {
    const st = s.current;
    if (st.raf) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      st.pos = st.to;
      paint();
      return;
    }
    let prev = performance.now();
    const run = (now: number) => {
      const dt = Math.min(3, (now - prev) / 16.67);
      prev = now;
      if (!held.current) st.pos += (st.to - st.pos) * (1 - Math.pow(1 - 0.2, dt));
      if (Math.abs(st.to - st.pos) < 0.002) st.pos = st.to;
      paint();
      st.raf = st.pos !== st.to && !held.current ? requestAnimationFrame(run) : 0;
    };
    st.raf = requestAnimationFrame(run);
  };

  useLayoutEffect(paint);

  // the letter changed from somewhere else (keyboard, the word, undo): roll to it the short way
  useEffect(() => {
    if (held.current) return;
    const st = s.current;
    const target = idx + N * Math.round((st.to - idx) / N);
    if (target === st.to) return;
    st.to = target;
    loop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, N]);

  useEffect(
    () => () => {
      cancelAnimationFrame(s.current.raf);
      s.current.raf = 0;
    },
    [],
  );

  const polar = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    return { a: Math.atan2(y, x), r: Math.hypot(x, y) * (geo.current.size / r.width) };
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const { a, r } = polar(e);
    const R = radius();
    if (Math.abs(r - R) > lens * 1.05) return; // only the ring turns; the chamber is its own thing
    e.preventDefault();
    try {
      root.current!.setPointerCapture(e.pointerId);
    } catch {
      /* a scripted pointer */
    }
    cancelAnimationFrame(s.current.raf);
    s.current.raf = 0;
    s.current.to = s.current.pos;
    held.current = { a, moved: 0, last: Math.round(s.current.pos) };
    root.current!.dataset.turning = "";
  };

  const move = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h) return;
    const { a } = polar(e);
    let da = a - h.a;
    da -= Math.PI * 2 * Math.round(da / (Math.PI * 2));
    h.a = a;
    h.moved += Math.abs(da) * radius();
    if (h.moved < 4) return; // a press that barely moved is a pick, not a turn
    const step = (Math.PI * 2) / N;
    s.current.pos -= da / step;
    s.current.to = s.current.pos;
    paint();
    const k = Math.round(s.current.pos);
    if (k !== h.last) {
      const dir = Math.sign(k - h.last);
      h.last = k;
      playRatchet();
      onSelect(chars[mod(k, N)], dir);
    }
  };

  const up = (e: React.PointerEvent) => {
    const h = held.current;
    if (!h) return;
    held.current = null;
    delete root.current!.dataset.turning;
    try {
      root.current!.releasePointerCapture(e.pointerId);
    } catch {
      /* never captured */
    }
    const st = s.current;
    if (h.moved < 4) {
      // roll the pressed lens to the top
      const step = (Math.PI * 2) / N;
      let d = (polar(e).a + Math.PI / 2) / step;
      d -= N * Math.round(d / N);
      const target = Math.round(st.pos + d);
      if (target !== Math.round(st.pos)) {
        playRatchet();
        onSelect(chars[mod(target, N)], Math.sign(target - st.pos));
      }
      st.to = target;
    } else st.to = Math.round(st.pos);
    loop();
  };

  return (
    <div
      ref={root}
      className="dial"
      style={{ width: size, height: size }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="dial-ring" role="listbox" aria-label="Characters in your font">
        {chars.map((c, i) => (
          <div
            key={c}
            ref={(el) => {
              els.current[i] = el;
            }}
            className="dial-lens"
            role="option"
            aria-selected={c === current}
            aria-label={c}
            data-on={c === current || undefined}
            style={{ width: lens, height: lens }}
          >
            {renderLens(c)}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
