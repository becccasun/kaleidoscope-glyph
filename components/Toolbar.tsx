"use client";

import { useState } from "react";
import { useFontStore } from "@/lib/store";
import { generateKaleidoscope } from "@/lib/geometry";
import { buildFont, downloadBlob } from "@/lib/font";

const SYMMETRIES = [4, 6, 8, 10, 12];

export function Toolbar() {
  const s = useFontStore();
  const [busy, setBusy] = useState(false);
  const drawnCount = s.chars.filter((c) => s.glyphs[c]?.filled.length).length;

  const exportOtf = async () => {
    setBusy(true);
    try {
      const sources = s.chars.map((char) => ({
        char,
        cells: generateKaleidoscope(s.glyphs[char].seed, s.symmetry, s.density).cells,
        filled: s.glyphs[char].filled,
      }));
      const bytes = await buildFont(sources, { familyName: s.fontName });
      const safe = s.fontName.replace(/[^\w-]+/g, "") || "Kaleidoscope";
      downloadBlob(bytes, `${safe}-Regular.otf`, "font/otf");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Field label="Font name">
        <input
          value={s.fontName}
          onChange={(e) => s.setFontName(e.target.value)}
          className="w-full h-9 px-3 text-sm border border-[#D1D5DB] bg-white focus:border-black outline-none"
        />
      </Field>

      <Field label="Symmetry" hint="changing this clears all fills">
        <div className="flex border border-[#D1D5DB] divide-x divide-[#D1D5DB]">
          {SYMMETRIES.map((n) => (
            <button
              key={n}
              onClick={() => n !== s.symmetry && confirmClear(drawnCount) && s.setSymmetry(n)}
              className={[
                "flex-1 h-9 text-sm tabular-nums transition-colors",
                n === s.symmetry ? "bg-black text-white" : "bg-white hover:bg-neutral-100",
              ].join(" ")}
              aria-pressed={n === s.symmetry}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <Field label={`Density · ${s.density}`} hint="changing this clears all fills">
        <input
          type="range"
          min={3}
          max={16}
          value={s.density}
          onChange={(e) => {
            const v = +e.target.value;
            if (v !== s.density && confirmClear(drawnCount)) s.setDensity(v);
          }}
          className="w-full accent-black"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={s.spin} primary>
          Spin
        </Btn>
        <Btn onClick={s.clearGlyph}>Clear glyph</Btn>
        <Btn onClick={() => confirmClear(drawnCount) && s.spinAll()}>Spin all</Btn>
        <Btn onClick={() => confirmClear(drawnCount) && s.reset()}>Reset font</Btn>
      </div>

      <Btn onClick={exportOtf} disabled={busy || drawnCount === 0} primary tall>
        {busy ? "Compiling…" : `Export .otf · ${drawnCount} glyph${drawnCount === 1 ? "" : "s"}`}
      </Btn>

      <p className="text-[11px] leading-relaxed text-neutral-500">
        Click a cell to fill it black. Click again to clear. Drag to paint. Each letter keeps its own
        kaleidoscope seed — <span className="text-black">Spin</span> re-rolls the current letter only.
      </p>
    </div>
  );
}

function confirmClear(drawn: number) {
  return drawn === 0 || window.confirm(`This will clear ${drawn} drawn glyph${drawn === 1 ? "" : "s"}. Continue?`);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
        {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Btn({
  children,
  onClick,
  primary,
  tall,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  tall?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        tall ? "h-12" : "h-9",
        "px-3 text-[11px] uppercase tracking-[0.18em] border border-black transition-colors",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        primary
          ? "bg-black text-white hover:enabled:bg-white hover:enabled:text-black"
          : "bg-white text-black hover:enabled:bg-black hover:enabled:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
