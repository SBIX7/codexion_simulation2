import { useEffect, useMemo, useRef, useState } from "react";
import { createSim, stepSim, collectRuns, type Sim, type SimConfig, type Snapshot } from "../sim/engine";
import { metrics } from "../sim/derive";
import { PHASE_META, identColor } from "./ui";

/* scenario presets for the split-screen lab */
const BASE = {
  strategy: "ordered" as const, spurious: false, breaker: true, burnout: true, tickMs: 10, seed: 4242,
};

const SCENARIOS = [
  {
    key: "edf-saves",
    label: "FIFO FAILS · EDF SAVES",
    desc: "heavy drain + tight deadlines. FIFO burns people out; EDF promotes the urgent ones.",
    cfg: { ...BASE, coderCount: 7, scheduler: "fifo" as const, cooldownMs: 300, deadlineBase: 800, deadlineSpread: 500, energyInit: 82, drainMul: 1.6 },
  },
  {
    key: "both-ok",
    label: "BOTH SUCCEED",
    desc: "light load — EDF is not always necessary. Watch identical outcomes.",
    cfg: { ...BASE, coderCount: 5, scheduler: "fifo" as const, strategy: "trylock" as const, cooldownMs: 150, deadlineBase: 2000, deadlineSpread: 1200, energyInit: 100, drainMul: 0.6 },
  },
  {
    key: "infeasible",
    label: "INFEASIBLE WORKLOAD",
    desc: "the load exceeds capacity no matter what. Teaches the limit of any scheduler.",
    cfg: { ...BASE, coderCount: 8, scheduler: "fifo" as const, cooldownMs: 500, deadlineBase: 700, deadlineSpread: 400, energyInit: 60, drainMul: 2.4 },
  },
];

const WHATIFS = [
  { key: "burnout2x", label: "time_to_burnout ÷ 2", patch: { drainMul: 3.2 } },
  { key: "more-coders", label: "+2 coders join", patch: { coderCount: 9 } },
  { key: "cooldown2x", label: "cooldown × 2", patch: { cooldownMs: 600 } },
];

const WIN = 500; // ticks shown in the mini gantt

export default function ComparisonView({ playing, speed }: { playing: boolean; speed: number }) {
  const [scenario, setScenario] = useState(0);
  const [mode, setMode] = useState<"compare" | "whatif">("compare");
  const [whatif, setWhatif] = useState(0);

  const leftCfg: SimConfig = useMemo(() => ({ ...SCENARIOS[scenario].cfg }), [scenario]);
  const rightCfg: SimConfig = useMemo(() => {
    if (mode === "compare") return { ...SCENARIOS[scenario].cfg, scheduler: "edf" };
    return { ...SCENARIOS[scenario].cfg, ...WHATIFS[whatif].patch };
  }, [mode, scenario, whatif]);

  const dual = useDualSim(leftCfg, rightCfg, playing, speed);
  const snapA = dual.histA[dual.histA.length - 1];
  const snapB = dual.histB[dual.histB.length - 1];

  const mA = snapA ? metrics(snapA, dual.histA, dual.histA.length - 1) : null;
  const mB = snapB ? metrics(snapB, dual.histB, dual.histB.length - 1) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border border-ink-600">
          {(["compare", "whatif"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.14em] transition-colors"
              style={mode === m ? { background: "rgba(76,201,240,0.14)", color: "#4cc9f0" } : { color: "#5c7488" }}>
              {m === "compare" ? "FIFO vs EDF" : "WHAT IF…"}
            </button>
          ))}
        </div>
        {SCENARIOS.map((s, i) => (
          <button key={s.key} onClick={() => setScenario(i)}
            className="border px-2 py-1 text-[9px] tracking-[0.1em] transition-all active:translate-y-px"
            style={scenario === i ? { borderColor: "#ffc53d88", color: "#ffc53d", background: "rgba(255,197,61,0.08)" } : { borderColor: "#243644", color: "#8ca3b5" }}>
            {s.label}
          </button>
        ))}
        {mode === "whatif" && (
          <select
            value={whatif}
            onChange={(e) => setWhatif(Number(e.target.value))}
            className="border border-ink-600 bg-ink-900 px-2 py-1 text-[9.5px] text-ink-100 outline-none"
          >
            {WHATIFS.map((w, i) => (
              <option key={w.key} value={i}>{w.label}</option>
            ))}
          </select>
        )}
        <span className="ml-auto max-w-[420px] truncate text-[9px] text-ink-400">{SCENARIOS[scenario].desc}</span>
      </div>

      {/* split screens */}
      <div className="grid gap-3 lg:grid-cols-2">
        <SimPane label={mode === "compare" ? "FIFO" : "BASELINE"} tone="#4cc9f0" hist={dual.histA} m={mA} />
        <SimPane label={mode === "compare" ? "EDF" : `WHAT-IF · ${WHATIFS[whatif].label.toUpperCase()}`} tone="#3ddc97" hist={dual.histB} m={mB} />
      </div>

      {/* shared stats strip with deltas */}
      {mA && mB && (
        <div className="glass grid grid-cols-2 gap-px border border-ink-700 sm:grid-cols-3 lg:grid-cols-6">
          <DeltaStat label="burnouts" a={mA.burnouts} b={mB.burnouts} good="lower" />
          <DeltaStat label="compiles" a={mA.compiles} b={mB.compiles} good="higher" />
          <DeltaStat label="avg wait" a={mA.avgWait} b={mB.avgWait} good="lower" fmt={(v) => `${(v / 1000).toFixed(1)}s`} />
          <DeltaStat label="max wait" a={mA.maxWait} b={mB.maxWait} good="lower" fmt={(v) => `${(v / 1000).toFixed(1)}s`} />
          <DeltaStat label="utilization" a={mA.utilization * 100} b={mB.utilization * 100} good="higher" fmt={(v) => `${Math.round(v)}%`} />
          <DeltaStat label="misses" a={mA.misses} b={mB.misses} good="lower" />
        </div>
      )}
    </div>
  );
}

