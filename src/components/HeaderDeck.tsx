import type { SimControls } from "../hooks/useSimulation";
import type { PresetKey } from "../sim/engine";
import {
  CheckChip, DiceGlyph, ModuleSwitch, PauseGlyph, PlayGlyph, ResetGlyph, Seg, StepGlyph, TransportBtn,
} from "./ui";

export interface Modules {
  stage: boolean;
  timeline: boolean;
  sync: boolean;
  sched: boolean;
  burnout: boolean;
}

const PRESET_BTNS: { k: PresetKey; label: string }[] = [
  { k: "deadlock", label: "DEADLOCK TRAP" },
  { k: "starvation", label: "STARVATION" },
  { k: "burnout", label: "BURNOUT WAVE" },
  { k: "free", label: "FREE RUN" },
];

const MODULE_DEFS: { key: keyof Modules; code: string; label: string }[] = [
  { key: "stage", code: "RES", label: "resource table" },
  { key: "timeline", code: "TML", label: "timeline" },
  { key: "sync", code: "SYN", label: "sync internals" },
  { key: "sched", code: "SCH", label: "scheduler" },
  { key: "burnout", code: "BRN", label: "burnout" },
];

export default function HeaderDeck({
  sim,
  modules,
  setModules,
}: {
  sim: SimControls;
  modules: Modules;
  setModules: (m: Modules) => void;
}) {
  const { cfg, snap } = sim;

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-[#0b1117f2]">
      {/* row 1 — brand + transport */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-2.5 pb-2">
        <div className="flex items-center gap-2.5">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="6" fill="#0e161e" stroke="#1a2733" />
            <circle cx="16" cy="16" r="9" fill="none" stroke="#4cc9f0" strokeWidth="1.6" strokeDasharray="4 3" className="glow-throb" />
            <circle cx="16" cy="7" r="2.6" fill="#ffc53d" />
            <circle cx="24" cy="20" r="2.6" fill="#3ddc97" />
            <circle cx="8" cy="20" r="2.6" fill="#ff5c5c" />
          </svg>
          <div>
            <h1 className="font-display text-[19px] font-bold leading-none tracking-[0.06em] text-ink-100">
              CODEXION
            </h1>
            <p className="mt-0.5 text-[8.5px] tracking-[0.22em] text-ink-400">
              MULTITHREAD DONGLE SIM · DIAGNOSTIC CONSOLE
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 text-[9px] text-ink-400 md:flex">
          <span className="border border-ink-700 px-1.5 py-0.5">{cfg.coderCount} CODERS</span>
          <span className="border border-ink-700 px-1.5 py-0.5">TICK 10ms</span>
          <span className="border border-ink-700 px-1.5 py-0.5">SEED {cfg.seed.toString(16).slice(0, 6)}</span>
          {snap.deadlock.length > 0 && (
            <span className="border border-[#ff5c5c88] bg-[#ff5c5c14] px-1.5 py-0.5 tracking-wider text-[#ff5c5c]">
              ⦿ DEADLOCK
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-[22px] font-semibold leading-none text-ink-100 tabular-nums">
              {(snap.t / 1000).toFixed(2)}
              <span className="text-[12px] text-ink-400"> s</span>
            </div>
            <div className="text-[8px] tracking-[0.2em] text-ink-400">SIM TIME · {sim.speed}×</div>
          </div>
          <div className="flex items-center gap-1">
            <TransportBtn onClick={sim.reroll} label="restart with fresh seed">
              <ResetGlyph />
            </TransportBtn>
            <TransportBtn onClick={sim.stepOnce} label="advance one tick (pauses)">
              <StepGlyph />
            </TransportBtn>
            <TransportBtn onClick={sim.togglePlay} label={sim.playing ? "pause" : "play"} primary>
              {sim.playing ? <PauseGlyph /> : <PlayGlyph />}
            </TransportBtn>
            <Seg
              size="sm"
              options={[1, 2, 4, 8].map((v) => ({ value: v, label: `${v}×` }))}
              value={sim.speed}
              onChange={sim.setSpeed}
            />
            <TransportBtn onClick={sim.reroll} label="re-roll scenario seed">
              <DiceGlyph />
            </TransportBtn>
          </div>
        </div>
      </div>

      {/* row 2 — scenario + policies + module matrix */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-800 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] tracking-[0.2em] text-ink-400">SCENARIO</span>
          {PRESET_BTNS.map((p) => (
            <button
              key={p.k}
              onClick={() => sim.applyPreset(p.k)}
              className="border px-2 py-1 text-[9.5px] font-medium tracking-wider transition-all active:translate-y-px"
              style={
                sim.preset === p.k
                  ? { borderColor: "#ffc53d88", color: "#ffc53d", background: "rgba(255,197,61,0.08)" }
                  : { borderColor: "#243644", color: "#8ca3b5" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[8px] tracking-[0.2em] text-ink-400">ACQUIRE</span>
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
          <span className="text-[8px] tracking-[0.2em] text-ink-400">SCHED</span>
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

        <div className="flex items-center gap-1.5">
          <CheckChip on={cfg.spurious} onChange={(v) => sim.patchCfg({ spurious: v })} label="SPURIOUS WAKEUPS" />
          <CheckChip on={cfg.breaker} onChange={(v) => sim.patchCfg({ breaker: v })} label="DEADLOCK BREAKER" />
          <CheckChip on={cfg.burnout} onChange={(v) => sim.patchCfg({ burnout: v })} label="MONITOR" />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[8px] tracking-[0.2em] text-ink-400">VIZ MODULES</span>
          {MODULE_DEFS.map((m) => (
            <span key={m.key} className="flex items-center gap-1 text-[8px] tracking-wider text-ink-400" title={m.label}>
              {m.code}
              <ModuleSwitch on={modules[m.key]} onChange={(v) => setModules({ ...modules, [m.key]: v })} />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
