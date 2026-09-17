"use client";

import { useSyncExternalStore } from "react";
import { useFontStore } from "@/lib/store";
import { useKaleidoscope } from "@/lib/useKaleidoscope";
import { KaleidoscopeCanvas } from "./KaleidoscopeCanvas";
import { GlyphGrid } from "./GlyphGrid";
import { Toolbar } from "./Toolbar";
import { Specimen } from "./Specimen";

export function Editor() {
  // Seeds are random and persisted in localStorage; render after hydration to avoid mismatches.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return <div className="min-h-[60vh]" />;
  return <EditorInner />;
}

function EditorInner() {
  const { current, glyphs, symmetry, density, setCells } = useFontStore();
  const glyph = glyphs[current];
  const k = useKaleidoscope(glyph.seed, symmetry, density);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
        <div className="relative mx-auto w-full max-w-[640px]">
          <div className="absolute -top-6 left-0 text-[11px] uppercase tracking-[0.18em]">
            Glyph <span className="font-mono normal-case tracking-normal text-base align-baseline ml-1">{current}</span>
          </div>
          <div className="absolute -top-6 right-0 text-[11px] text-neutral-400 font-mono tabular-nums">
            seed {glyph.seed.toString(16).padStart(8, "0")} · {k.cells.length} cells
          </div>
          <KaleidoscopeCanvas kaleidoscope={k} filled={glyph.filled} onPaint={setCells} />
        </div>
        <Specimen />
      </div>

      <aside className="flex flex-col gap-10 lg:border-l lg:border-[#D1D5DB] lg:pl-8">
        <Toolbar />
        <GlyphGrid />
      </aside>
    </div>
  );
}
