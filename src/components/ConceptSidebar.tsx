import { CONCEPTS, type ConceptId, type DrawerTab } from "../sim/derive";
import { DONGLE_COLORS } from "./ui";

export default function ConceptSidebar({
  focus,
  setFocus,
  onInspect,
}: {
  focus: ConceptId | null;
  setFocus: (c: ConceptId | null) => void;
  onInspect: (tab: DrawerTab) => void;
}) {
  const active = focus ? CONCEPTS.find((c) => c.id === focus)! : null;

  return (
    <aside className="flex h-full min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5" style={{ scrollbarGutter: "stable" }}>
      <div>
        <div className="mb-1.5 text-[8px] tracking-[0.24em] text-ink-400">FOCUS MODE — ONE CONCEPT AT A TIME</div>
        <div className="flex flex-col gap-1">
          {CONCEPTS.map((c) => {
            const on = focus === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFocus(on ? null : c.id)}
                className="group flex items-center gap-2.5 border px-2.5 py-[7px] text-left text-[11px] font-medium tracking-wide transition-all active:translate-y-px"
                style={
                  on
                    ? { borderColor: `${c.color}77`, background: `${c.color}12`, color: c.color, boxShadow: `inset 2px 0 0 ${c.color}` }
                    : { borderColor: "#1a2733", color: "#8ca3b5" }
                }
              >
                <i className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform group-hover:scale-125" style={{ background: c.color }} />
                {c.label}
                {on && <span className="ml-auto text-[8px] tracking-[0.18em]">ON</span>}
              </button>
            );
          })}
          {focus && (
            <button
              onClick={() => setFocus(null)}
              className="mt-0.5 border border-dashed border-ink-600 px-2.5 py-[5px] text-[9.5px] tracking-[0.14em] text-ink-400 transition-colors hover:text-ink-100"
            >
              ✕ CLEAR FOCUS — SHOW EVERYTHING
            </button>
          )}
        </div>
      </div>

      {/* explanation card — definition / why / primitive / inspect live */}
      {active && (
        <div key={active.id} className="flicker-in border bg-ink-900/70" style={{ borderColor: `${active.color}44` }}>
          <div className="border-b px-3 py-2" style={{ borderColor: `${active.color}33` }}>
            <div className="text-[8px] tracking-[0.22em]" style={{ color: active.color }}>
              CONCEPT
            </div>
            <div className="font-display text-[14px] font-semibold text-ink-100">{active.label}</div>
          </div>
          <div className="space-y-2.5 px-3 py-2.5 text-[10px] leading-relaxed">
            <div>
              <div className="text-[8px] tracking-[0.2em] text-ink-400">DEFINITION</div>
              <p className="text-ink-300">{active.def}</p>
            </div>
            <div>
              <div className="text-[8px] tracking-[0.2em] text-ink-400">WHY IT MATTERS IN CODEXION</div>
              <p className="text-ink-300">{active.why}</p>
            </div>
            <div>
              <div className="text-[8px] tracking-[0.2em] text-ink-400">C / PTHREAD PRIMITIVE</div>
              <code className="mt-0.5 block border border-ink-700 bg-ink-950 px-2 py-1 font-mono text-[9px] text-[#4cc9f0]">
                {active.primitive}
              </code>
            </div>
            <button
              onClick={() => onInspect(active.tab)}
              className="w-full border px-2 py-1.5 text-[9.5px] font-semibold tracking-[0.16em] transition-all hover:brightness-125 active:translate-y-px"
              style={{ borderColor: `${active.color}66`, color: active.color, background: `${active.color}10` }}
            >
              INSPECT LIVE — OPEN “{active.tab.toUpperCase()}” TAB ▸
            </button>
          </div>
        </div>
      )}

      {!active && (
        <div className="border border-dashed border-ink-700 px-3 py-3 text-[9.5px] leading-relaxed text-ink-400">
          Pick a concept to dim everything unrelated on the hub and read a 30-second explanation. Depth lives in the
          <span className="text-ink-300"> Under-the-Hood drawer</span> below the stage.
        </div>
      )}

      {/* persistent legend */}
      <div className="mt-auto border border-ink-700 bg-ink-900/60 px-3 py-2.5">
        <div className="mb-1.5 text-[8px] tracking-[0.24em] text-ink-400">LEGEND</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[8.5px] text-ink-300">
          <LegendDot color={DONGLE_COLORS.available} label="available / info" />
          <LegendDot color="#3ddc97" label="compiling / success" />
          <LegendDot color="#ffc53d" label="debugging / warning" />
          <LegendDot color={DONGLE_COLORS.inuse} label="held / locked / burnout" />
          <LegendDot color={DONGLE_COLORS.cooling} label="cooldown / refactor" />
          <LegendDot color="#8ca3b5" label="waiting / inactive" />
        </div>
        <div className="mt-2 border-t border-ink-700 pt-1.5 text-[8px] leading-relaxed tracking-wide text-ink-400">
          CODER STATES — <span className="text-[#3ddc97]">green pulse</span> compiling ·{" "}
          <span className="text-[#ffc53d]">amber</span> debugging · <span className="text-[#4cc9f0]">cyan</span> refactoring ·{" "}
          <span className="text-[#8ca3b5]">gray breathing</span> waiting · <span className="text-[#ff5c5c]">red flash</span> burned out
        </div>
      </div>
    </aside>
  );
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
    {label}
  </span>
);
