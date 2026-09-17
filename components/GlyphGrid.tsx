"use client";

import { useState } from "react";
import { useFontStore, DEFAULT_CHARS } from "@/lib/store";
import { GlyphThumb } from "./GlyphThumb";

export function GlyphGrid() {
  const { chars, glyphs, current, symmetry, density, select, addChar, removeChar } = useFontStore();
  const [draft, setDraft] = useState("");

  return (
    <section aria-label="Character set">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.18em]">Character set</h2>
        <span className="text-[11px] text-neutral-500 tabular-nums">
          {chars.filter((c) => glyphs[c]?.filled.length).length}/{chars.length} drawn
        </span>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-6 xl:grid-cols-9 gap-px bg-[#D1D5DB] border border-[#D1D5DB]">
        {chars.map((c) => {
          const g = glyphs[c];
          const active = c === current;
          const drawn = g.filled.length > 0;
          return (
            <button
              key={c}
              onClick={() => select(c)}
              onDoubleClick={() => !DEFAULT_CHARS.includes(c) && removeChar(c)}
              title={DEFAULT_CHARS.includes(c) ? c : `${c} — double-click to remove`}
              className={[
                "relative aspect-square flex flex-col items-center justify-center gap-0.5 transition-colors outline-none",
                active ? "bg-black text-white" : "bg-white text-black hover:bg-neutral-100",
                "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black",
              ].join(" ")}
            >
              {drawn ? (
                <GlyphThumb seed={g.seed} symmetry={symmetry} density={density} filled={g.filled} size={28} />
              ) : (
                <span
                  className={[
                    "w-7 h-7 rounded-full border",
                    active ? "border-neutral-600" : "border-[#D1D5DB]",
                  ].join(" ")}
                />
              )}
              <span className="text-[10px] leading-none font-mono">{c}</span>
            </button>
          );
        })}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addChar(draft);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2}
          placeholder="Add glyph (a, ?, &, ★)"
          aria-label="Add a custom glyph"
          className="flex-1 min-w-0 h-9 px-3 text-sm border border-[#D1D5DB] bg-white focus:border-black outline-none font-mono"
        />
        <button
          type="submit"
          className="h-9 px-4 text-[11px] uppercase tracking-[0.18em] border border-black bg-white hover:bg-black hover:text-white transition-colors"
        >
          Add
        </button>
      </form>
    </section>
  );
}
