"use client";

import { useEffect, useRef, useState } from "react";
import { useFontStore } from "@/lib/store";
import { generateKaleidoscope } from "@/lib/geometry";
import { buildFont } from "@/lib/font";

const FAMILY = "KaleidoscopePreview";

/** Live specimen: compiles the font in-browser and loads it via the FontFace API. */
export function Specimen() {
  const { chars, glyphs, symmetry, density } = useFontStore();
  const [text, setText] = useState("KALEIDOSCOPE 2026");
  const [ready, setReady] = useState(false);
  const face = useRef<FontFace | null>(null);

  const signature = chars.map((c) => `${c}:${glyphs[c].seed}:${glyphs[c].filled.join(",")}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const sources = chars.map((char) => ({
        char,
        cells: generateKaleidoscope(glyphs[char].seed, symmetry, density).cells,
        filled: glyphs[char].filled,
      }));
      if (!sources.some((g) => g.filled.length)) {
        setReady(false);
        return;
      }
      const bytes = await buildFont(sources, { familyName: FAMILY });
      if (cancelled) return;
      const next = new FontFace(FAMILY, bytes);
      await next.load();
      if (cancelled) return;
      if (face.current) document.fonts.delete(face.current);
      document.fonts.add(next);
      face.current = next;
      setReady(true);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // signature encodes chars/glyphs; symmetry/density change seeds' meaning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, symmetry, density]);

  return (
    <section aria-label="Specimen" className="border-t border-[#D1D5DB] pt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em]">Specimen</h2>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Specimen text"
          className="text-[11px] font-mono text-right bg-transparent border-b border-[#D1D5DB] focus:border-black outline-none w-48"
        />
      </div>
      <div
        className="min-h-[96px] text-6xl leading-none break-words"
        style={{ fontFamily: ready ? `"${FAMILY}", monospace` : "monospace", color: ready ? "#000" : "#D1D5DB" }}
      >
        {text || " "}
      </div>
    </section>
  );
}
