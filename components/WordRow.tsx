"use client";

import { useFontStore, useGlyphStyle } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { GlyphThumb } from "./GlyphThumb";

/**
 * A word set in the font as it stands. Drawn letters appear in ink, from the same
 * outlines the .otf gets. Letters you have not drawn yet are dotted rings: press one
 * and it goes into the chamber. A character outside the set is added when pressed.
 */
export function WordRow({ onPick }: { onPick: (char: string) => void }) {
  const { chars, glyphs, current, symmetry, density, addChar } = useFontStore();
  const style = useGlyphStyle();
  const word = useUi((s) => s.word);
  const setWord = useUi((s) => s.setWord);

  // lowercase falls back to the capital when only the capital is in the set
  const resolve = (ch: string) => (chars.includes(ch) ? ch : chars.includes(ch.toUpperCase()) ? ch.toUpperCase() : null);
  const letters = [...word];

  return (
    <section className="word" aria-label="Your word, set in your font">
      <div className="word-line">
        {letters.length === 0 && <p className="word-empty">Type a word below to see it in your font.</p>}
        {letters.map((ch, i) => {
          if (ch === " ") return <span key={i} className="word-gap" />;
          const c = resolve(ch);
          const g = c ? glyphs[c] : null;
          const drawn = !!g && g.filled.length > 0;
          return (
            <button
              key={i}
              type="button"
              className="word-tile"
              data-on={c === current || undefined}
              data-drawn={drawn || undefined}
              onClick={() => (c ? onPick(c) : addChar(ch))}
              aria-label={
                c ? (drawn ? `Edit ${c}` : `Draw ${c}`) : `Add ${ch} to your font`
              }
              title={c ? undefined : `Add “${ch}” to your font`}
            >
              {drawn ? (
                <GlyphThumb seed={g.seed} symmetry={symmetry} density={density} filled={g.filled} style={style} size={84} />
              ) : (
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="45" className="word-ring" />
                  <text x="50" y="52" textAnchor="middle" dominantBaseline="middle">
                    {c ?? ch}
                  </text>
                  {!c && (
                    <text x="82" y="22" textAnchor="middle" dominantBaseline="middle" className="word-plus">
                      +
                    </text>
                  )}
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <input
        className="word-input"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        maxLength={22}
        spellCheck={false}
        autoComplete="off"
        placeholder="Type a word"
        aria-label="The word to set in your font"
      />
    </section>
  );
}
