"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFontStore, useGlyphStyle, DEFAULT_CHARS } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { useKaleidoscope } from "@/lib/useKaleidoscope";
import { playRatchet, playTumble } from "@/lib/sounds";
import type { FillPattern } from "@/lib/style";
import { Scope } from "./Scope";
import { LetterDial } from "./LetterDial";
import { WordRow } from "./WordRow";
import { ExportButton } from "./ExportButton";
import { GlyphThumb } from "./GlyphThumb";
import { JellyTabs } from "./JellyTabs";
import { Tape } from "./Tape";
import { Hold } from "./Hold";
import { FontBook } from "./FontBook";
import { Confirm } from "./Confirm";

const MIRRORS = [4, 6, 8, 10, 12].map((n) => ({ value: n, label: String(n) }));
const FILLS: Array<{ value: FillPattern; label: string }> = [
  { value: "solid", label: "Glass" },
  { value: "dots", label: "Beads" },
  { value: "rings", label: "Rings" },
];

/** Mac shows ⌘ and "delete"; Windows and Linux show Ctrl and "Del". */
const isMac = () => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || nav.userAgent);
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Studio() {
  // Seeds are random and persisted in localStorage; render after hydration to avoid mismatches.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return <div className="studio" />;
  return <StudioInner />;
}

