import { useCallback, useEffect, useRef, useState } from "react";
import { useSimulation } from "./hooks/useSimulation";
import HeaderDeck from "./components/HeaderDeck";
import Stage from "./components/Stage";
import TimeMachine from "./components/TimeMachine";
import ConceptSidebar from "./components/ConceptSidebar";
import ComparisonView from "./components/ComparisonView";
import Tutorial, { type TutorialActions } from "./components/Tutorial";
import EventLog from "./components/EventLog";
import UnderHood from "./drawer/UnderHood";
import RaceLab from "./drawer/RaceLab";
import GraphHeap from "./drawer/GraphHeap";
import { Collapse, ToastCard, Tip } from "./components/ui";
import { metrics, findIdxByTime, type ConceptId, type DrawerTab } from "./sim/derive";
import type { SimEvent } from "./sim/engine";

interface Toast {
  id: number;
  tone: string;
  title: string;
  body: string;
  t: number;
  tab: DrawerTab;
  concept: ConceptId;
}

export default function App() {
  const sim = useSimulation();
  const [view, setView] = useState<"sim" | "compare">("sim");
  const [focus, setFocus] = useState<ConceptId | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("process");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastEventTRef = useRef(0);
  const toastSeq = useRef(0);

  /* theme */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* event-driven storytelling: build a toast queue (max 1 visible, rest queued) */
  const lastTickRef = useRef(0);
  useEffect(() => {
    if (sim.snap.tick < lastTickRef.current) lastEventTRef.current = 0; // run restarted / scrubbed back
    lastTickRef.current = sim.snap.tick;
    const fresh = sim.snap.events.filter((e) => e.t > lastEventTRef.current);
    if (sim.snap.events.length) lastEventTRef.current = sim.snap.t;
    for (const e of fresh) {
      const t = makeToast(e, sim.snap.coders[e.coder]?.name ?? "monitor");
      if (t) setToasts((q) => (q.length >= 3 ? q : [...q, { ...t, id: ++toastSeq.current }]));
    }
  }, [sim.snap]);

  /* auto-dismiss the visible toast */
  useEffect(() => {
    if (!toasts.length) return;
    const id = setTimeout(() => setToasts((q) => q.slice(1)), 7000);
    return () => clearTimeout(id);
  }, [toasts]);

  const showWhy = useCallback(
    (t: Toast) => {
      sim.pause();
      sim.jumpToTime(Math.max(0, t.t - 2000)); // rewind 2 s before the event
      setFocus(t.concept);
      setDrawerTab(t.tab);
      setDrawerOpen(true);
      setToasts((q) => q.slice(1));
    },
    [sim]
  );

  /* tutorial action runner */
  const runTutorial = useCallback(
    (a: TutorialActions) => {
      if (a.preset) sim.applyPreset(a.preset);
      if (a.speed) sim.setSpeed(a.speed);
      if (a.focus !== undefined) setFocus(a.focus);
      if (a.tab) setDrawerTab(a.tab);
      if (a.drawer !== undefined) setDrawerOpen(a.drawer);
      if (a.playing !== undefined) (a.playing ? sim.play : sim.pause)();
      setView("sim");
    },
    [sim]
  );

  const onSelect = useCallback((kind: "coder" | "dongle") => {
    setDrawerTab(kind === "coder" ? "process" : "mutexes");
    setDrawerOpen(true);
  }, []);

  const m = metrics(sim.snap, sim.history, sim.idx);

  return (
    <div className="scanlines themed relative min-h-screen bg-[#070b0f] font-mono text-ink-100">
      <div className="ambient-glow pointer-events-none fixed inset-0" />
      <div className="ambient-grid pointer-events-none fixed inset-0" />
      {sim.slowMoActive && <div className="slowmo-vignette" />}

      <div className="relative z-10">
        <HeaderDeck
          sim={sim}
          view={view}
          setView={setView}
          onTutorial={() => setTutorialOpen(true)}
          theme={theme}
          toggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        />

        {/* toasts — one at a time, queued */}
        <div className="pointer-events-none fixed right-3 top-[110px] z-50 flex flex-col gap-2">
          {toasts.slice(0, 1).map((t) => (
            <ToastCard key={t.id} tone={t.tone} title={t.title} body={t.body} onWhy={() => showWhy(t)} onDismiss={() => setToasts((q) => q.slice(1))} />
          ))}
          {toasts.length > 1 && (
            <div className="text-right text-[8px] tracking-[0.18em] text-ink-400">+{toasts.length - 1} QUEUED</div>
          )}
        </div>

        <main className="grid grid-cols-1 gap-3 px-3 pt-3 lg:grid-cols-[228px_minmax(0,1fr)]" style={{ paddingBottom: 172 }}>
          <div className="hidden lg:block">
            <div className="sticky top-[104px] h-[calc(100vh-280px)] min-h-[420px]">
              <ConceptSidebar
                focus={focus}
                setFocus={setFocus}
                onInspect={(tab) => {
                  setDrawerTab(tab);
                  setDrawerOpen(true);
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            {view === "sim" ? (
              <>
                {/* real-time metrics dashboard */}
                <div className="glass flex flex-wrap items-stretch gap-px overflow-hidden px-0 py-0">
                  <Metric label="compiling" value={m.compiling} color="#3ddc97" tip="coders holding both dongles right now" />
                  <Metric label="waiting" value={m.waiting} color="#8ca3b5" tip="threads parked in cond_wait" />
                  <Metric label="blocked (2nd dongle)" value={m.blocked} color="#ffc53d" tip="hold one dongle, want the other — hold & wait" />
                  <Metric label="free dongles" value={m.free} color="#4cc9f0" tip="available right now" />
                  <Metric label="held" value={m.held} color="#ff5c5c" tip="in use" />
                  <Metric label="cooling" value={m.cooling} color="#ff8a3d" tip="released, unavailable for X ms" />
                  <Metric label="compiles" value={m.compiles} color="#e8f0f6" tip="total successful compilations" />
                  <Metric label="burnouts" value={m.burnouts} color={m.burnouts ? "#ff5c5c" : "#e8f0f6"} tip="total burnout rescues" />
                  <Metric label="avg wait" value={`${(m.avgWait / 1000).toFixed(1)}s`} color="#e8f0f6" tip="mean time spent blocked" />
                  <Metric label="max wait" value={`${(m.maxWait / 1000).toFixed(1)}s`} color={m.maxWait > 2500 ? "#ff5c5c" : "#e8f0f6"} tip="starvation alarm above 2.5 s" />
                  <Metric label="utilization" value={`${Math.round(m.utilization * 100)}%`} color="#e8f0f6" tip="fraction of dongle-time spent held" />
                  <Metric label="detect Δ" value={`${m.maxDelta}ms`} color={m.maxDelta <= 10 ? "#3ddc97" : "#ff5c5c"} tip="worst burnout detection latency — must stay ≤ 10 ms" />
                </div>

                {/* the hub */}
                <div className="glass px-2 pb-1 pt-2">
                  <Stage snap={sim.snap} focus={focus} onSelect={onSelect} />
                </div>

                {/* synced event log — collapsed by default (progressive disclosure) */}
                <Collapse
                  title="EVENT STREAM — synchronized with the timeline"
                  badge={<span className="text-[8px] tracking-[0.18em] text-ink-400">CLICK A LINE TO JUMP</span>}
                  defaultOpen={false}
                >
                  <div className="h-[220px]">
                    <EventLog history={sim.history} idx={sim.idx} onEventClick={(e) => {
                      sim.pause();
                      sim.scrubTo(findIdxByTime(sim.history, e.t));
                    }} />
                  </div>
                </Collapse>

                {/* under-the-hood drawer */}
                <UnderHood
                  open={drawerOpen}
                  setOpen={setDrawerOpen}
                  tab={drawerTab}
                  setTab={setDrawerTab}
                  snap={sim.snap}
                  cfg={sim.cfg}
                >
                  {drawerTab === "racelab" ? (
                    <RaceLab />
                  ) : (
                    <GraphHeap tab={drawerTab} snap={sim.snap} cfgScheduler={sim.cfg.scheduler} />
                  )}
                </UnderHood>
              </>
            ) : (
              <ComparisonView playing={sim.playing} speed={sim.speed} />
            )}
          </div>
        </main>
      </div>

      <TimeMachine sim={sim} />

      {tutorialOpen && <Tutorial run={runTutorial} onClose={() => setTutorialOpen(false)} />}
    </div>
  );
}

/* ---------------- small metric cell ---------------- */
function Metric({ label, value, color, tip }: { label: string; value: React.ReactNode; color: string; tip: string }) {
  return (
    <Tip tip={tip} block className="min-w-[86px] flex-1">
      <div className="flex h-full flex-col bg-ink-900/50 px-2.5 py-1.5 transition-colors hover:bg-ink-800/70">
        <span className="text-[7px] uppercase tracking-[0.16em] text-ink-400">{label}</span>
        <span className="font-display text-[15px] font-semibold leading-tight tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
    </Tip>
  );
}

/* ---------------- toast factory ---------------- */
function makeToast(e: SimEvent, name: string): Omit<Toast, "id"> | null {
  switch (e.type) {
    case "deadlock":
      return {
        tone: "#ff5c5c",
        title: "⦿ Circular wait forming",
        body: `${e.msg}. Every thread holds its left dongle and wants its right neighbour's — all four Coffman conditions now hold. Slow-motion engaged.`,
        t: e.t,
        tab: "graph",
        concept: "deadlock",
      };
    case "burnout":
      return {
        tone: "#ff8a3d",
        title: `🔥 ${name} burned out`,
        body: `Energy hit zero; the monitor's next 10 ms scan rescued them and force-released their dongles. Check the Δ stamp in the LOGS tab.`,
        t: e.t,
        tab: "logs",
        concept: "burnout",
      };
    case "rollback":
      return {
        tone: "#ffc53d",
        title: "⚡ Deadlock breaker fired",
        body: `${name} was chosen as the youngest victim: its held dongle is released, the cycle dissolves, and it retries after a pause.`,
        t: e.t,
        tab: "graph",
        concept: "deadlock",
      };
    case "miss":
      return {
        tone: "#ffc53d",
        title: "⏰ Deadline missed",
        body: `${name} finished compiling after its burnout deadline. Under EDF, the heap would have promoted it ahead of relaxed threads.`,
        t: e.t,
        tab: "heap",
        concept: "scheduling",
      };
    default:
      return null;
  }
}