/* ---------- one side of the split screen ---------- */
function SimPane({ label, tone, hist, m }: { label: string; tone: string; hist: Snapshot[]; m: ReturnType<typeof metrics> | null }) {
  if (!hist.length) return <div className="glass border border-ink-700 p-2.5 text-[9px] text-ink-400">spinning up engine…</div>;
  const snap = hist[hist.length - 1];
  const startIdx = Math.max(0, hist.length - WIN);
  const startT = hist[startIdx].t;
  const span = Math.max(1, snap.t - startT);
  const lanes = snap.coders.map((c) => collectRuns(hist, hist.length - 1, c.id, startT));

  return (
    <div className="glass border p-2.5" style={{ borderColor: `${tone}33` }}>
      <div className="flex items-center gap-2">
        <span className="border px-2 py-[3px] text-[9.5px] font-bold tracking-[0.18em]" style={{ borderColor: `${tone}66`, color: tone, background: `${tone}10` }}>
          {label}
        </span>
        <span className="font-mono text-[9px] text-ink-400">t = {(snap.t / 1000).toFixed(2)}s</span>
        <span className="ml-auto flex gap-1">
          {snap.coders.map((c) => (
            <i key={c.id} title={`${c.name}: ${c.phase}`} className="h-2.5 w-2.5 rounded-full"
              style={{ background: PHASE_META[c.phase].color, boxShadow: `0 0 6px ${PHASE_META[c.phase].color}88` }} />
          ))}
        </span>
      </div>
      {/* mini gantt */}
      <div className="mt-2">
        {lanes.map((runs, cid) => (
          <div key={cid} className="relative mb-[2px] h-[6px] bg-[#0b111788]" >
            {runs.map((r, i) => {
              const left = ((Math.max(r.from, startT) - startT) / span) * 100;
              const w = Math.max(0.2, ((Math.min(r.to, snap.t) - Math.max(r.from, startT)) / span) * 100);
              return <div key={i} className="absolute top-0 h-full" style={{ left: `${left}%`, width: `${w}%`, background: PHASE_META[r.phase].color, opacity: 0.85 }} />;
            })}
          </div>
        ))}
      </div>
      {m && (
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          <PaneStat label="burnouts" value={m.burnouts} color={m.burnouts ? "#ff5c5c" : "#3ddc97"} />
          <PaneStat label="compiles" value={m.compiles} color="#3ddc97" />
          <PaneStat label="avg wait" value={`${(m.avgWait / 1000).toFixed(1)}s`} />
          <PaneStat label="util" value={`${Math.round(m.utilization * 100)}%`} />
        </div>
      )}
    </div>
  );
}

const PaneStat = ({ label, value, color = "#e8f0f6" }: { label: string; value: React.ReactNode; color?: string }) => (
  <div className="border border-ink-700 bg-ink-950/60 py-1">
    <div className="font-display text-[13px] font-semibold tabular-nums" style={{ color }}>{value}</div>
    <div className="text-[7px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
  </div>
);

function DeltaStat({ label, a, b, good, fmt = (v) => String(Math.round(v)) }: { label: string; a: number; b: number; good: "lower" | "higher"; fmt?: (v: number) => string }) {
  const diff = b - a;
  const better = good === "lower" ? diff < 0 : diff > 0;
  return (
    <div className="bg-ink-900/60 px-2.5 py-2">
      <div className="text-[7.5px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2 font-mono text-[10.5px]">
        <span className="text-[#4cc9f0]">{fmt(a)}</span>
        <span className="text-ink-400">vs</span>
        <span className="text-[#3ddc97]">{fmt(b)}</span>
        {diff !== 0 && (
          <span className="ml-auto text-[9px] font-bold" style={{ color: better ? "#3ddc97" : "#ff5c5c" }}>
            {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))} {better ? "✓" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- lockstep dual simulation ----------
   Both engines are stepped inside the same rAF frame with the same seed,
   so the two lanes stay perfectly time-aligned.                       */
function useDualSim(cfgA: SimConfig, cfgB: SimConfig, playing: boolean, speed: number) {
  const stateRef = useRef<{ a: Sim; b: Sim; ha: Snapshot[]; hb: Snapshot[] } | null>(null);
  const [, setV] = useState(0);
  const pRef = useRef(playing);
  const sRef = useRef(speed);
  pRef.current = playing;
  sRef.current = speed;

  useEffect(() => {
    const a = createSim(cfgA);
    const b = createSim(cfgB);
    stateRef.current = { a, b, ha: [stepSim(a)], hb: [stepSim(b)] };
    setV((x) => x + 1);
  }, [cfgA, cfgB]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const st = stateRef.current;
      if (st && pRef.current) {
        acc += (dt * sRef.current) / st.a.cfg.tickMs;
        const nSteps = Math.min(60, Math.floor(acc));
        acc -= nSteps;
        for (let i = 0; i < nSteps; i++) {
          st.ha.push(stepSim(st.a));
          st.hb.push(stepSim(st.b));
        }
        if (st.ha.length > 4000) st.ha.splice(0, 1000);
        if (st.hb.length > 4000) st.hb.splice(0, 1000);
        if (nSteps > 0) setV((x) => x + 1);
      } else {
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const st = stateRef.current;
  return { histA: st?.ha ?? [], histB: st?.hb ?? [] };
}
