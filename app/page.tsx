import { Editor } from "@/components/Editor";

export default function Page() {
  return (
    <main className="min-h-dvh px-4 sm:px-8 py-8 max-w-[1200px] mx-auto">
      <header className="flex items-baseline justify-between border-b border-black pb-4 mb-14">
        <h1 className="text-sm font-medium tracking-tight">
          Kaleidoscope <span className="text-neutral-400">Font Generator</span>
        </h1>
        <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          Voronoi · OpenType
        </span>
      </header>
      <Editor />
      <footer className="mt-20 pt-4 border-t border-[#D1D5DB] text-[11px] text-neutral-400 flex justify-between">
        <span>Fonts compile in your browser. Nothing is uploaded.</span>
        <span>1000 upm · 700 unit glyph square</span>
      </footer>
    </main>
  );
}
