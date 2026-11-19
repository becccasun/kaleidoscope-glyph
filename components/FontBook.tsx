"use client";

import { useEffect, useRef, useState } from "react";
import { useFontStore, useGlyphStyle } from "@/lib/store";
import type { FillPattern } from "@/lib/style";
import { GlyphThumb } from "./GlyphThumb";
import { JellyTabs } from "./JellyTabs";
import { Tape } from "./Tape";

const FILLS: Array<{ value: FillPattern; label: string }> = [
  { value: "solid", label: "Glass" },
  { value: "dots", label: "Beads" },
  { value: "rings", label: "Rings" },
];

/** Letters, then figures, then everything else, each in the order of the set. */
function groups(chars: string[]) {
  const letters = chars.filter((c) => /\p{L}/u.test(c));
  const figures = chars.filter((c) => /\p{N}/u.test(c));
  const rest = chars.filter((c) => !letters.includes(c) && !figures.includes(c));
  return [letters, figures, rest].filter((g) => g.length);
}

/**
 * The whole font at once, the way a font manager shows a typeface: every glyph set
 * loose as a preview, then the repertoire as labelled tiles. Press any glyph to draw it.
 */
export function FontBook({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (char: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const s = useFontStore();
  const style = useGlyphStyle();
  const [size, setSize] = useState(72);
  const [shown, setShown] = useState({ preview: true, repertoire: true });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const { chars, glyphs, symmetry, density } = s;
  const drawn = chars.filter((c) => glyphs[c]?.filled.length).length;

  const glyph = (c: string, px: number) => {
    const g = glyphs[c];
    return g?.filled.length ? (
      <GlyphThumb seed={g.seed} symmetry={symmetry} density={density} filled={g.filled} style={style} size={px} />
    ) : (
      <span className="fb-empty" style={{ width: px, height: px, fontSize: px * 0.36 }}>
        {c}
      </span>
    );
  };

  const pick = (c: string) => {
    onPick(c);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="fb"
      aria-label={`Preview of ${s.fontName || "your font"}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // the backdrop
      }}
    >
      {open && (
        <div className="fb-sheet">
          <header className="fb-bar">
            <div className="fb-titles">
              <span className="fb-name">{s.fontName || "Untitled font"}</span>
              <small>
                {drawn} of {chars.length} drawn
              </small>
            </div>
            <div className="fb-tools">
              <div className="fb-fill">
                <JellyTabs label="Fill" options={FILLS} value={s.fill} onChange={s.setFill} />
              </div>
              <div className="fb-size">
                <span aria-hidden="true" className="fb-a fb-a-small">
                  A
                </span>
                <Tape label="Preview size" min={32} max={160} step={4} value={size} onChange={setSize} format={(v) => `${v}`} />
                <span aria-hidden="true" className="fb-a">
                  A
                </span>
              </div>
              <button type="button" className="icon" onClick={onClose} aria-label="Close preview" title="Close (esc)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="fb-body">
            <Section title="Preview" open={shown.preview} onToggle={() => setShown((v) => ({ ...v, preview: !v.preview }))}>
              <div className="fb-preview" style={{ gap: `${size * 0.22}px ${size * 0.12}px` }}>
                {groups(chars).map((g, i) => (
                  <div className="fb-line" key={i} style={{ gap: `${size * 0.22}px ${size * 0.12}px` }}>
                    {g.map((c) => (
                      <button type="button" key={c} className="fb-glyph" onClick={() => pick(c)} aria-label={`Draw ${c}`} title={c}>
                        {glyph(c, size)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Repertoire"
              open={shown.repertoire}
              onToggle={() => setShown((v) => ({ ...v, repertoire: !v.repertoire }))}
            >
              <div className="fb-tiles">
                {chars.map((c) => (
                  <button type="button" key={c} className="fb-tile" onClick={() => pick(c)} aria-label={`Draw ${c}`}>
                    {glyph(c, 64)}
                    <span className="fb-tile-char">{c}</span>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="fb-section">
      <button type="button" className="fb-head" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" data-open={open || undefined}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && children}
    </section>
  );
}
