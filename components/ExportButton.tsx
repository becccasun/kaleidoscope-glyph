"use client";

import { useRef, useState } from "react";
import { useFontStore } from "@/lib/store";
import { generateKaleidoscope } from "@/lib/geometry";
import { buildFont, downloadBlob } from "@/lib/font";
import { playPrint, playReady } from "@/lib/sounds";

const STYLE_NAMES = { solid: "Regular", dots: "Beads", rings: "Rings" } as const;

export function ExportButton() {
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const later = useRef(0);
  const drawn = useFontStore((s) => s.chars.filter((c) => s.glyphs[c]?.filled.length).length);

  const exportOtf = async () => {
    const s = useFontStore.getState();
    setState("busy");
    playPrint();
    try {
      const sources = s.chars.map((char) => ({
        char,
        cells: generateKaleidoscope(s.glyphs[char].seed, s.symmetry, s.density).cells,
        filled: s.glyphs[char].filled,
      }));
      const styleName = STYLE_NAMES[s.fill];
      const bytes = await buildFont(sources, {
        familyName: s.fontName,
        styleName,
        symmetry: s.symmetry,
        style: { roundness: s.roundness, fill: s.fill, grain: s.grain },
      });
      const safe = s.fontName.replace(/[^\w-]+/g, "") || "MyFont";
      downloadBlob(bytes, `${safe}-${styleName}.otf`, "font/otf");
      playReady();
      setState("saved");
      clearTimeout(later.current);
      later.current = window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      className="btn btn-ink export"
      onClick={exportOtf}
      disabled={state === "busy" || drawn === 0}
      title={drawn === 0 ? "Light some beads first: there is nothing to export yet" : undefined}
    >
      {state === "busy" ? "Compiling" : state === "saved" ? "Saved to downloads" : "Export .otf"}
      {state === "idle" && drawn > 0 && <span className="export-count">{drawn}</span>}
    </button>
  );
}
