import type { SimControls } from "../hooks/useSimulation";
import type { PresetKey } from "../sim/engine";
import { CheckChip, Seg, Tip } from "./ui";

const PRESET_BTNS: { k: PresetKey; label: string }[] = [
  { k: "deadlock", label: "DEADLOCK TRAP" },
  { k: "starvation", label: "STARVATION" },
  { k: "burnout", label: "BURNOUT WAVE" },
  { k: "free", label: "FREE RUN" },
];

export default function HeaderDeck({
  sim,
  view,
  setView,
  onTutorial,
  theme,
  toggleTheme,
}: {
  sim: SimControls;
  view: "sim" | "compare";
  setView: (v: "sim" | "compare") => void;
  onTutorial: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}) {
  const { cfg } = sim;
  return (
    <header className="themed sticky top-0 z-30 border-b border-ink-700 bg-[#0b1117ee] backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#0e161e" stroke="#1a2733" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#4cc9f0" strokeWidth="1.6" strokeDasharray="4 3" className="glow-throb" />
            <circle cx="16" cy="7" r="2.6" fill="#ffc53d" />
            <circle cx="24" cy="20" r="2.6" fill="#3ddc97" />
            <circle cx="8" cy="20" r="2.6" fill="#ff5c5c" />
          </svg>
          <div>
            <h1 className="font-display text-[18px] font-bold leading-none tracking-[0.06em] text-ink-100">CODEXION</h1>
            <p className="mt-0.5 text-[8px] tracking-[0.22em] text-ink-400">CONCURRENCY UNDER THE HOOD</p>
          </div>
        </div>

        {/* view switch */}
        <div className="flex border border-ink-600">
          {(
            [
              { v: "sim", label: "SIMULATION" },
              { v: "compare", label: "COMPARE / WHAT-IF" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              onClick={() => setView(o.v)}
              className="px-3 py-1.5 text-[9.5px] font-bold tracking-[0.14em] transition-colors"
              style={view === o.v ? { background: "rgba(76,201,240,0.14)", color: "#4cc9f0" } : { color: "#5c7488" }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* scenario presets */}
        {view === "sim" && (
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="text-[8px] tracking-[0.2em] text-ink-400">SCENARIO</span>
            {PRESET_BTNS.map((p) => (
              <Tip key={p.k} tip={`load the “${p.label.toLowerCase()}” demonstration scenario`}>
                <button
                  onClick={() => sim.applyPreset(p.k)}
                  className="border px-2 py-1 text-[9px] font-medium tracking-wider transition-all active:translate-y-px"
                  style={
                    sim.preset === p.k
                      ? { borderColor: "#ffc53d88", color: "#ffc53d", background: "rgba(255,197,61,0.08)" }
                      : { borderColor: "#243644", color: "#8ca3b5" }
                  }
                >
                  {p.label}
                </button>
              </Tip>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onTutorial}
            className="border border-[#3ddc9766] bg-[#3ddc9710] px-2.5 py-1.5 text-[9.5px] font-bold tracking-[0.14em] text-[#3ddc97] transition-all hover:bg-[#3ddc971e] active:translate-y-px"
          >
            ▸ GUIDED TOUR
          </button>
          <Tip tip="toggle light / dark theme (300 ms cross-fade)">
            <button
              onClick={toggleTheme}
              aria-label="toggle theme"
              className="flex h-8 w-8 items-center justify-center border border-ink-600 text-ink-300 transition-colors hover:text-[#ffc53d]"
            >
              {theme === "dark" ? (
                <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M7 .8v2M7 11.2v2M.8 7h2M11.2 7h2M2.6 2.6 4 4M10 10l1.4 1.4M11.4 2.6 10 4M4 10l-1.4 1.4" stroke="currentColor" strokeWidth="1.2" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6Z" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
              )}
            </button>
          </Tip>
        </div>
      </div>

      {/* policy row */}
      {view === "sim" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-800 px-4 py-1.5">
          <div className="flex items-center gap-1.5">
            <Tip tip="how a coder acquires its two dongles: NAÏVE = left then right (deadlock-prone) · ORDERED = always lower index first (deadlock-free) · TRY+BACKOFF = atomic try-lock both, else retry">
              <span className="text-[8px] tracking-[0.2em] text-ink-400">ACQUIRE</span>
            </Tip>
            <Seg
              size="sm"
              options={[
                { value: "naive", label: "NAÏVE L→R" },
                { value: "ordered", label: "ORDERED" },
                { value: "trylock", label: "TRY+BACKOFF" },
              ]}
              value={cfg.strategy}
              onChange={(v) => sim.patchCfg({ strategy: v })}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Tip tip="grant order: FIFO = arrival order · EDF = earliest deadline first (binary min-heap)">
              <span className="text-[8px] tracking-[0.2em] text-ink-400">SCHED</span>
            </Tip>
            <Seg
              size="sm"
              options={[
                { value: "fifo", label: "FIFO" },
                { value: "edf", label: "EDF" },
              ]}
              value={cfg.scheduler}
              onChange={(v) => sim.patchCfg({ scheduler: v })}
            />
          </div>
          <Tip tip="randomly wake a sleeping waiter with nothing changed — shows why the predicate check must be while()">
            <CheckChip on={cfg.spurious} onChange={(v) => sim.patchCfg({ spurious: v })} label="SPURIOUS WAKEUPS" />
          </Tip>
          <Tip tip="after 2.5 s of circular wait, roll back the youngest victim to break the deadlock (violates 'no preemption' on purpose)">
            <CheckChip on={cfg.breaker} onChange={(v) => sim.patchCfg({ breaker: v })} label="DEADLOCK BREAKER" />
          </Tip>
          <Tip tip="the dedicated thread that scans deadline arcs once per 10 ms tick and rescues zero-energy coders">
            <CheckChip on={cfg.burnout} onChange={(v) => sim.patchCfg({ burnout: v })} label="MONITOR THREAD" />
          </Tip>
          <span className="ml-auto hidden truncate text-[9px] text-ink-400 xl:inline">{sim.presetInfo}</span>
        </div>
      )}
    </header>
  );
}
