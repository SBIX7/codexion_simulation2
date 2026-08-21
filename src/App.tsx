import { useState } from "react";
import { useSimulation } from "./hooks/useSimulation";
import HeaderDeck, { type Modules } from "./components/HeaderDeck";
import Stage from "./components/Stage";
import Timeline from "./components/Timeline";
import SyncPanel from "./components/SyncPanel";
import SchedulerPanel from "./components/SchedulerPanel";
import BurnoutPanel from "./components/BurnoutPanel";
import EventLog from "./components/EventLog";
import { Panel } from "./components/ui";

export default function App() {
  const sim = useSimulation();
  const [modules, setModules] = useState<Modules>({
    stage: true,
    timeline: true,
    sync: true,
    sched: true,
    burnout: true,
  });

  const totals = sim.snap.coders.reduce(
    (a, c) => ({ compiles: a.compiles + c.compiles, misses: a.misses + c.misses, burnouts: a.burnouts + c.burnouts }),
    { compiles: 0, misses: 0, burnouts: 0 }
  );

  return (
    <div className="scanlines relative min-h-screen bg-[#070b0f] font-mono text-ink-100">
      {/* ambient layered background */}
      <div className="ambient-glow pointer-events-none fixed inset-0" />
      <div className="ambient-grid pointer-events-none fixed inset-0" />

      <div className="relative z-10">
        <HeaderDeck sim={sim} modules={modules} setModules={setModules} />

        <main className="grid grid-cols-1 gap-3 px-3 py-3 xl:grid-cols-[280px_minmax(0,1fr)_344px]">
          {/* left — logging system (existing sink, viz-only) */}
          <section className="order-3 flex min-h-0 flex-col border border-ink-700 bg-ink-900/80 h-[340px] xl:order-1 xl:h-[calc(100vh-136px)] xl:sticky xl:top-[124px]">
            <header className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
              <span className="border border-[#3ddc9744] bg-[#3ddc9714] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-[#3ddc97]">
                LOG-00
              </span>
              <h2 className="font-display text-[13px] font-semibold tracking-wide">EVENT STREAM</h2>
              <span className="ml-auto text-[8px] tracking-[0.18em] text-ink-400">./codexion --log</span>
            </header>
            <div className="min-h-0 flex-1">
              <EventLog history={sim.history} idx={sim.idx} />
            </div>
          </section>

          {/* center — resource stage + timeline */}
          <section className="order-1 flex min-w-0 flex-col gap-3 xl:order-2">
            {/* scenario strip */}
            <div className="flex items-center gap-2 border border-ink-700 bg-ink-900/60 px-3 py-1.5">
              <span className="text-[8px] tracking-[0.22em] text-[#ffc53d]">
                {sim.preset ? `SCENARIO//${sim.preset.toUpperCase()}` : "SCENARIO//CUSTOM"}
              </span>
              <span className="truncate text-[9.5px] text-ink-300">{sim.presetInfo}</span>
            </div>

            <Panel
              code="RES-02"
              title="RESOURCE ACQUISITION — THE DONGLE TABLE"
              accent="#4cc9f0"
              enabled={modules.stage}
              onToggle={(v) => setModules({ ...modules, stage: v })}
              right={
                sim.snap.deadlock.length > 0 ? (
                  <span className="border border-[#ff5c5c88] bg-[#ff5c5c14] px-1.5 py-0.5 text-[8px] tracking-[0.18em] text-[#ff5c5c]">
                    ⦿ CIRCULAR WAIT
                  </span>
                ) : undefined
              }
            >
              <div className="px-2 pt-2 pb-1">
                <Stage snap={sim.snap} enabled={modules.stage} />
              </div>
            </Panel>

            <Panel
              code="TML-01"
              title="THREAD STATE TIMELINE"
              accent="#ffc53d"
              enabled={modules.timeline}
              onToggle={(v) => setModules({ ...modules, timeline: v })}
            >
              <div className="py-2.5">
                <Timeline
                  history={sim.history}
                  idx={sim.idx}
                  snap={sim.snap}
                  scrubTo={sim.scrubTo}
                  setScrubbing={sim.setScrubbing}
                  playing={sim.playing}
                />
              </div>
            </Panel>
          </section>

          {/* right — diagnostics rail */}
          <aside className="order-2 flex flex-col gap-3 xl:order-3">
            <Panel
              code="SYN-03"
              title="MUTEX & COND VAR INTERNALS"
              accent="#ff8a3d"
              enabled={modules.sync}
              onToggle={(v) => setModules({ ...modules, sync: v })}
            >
              <SyncPanel snap={sim.snap} />
            </Panel>

            <Panel
              code="SCH-04"
              title="SCHEDULING — FIFO vs EDF"
              accent="#3ddc97"
              enabled={modules.sched}
              onToggle={(v) => setModules({ ...modules, sched: v })}
            >
              <SchedulerPanel snap={sim.snap} policy={sim.cfg.scheduler} />
            </Panel>

            <Panel
              code="BRN-05"
              title="BURNOUT MONITOR · 10 MS PRECISION"
              accent="#ff5c5c"
              enabled={modules.burnout}
              onToggle={(v) => setModules({ ...modules, burnout: v })}
              right={
                <span className="text-[8px] tracking-[0.16em]" style={{ color: sim.cfg.burnout ? "#3ddc97" : "#5c7488" }}>
                  {sim.cfg.burnout ? "THREAD LIVE" : "THREAD OFF"}
                </span>
              }
            >
              <BurnoutPanel snap={sim.snap} enabledInCfg={sim.cfg.burnout} />
            </Panel>
          </aside>
        </main>

        {/* status strip */}
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-ink-700 px-4 py-2 text-[9px] tracking-[0.14em] text-ink-400">
          <span>COMPILES <b className="text-[#3ddc97]">{totals.compiles}</b></span>
          <span>DEADLINE MISSES <b className="text-[#ff8a3d]">{totals.misses}</b></span>
          <span>BURNOUTS <b className="text-[#ff5c5c]">{totals.burnouts}</b></span>
          <span>GRANTS <b className="text-ink-100">{sim.snap.grants}</b></span>
          <span>FIFO/EDF DIVERGENCES <b className="text-[#ffc53d]">{sim.snap.divergences}</b></span>
          <span className="ml-auto hidden md:inline">
            VIZ OVERLAY IS READ-ONLY — SNAPSHOTS + EVENT RING BUFFER, CORE LOGIC UNTOUCHED
          </span>
        </footer>
      </div>
    </div>
  );
}