function StudioInner() {
  const s = useFontStore();
  const { current, glyphs, chars, symmetry, density } = s;
  const glyph = glyphs[current];
  const k = useKaleidoscope(glyph.seed, symmetry, density);
  const style = useGlyphStyle();
  const sound = useUi((u) => u.sound);
  const setSound = useUi((u) => u.setSound);
  const notify = useUi((u) => u.notify);
  const mac = isMac();
  const keys = mac
    ? { undo: "⌘Z", redo: "⇧⌘Z", del: "delete" }
    : { undo: "Ctrl+Z", redo: "Ctrl+Shift+Z or Ctrl+Y", del: "del" };

  const drawn = chars.filter((c) => glyphs[c]?.filled.length).length;
  const turn = useRef(1);
  const [shaken, setShaken] = useState(0);
  const [draft, setDraft] = useState("");
  const [book, setBook] = useState(false);
  /** a recut waiting on the user, since it clears every drawing */
  const [pending, setPending] = useState<{ kind: "splices" | "facets"; value: number } | null>(null);

  // ── the dial's size follows the room it is given ───────────────────────
  const room = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = room.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize(Math.floor(Math.max(260, Math.min(width, height || width, 720))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ringRoom = (Math.PI * (size - 60)) / chars.length;
  const lens = Math.max(16, Math.min(38, size * 0.064, ringRoom * 0.8));

  // ── actions ────────────────────────────────────────────────────────────
  const go = (char: string, dir?: number) => {
    if (char === current) return;
    if (dir) turn.current = dir;
    else {
      const n = chars.length;
      const d = chars.indexOf(char) - chars.indexOf(current);
      turn.current = (((d % n) + n) % n) * 2 <= n ? 1 : -1;
    }
    s.select(char);
  };

  const stepLetter = (by: number) => {
    const n = chars.length;
    playRatchet();
    go(chars[(chars.indexOf(current) + by + n) % n], by);
  };

  const shake = () => {
    const had = glyph.filled.length;
    turn.current = 1;
    s.spin();
    setShaken((n) => n + 1);
    playTumble();
    if (had) notify(`Shook ${current}: its ${plural(had, "lit bead")} went dark.`);
  };

  const clear = () => {
    if (!glyph.filled.length) return;
    s.clearGlyph();
    notify(`Cleared ${current}.`);
  };

  /** Splices and facets rebuild every chamber, so every drawing goes with them: ask first. */
  const applyRecut = (kind: "splices" | "facets", value: number) => {
    turn.current = 1;
    if (kind === "splices") s.setSymmetry(value);
    else s.setDensity(value);
    if (drawn) notify(`New cut: ${plural(drawn, "drawn letter")} cleared.`);
  };
  const recut = (kind: "splices" | "facets", value: number) => {
    if (drawn) setPending({ kind, value });
    else applyRecut(kind, value);
  };

  const live = useRef({ stepLetter, shake, clear, go });
  useEffect(() => {
    live.current = { stepLetter, shake, clear, go };
  });

  // ── keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || !!t?.isContentEditable;
      // the physical key as well, so other keyboard layouts still find Z and Y
      const key = e.code === "KeyZ" ? "z" : e.code === "KeyY" ? "y" : e.key.toLowerCase();
      // a confirm question takes no shortcuts; the font preview takes only undo and redo
      if (document.querySelector("dialog.confirm[open]")) return;
      const previewing = !!document.querySelector("dialog.fb[open]");

      // ⌘Z / Ctrl+Z undo; ⇧⌘Z, Ctrl+Shift+Z or Ctrl+Y redo. Text fields keep their native undo.
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const isRedo = (key === "z" && e.shiftKey) || (key === "y" && e.ctrlKey && !e.metaKey);
        if ((key !== "z" && !isRedo) || typing) return;
        e.preventDefault();
        const st = useFontStore.getState();
        if (isRedo) st.redo();
        else st.undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing || previewing) return;
      // a focused control keeps its own keys
      const onControl = !!t?.closest("button, [role=slider], [role=radiogroup], a");

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (onControl && !t?.matches("button:not([role=radio])")) return;
        e.preventDefault();
        live.current.stepLetter(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === " ") {
        if (onControl) return;
        e.preventDefault();
        if (!e.repeat) live.current.shake();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        // clears only the letter in the chamber, even with a button or tab still focused
        e.preventDefault();
        live.current.clear();
      } else if ([...e.key].length === 1) {
        // type a character to bring it into the chamber
        const { chars: set } = useFontStore.getState();
        const hit = set.includes(e.key) ? e.key : set.includes(e.key.toUpperCase()) ? e.key.toUpperCase() : null;
        if (!hit) return;
        e.preventDefault();
        live.current.go(hit);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const custom = !DEFAULT_CHARS.includes(current);

  return (
    <div className="studio">
      <header className="bar">
        <div className="bar-name">
          <div className="bar-titles">
            <span className="bar-word">becca&apos;s kaleidoglyph</span>
            <input
              className="bar-font"
              value={s.fontName}
              onChange={(e) => s.setFontName(e.target.value)}
              aria-label="Font name"
              placeholder="Name your font"
              spellCheck={false}
              size={Math.max(8, s.fontName.length + 1)}
            />
          </div>
        </div>
        <div className="bar-tools">
          <button type="button" className="icon" onClick={s.undo} disabled={!s.past.length} aria-label="Undo" title={`Undo (${keys.undo})`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
            </svg>
          </button>
          <button type="button" className="icon" onClick={s.redo} disabled={!s.future.length} aria-label="Redo" title={`Redo (${keys.redo})`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H10a6 6 0 0 0 0 12h3" />
            </svg>
          </button>
          <button
            type="button"
            className="icon"
            onClick={() => setSound(!sound)}
            aria-pressed={sound}
            aria-label="Sound"
            title={sound ? "Sound is on" : "Sound is off"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              {sound ? (
                <>
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </>
              ) : (
                <path d="m16 9 5 6m0-6-5 6" />
              )}
            </svg>
          </button>
          <button type="button" className="btn preview" onClick={() => setBook(true)} title="See the whole font">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="6" rx="1" />
              <rect x="14" y="4" width="6" height="6" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
            Preview font
          </button>
          <ExportButton />
        </div>
      </header>

      <main className="stage">
        <aside className="panel panel-cut" aria-label="This letter and its cut">
          <div className="letter">
            {glyph.filled.length ? (
              <>
                <span className="letter-glyph">
                  <GlyphThumb seed={glyph.seed} symmetry={symmetry} density={density} filled={glyph.filled} style={style} size={112} />
                </span>
                <span className="letter-tag">{current}</span>
              </>
            ) : (
              <span className="letter-char" key={current}>
                {current}
              </span>
            )}
          </div>

          <div className="pair">
            <button type="button" className="btn btn-ink" onClick={shake}>
              Shake
              <kbd>space</kbd>
            </button>
            <button type="button" className="btn" onClick={clear} disabled={!glyph.filled.length}>
              Clear
              <kbd>{keys.del}</kbd>
            </button>
          </div>

          <Control label="Radial splicing">
            <JellyTabs label="Radial splicing" options={MIRRORS} value={symmetry} onChange={(n) => recut("splices", n)} />
          </Control>

          <Control label="Facets">
            <Tape label="Facets" min={3} max={16} value={density} onChange={(n) => recut("facets", n)} settle />
          </Control>
        </aside>

        <div className="room" ref={room}>
          {size > 0 && (
            <LetterDial
              size={size}
              lens={lens}
              chars={chars}
              current={current}
              onSelect={go}
              renderLens={(c) => {
                const g = glyphs[c];
                return g.filled.length ? (
                  <span>
                    <GlyphThumb seed={g.seed} symmetry={symmetry} density={density} filled={g.filled} style={style} size={lens * 0.72} />
                  </span>
                ) : (
                  <span className="dial-char" style={{ fontSize: lens * 0.46 }}>
                    {c}
                  </span>
                );
              }}
            >
              <div className="dial-scope" style={{ inset: lens * 1.62 + 6 }}>
                <Scope
                  kaleidoscope={k}
                  filled={glyph.filled}
                  style={style}
                  turn={turn}
                  shaken={shaken}
                  onStrokeStart={s.beginStroke}
                  onPaint={s.setCells}
                />
              </div>
            </LetterDial>
          )}
        </div>

        <aside className="panel panel-fill" aria-label="Fill and character set">
          <Control label="Fill">
            <JellyTabs label="Fill" options={FILLS} value={s.fill} onChange={s.setFill} />
          </Control>

          <Control label="Roundness">
            <Tape
              label="Roundness"
              min={0}
              max={100}
              value={Math.round(s.roundness * 100)}
              onChange={(v) => s.setRoundness(v / 100)}
              format={(v) => `${v}%`}
            />
          </Control>

          {s.fill !== "solid" && (
            <Control label={s.fill === "dots" ? "Bead rings" : "Ring count"}>
              <Tape label="Rings of pattern" min={6} max={24} value={s.grain} onChange={s.setGrain} />
            </Control>
          )}

          <Control label="Character set" note={`${drawn} of ${chars.length} drawn`}>
            <form
              className="add"
              onSubmit={(e) => {
                e.preventDefault();
                s.addChar(draft);
                setDraft("");
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2}
                placeholder="a  ?  &  ★"
                aria-label="Add a character to your font"
              />
              <button type="submit" className="btn" disabled={!draft.trim()}>
                Add
              </button>
            </form>
            {custom && (
              <button type="button" className="link" onClick={() => s.removeChar(current)}>
                Remove “{current}” from the set
              </button>
            )}
          </Control>

          <div className="holds">
            <Hold
              label="Shake every letter"
              doneLabel="All shaken"
              onDone={() => {
                turn.current = 1;
                s.spinAll();
                setShaken((n) => n + 1);
                playTumble();
                if (drawn) notify(`Shook every letter: ${plural(drawn, "drawing")} cleared.`);
              }}
            />
            <Hold
              label="Start over"
              doneLabel="Fresh set"
              onDone={() => {
                turn.current = -1;
                s.reset();
                notify("Started over with a fresh set.");
              }}
            />
          </div>
        </aside>
      </main>

      <WordRow onPick={(c) => go(c)} />
      <Confirm
        open={!!pending}
        title={pending?.kind === "facets" ? "Change facet count?" : "Change splice count?"}
        body={`This will delete your existing progress: ${plural(drawn, "drawn letter")} will be cleared.`}
        confirmLabel="Delete and change"
        onConfirm={() => {
          if (pending) applyRecut(pending.kind, pending.value);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
      <FontBook open={book} onClose={() => setBook(false)} onPick={(c) => go(c)} />
      <Toast />
    </div>
  );
}

function Control({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="control">
      <div className="control-head">
        <span>{label}</span>
        {note && <small>{note}</small>}
      </div>
      {children}
    </div>
  );
}

/** What just happened, with the way back beside it. */
function Toast() {
  const toast = useUi((u) => u.toast);
  const dismiss = useUi((u) => u.dismiss);
  const undo = useFontStore((s) => s.undo);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.text}</span>
      <button
        type="button"
        onClick={() => {
          undo();
          dismiss();
        }}
      >
        Undo
      </button>
    </div>
  );
}
