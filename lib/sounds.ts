import { useUi } from "./ui";

/* The player and the Ratchet, Plink, Glass and Print voices are Bencho sounds
   (bencho.dev), synthesised with the Web Audio API: no audio files. The bead and
   tumble voices are built here from the Plink. */

type Note = { hz: number; to?: number; ms: number; gain?: number; wave?: OscillatorType; cut?: number; at?: number; atk?: number; noise?: BiquadFilterType; q?: number; glide?: number; lin?: boolean };

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/* Browsers only start audio after a user gesture: call from a click, tap or key handler. */
function playNotes(notes: readonly Note[], volume = 1) {
  if (typeof window === "undefined" || !useUi.getState().sound) return;
  try {
    ctx ??= new AudioContext();
  } catch {
    return;
  }
  const c = ctx;
  if (c.state !== "running") void c.resume();
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const base = c.currentTime + 0.005;
  for (const n of notes) {
    const t0 = base + (n.at ?? 0) / 1000;
    const t1 = t0 + n.ms / 1000;
    const tg = n.glide ? t0 + n.glide / 1000 : t1;
    let src: AudioScheduledSourceNode;
    let head: AudioNode;
    if (n.noise) {
      const s = c.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = n.noise;
      f.frequency.setValueAtTime(n.hz, t0);
      if (n.to) f.frequency.exponentialRampToValueAtTime(n.to, tg);
      if (n.q !== undefined) f.Q.value = n.q;
      s.connect(f);
      src = s;
      head = f;
    } else {
      const o = c.createOscillator();
      o.type = n.wave ?? "sine";
      o.frequency.setValueAtTime(n.hz, t0);
      if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, tg);
      src = o;
      head = o;
    }
    const g = c.createGain();
    const atk = Math.min((n.atk ?? 4) / 1000, (n.ms / 1000) * 0.6);
    const peak = (n.gain ?? 0.05) * volume;
    g.gain.setValueAtTime(0.0001, t0);
    if (n.lin) g.gain.linearRampToValueAtTime(peak, t0 + atk);
    else g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let tail: AudioNode = head;
    if (n.cut) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = n.cut;
      head.connect(f);
      tail = f;
    }
    tail.connect(g).connect(c.destination);
    if (n.noise) (src as AudioBufferSourceNode).start(t0, Math.random() * 1.5);
    else src.start(t0);
    src.stop(t1 + 0.02);
  }
}

/* Ratchet: one tooth of the letter dial. */
const ratchet: Note[] = [
  { hz: 3650, ms: 4, gain: 0.15, noise: "bandpass", q: 3, atk: 1 },
  { hz: 1500, ms: 9, gain: 0.27, noise: "bandpass", q: 8, atk: 1 },
  { hz: 1480, ms: 44, gain: 0.0092, atk: 1 },
];
export const playRatchet = (volume = 0.5) => playNotes(ratchet, volume);

/* a pentatonic run, so any beads lit in a row sound like they belong together */
const SCALE = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4];

const plink = (ratio: number, at = 0, gain = 1): Note[] => [
  { hz: 664 * ratio, to: 415 * ratio, glide: 18, ms: 16, gain: 0.06 * gain, atk: 1, at },
  { hz: 2500, ms: 4, gain: 0.03 * gain, noise: "lowpass", q: 0.9, atk: 1, at },
  { hz: 1320 * ratio, ms: 130, gain: 0.011 * gain, atk: 1, at },
];

/** A bead lighting up. Each glass color has its own note. */
export const playBead = (color: number) => playNotes(plink(SCALE[color % SCALE.length] * 1.5));

/** A bead going dark: the same knock, lower and with no ring. */
export const playUnbead = () =>
  playNotes([{ hz: 330, to: 210, glide: 20, ms: 22, gain: 0.045, atk: 1 }]);

/** A small choice: a pill, a slider step. */
export const playPick = () => playNotes(plink(2).slice(0, 2), 0.7);

/** The chamber shaken: beads knocking about over a breath of air. */
export function playTumble() {
  const notes: Note[] = [{ hz: 1900, to: 520, ms: 320, gain: 0.02, noise: "bandpass", q: 1.1, atk: 30 }];
  for (let i = 0; i < 10; i++) {
    notes.push(...plink(SCALE[Math.floor(Math.random() * SCALE.length)] * 1.5, Math.random() * 300, 0.55));
  }
  playNotes(notes);
}

/* Print: a thermal head ticking down the paper, while the font compiles. */
const print: Note[] = Array.from({ length: 12 }, (_, i) => ({
  hz: [5200, 4800, 4400][i % 3],
  ms: 6,
  gain: 0.018,
  at: i * 22,
  q: 4,
  noise: "bandpass" as const,
  atk: 1,
}));
export const playPrint = () => playNotes(print);

/* Glass: a warm glass note that shimmers once, for the saved font. */
const ready: Note[] = [
  { hz: 1500, ms: 5, gain: 0.024, noise: "lowpass", q: -3, atk: 1 },
  { hz: 392, ms: 500, gain: 0.032, atk: 3 },
  { hz: 1081.92, ms: 235, gain: 0.0095, atk: 3 },
  { hz: 2116.8, ms: 143, gain: 0.0032, atk: 3 },
  { hz: 393.2, ms: 465, gain: 0.015, atk: 3 },
];
export const playReady = () => playNotes(ready);
