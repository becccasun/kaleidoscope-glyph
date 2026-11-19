import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Toast {
  id: number;
  text: string;
}

interface UiStore {
  sound: boolean;
  /** the word set in the font along the bottom of the studio */
  word: string;
  toast: Toast | null;
  setSound: (on: boolean) => void;
  setWord: (word: string) => void;
  /** Says what just changed, with an Undo beside it. */
  notify: (text: string) => void;
  dismiss: () => void;
}

/** Interface preferences. Kept apart from the font itself, so undo never touches them. */
export const useUi = create<UiStore>()(
  persist(
    (set) => ({
      sound: true,
      word: "KALEIDOSCOPE",
      toast: null,
      setSound: (sound) => set({ sound }),
      setWord: (word) => set({ word }),
      notify: (text) => set({ toast: { id: Date.now(), text } }),
      dismiss: () => set({ toast: null }),
    }),
    {
      name: "kaleidoscope-ui-v1",
      partialize: (s) => ({ sound: s.sound, word: s.word }),
    },
  ),
);
