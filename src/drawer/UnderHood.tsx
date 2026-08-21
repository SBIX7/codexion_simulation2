import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { SimConfig, Snapshot } from "../sim/engine";
import { pcFor, pcNote, subjectLine, verboseLine, type DrawerTab } from "../sim/derive";
import { identColor, Tip } from "../components/ui";

export const TABS: { id: DrawerTab; label: string }[] = [
  { id: "process", label: "PROCESS & THREADS" },
  { id: "mutexes", label: "MUTEXES" },
  { id: "condvars", label: "COND VARS" },
  { id: "racelab", label: "RACE LAB" },
  { id: "graph", label: "RESOURCE GRAPH" },
  { id: "heap", label: "PRIORITY QUEUE" },
  { id: "logs", label: "LOGS" },
];

export default function UnderHood({
  open,
  setOpen,
  tab,
  setTab,
  snap,
  cfg,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  tab: DrawerTab;
  setTab: (t: DrawerTab) => void;
  snap: Snapshot;
  cfg: SimConfig;
  children: React.ReactNode; // racelab + graph + heap rendered by parent
}) {
  return (
    <section className="glass border border-ink-700">
      <header className="flex flex-wrap items-center gap-1 border-b border-ink-700 px-2 py-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="mr-2 flex items-center gap-2 px-1.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-ink-100 transition-colors hover:text-[#4cc9f0]"
        >
          <svg width="9" height="9" viewBox="0 0 8 8" className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`}>
            <path d="M2 1l4 3-4 3Z" fill="currentColor" />
          </svg>
          UNDER THE HOOD
        </button>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setOpen(true);
            }}
            className="border px-2 py-1 text-[8.5px] font-medium tracking-[0.14em] transition-all"
            style={
              tab === t.id && open
                ? { borderColor: "#4cc9f077", color: "#4cc9f0", background: "rgba(76,201,240,0.1)" }
                : { borderColor: "transparent", color: "#5c7488" }
            }
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto hidden text-[8px] tracking-[0.16em] text-ink-400 md:inline">
          ONE TAB AT A TIME · PROGRESSIVE DISCLOSURE
        </span>
      </header>
      {open && (
        <div className="drawer-up max-h-[340px] overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {tab === "process" && <ProcessTab snap={snap} cfg={cfg} />}
          {tab === "mutexes" && <MutexTab snap={snap} cfg={cfg} />}
          {tab === "condvars" && <CondVarsTab snap={snap} />}
          {tab === "racelab" && children}
          {tab === "graph" && children}
          {tab === "heap" && children}
          {tab === "logs" && <LogsTab snap={snap} />}
        </div>
      )}
    </section>
  );
}

/* ================= PROCESS & THREADS ================= */

function ProcessTab({ snap, cfg }: { snap: Snapshot; cfg: SimConfig }) {
  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {/* memory map */}
      <div>
        <div className="border border-ink-600 bg-ink-950/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">PROCESS “codexion” — pid 4242</span>
            <span className="text-[8px] text-ink-400">one address space, {snap.coders.length + 1} threads</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <MemBlock name=".text — code" detail="coder_routine(), monitor_loop()" color="#5c7488" who="mapped once, executed by every thread (each with its own PC)" />
            <MemBlock name=".data — globals" detail="int compiles, misses, burnouts" color="#ffc53d" who="⚠ every thread can touch these — they must be locked" />
            <MemBlock
              name="HEAP — shared"
              color="#ff5c5c"
              who="the whole reason races exist: all threads read/write it"
              detail={`dongles[${cfg.coderCount}] · grant_mutex · cond dongle_free · wait queues`}
              heap
            />
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-ink-400">
          Threads share <span className="text-[#ff5c5c]">heap + globals</span> but each owns a{" "}
          <span className="text-[#4cc9f0]">private stack</span> and a <span className="text-[#3ddc97]">program counter</span>.
          That is the whole thread model in one picture.
        </p>
      </div>

      {/* thread stacks with PC cursors */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[8px] tracking-[0.2em] text-ink-400">
          <span>PRIVATE STACKS — created by pthread_create()</span>
          <span>PC = where this thread executes right now</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {snap.coders.map((c, i) => {
            const pc = pcFor(c);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="border bg-ink-950/60 p-1.5"
                style={{ borderColor: `${identColor(c.id)}44` }}
              >
                <div className="flex items-center gap-1">
                  <i className="h-1.5 w-1.5 rounded-full" style={{ background: identColor(c.id) }} />
                  <span className="text-[8.5px] font-semibold" style={{ color: identColor(c.id) }}>T{c.id + 1} {c.name}</span>
                </div>
                <div className="mt-1 space-y-[3px]">
                  {["frame 3", "frame 2", "frame 1"].map((f, fi) => (
                    <div key={f} className="h-[9px] border border-ink-700 bg-ink-800 px-1 text-[6.5px] leading-[9px] text-ink-400">{f}</div>
                  ))}
                  <div className="h-[9px] border px-1 text-[6.5px] leading-[9px]" style={{ borderColor: `${identColor(c.id)}66`, color: identColor(c.id) }}>
                    {c.phase}()
                  </div>
                </div>
                <div className="mt-1.5 border-t border-ink-700 pt-1 font-mono text-[7.5px] text-[#3ddc97]">
                  ▸ {pc.fn}:{pc.line}
                  <span className="blink">_</span>
                </div>
              </motion.div>
            );
          })}
          {/* monitor thread */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: snap.coders.length * 0.09, duration: 0.5 }}
            className="border border-[#3ddc9744] bg-ink-950/60 p-1.5"
          >
            <div className="flex items-center gap-1">
              <i className="led-on h-1.5 w-1.5 rounded-full bg-[#3ddc97]" style={{ color: "#3ddc97" }} />
              <span className="text-[8.5px] font-semibold text-[#3ddc97]">TM monitor</span>
            </div>
            <div className="mt-1 text-[7.5px] leading-relaxed text-ink-400">
              scans all deadline arcs once per {cfg.tickMs} ms tick; rescues zero-energy coders.
            </div>
            <div className="mt-1.5 border-t border-ink-700 pt-1 font-mono text-[7.5px] text-[#3ddc97]">
              ▸ monitor.c:{cfg.burnout ? 22 : 1} <span className="blink">_</span>
            </div>
          </motion.div>
        </div>
        <code className="mt-2 block border border-ink-700 bg-ink-950 px-2 py-1.5 font-mono text-[8.5px] leading-relaxed text-[#4cc9f0]">
          for (int i = 0; i &lt; N; i++) pthread_create(&amp;t[i], NULL, coder_routine, &amp;(coder_args){"{"} .id = i {"}"});
          <span className="text-ink-400"> // each call allocates a fresh private stack</span>
        </code>
        <div className="mt-1.5 text-[8.5px] text-ink-400">
          PC note for the selected state:{" "}
          <span className="text-ink-300">{pcNote(snap.coders[0])}</span> — hover any thread above; every card shows its own live PC.
        </div>
      </div>
    </div>
  );
}

function MemBlock({ name, detail, color, who, heap }: { name: string; detail: string; color: string; who: string; heap?: boolean }) {
  return (
    <Tip tip={`Who can touch this? ${who}`} block>
      <div
        className="w-full border px-2 py-1.5 transition-all hover:brightness-125"
        style={{ borderColor: `${color}55`, background: `${color}0d` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold tracking-wider" style={{ color }}>{name}</span>
          {heap && <span className="text-[7.5px] tracking-[0.16em] text-[#ff5c5c]">SHARED BY ALL THREADS</span>}
        </div>
        <div className="font-mono text-[8px] text-ink-400">{detail}</div>
      </div>
    </Tip>
  );
}

/* ================= MUTEXES ================= */

function MutexTab({ snap, cfg }: { snap: Snapshot; cfg: SimConfig }) {
  return (
    <div className="p-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {/* the global grant mutex */}
        <MutexCard
          title="grant_mutex — serializes every decision"
          locked={snap.mutexOwner >= 0}
          owner={snap.mutexOwner >= 0 ? snap.coders[snap.mutexOwner].name : null}
          ownerColor={snap.mutexOwner >= 0 ? identColor(snap.mutexOwner) : undefined}
          queue={snap.mutexQueue.map((id) => ({ name: snap.coders[id].name, color: identColor(id), waited: snap.t - snap.coders[id].waitSince }))}
          note={`queue ordered by the active scheduler: ${cfg.scheduler.toUpperCase()}`}
          wide
        />
        {/* one lock per dongle */}
        {snap.dongles.map((d) => {
          const orderedWaiters = [...d.waiters].sort((a, b) => {
            const ca = snap.coders[a], cb = snap.coders[b];
            return cfg.scheduler === "edf" ? ca.deadline - cb.deadline : ca.waitSince - cb.waitSince;
          });
          return (
            <MutexCard
              key={d.idx}
              title={`dongle[${d.idx}].lock`}
              locked={d.holder >= 0}
              owner={d.holder >= 0 ? snap.coders[d.holder].name : null}
              ownerColor={d.holder >= 0 ? identColor(d.holder) : undefined}
              cooling={d.holder === -1 && snap.t < d.coolingUntil ? Math.ceil(d.coolingUntil - snap.t) : undefined}
              queue={orderedWaiters.map((id) => ({ name: snap.coders[id].name, color: identColor(id), waited: snap.t - snap.coders[id].waitSince }))}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-ink-400">
        <span className="text-[#3ddc97]">Green padlock</span> = available · <span className="text-[#ff5c5c]">red</span> = locked.
        Blocking threads park in an ordered queue; unlock wakes the head of the line. Wait times grow on the right — that is starvation in numbers.
      </p>
    </div>
  );
}

function MutexCard({
  title, locked, owner, ownerColor, queue, note, cooling, wide,
}: {
  title: string;
  locked: boolean;
  owner: string | null;
  ownerColor?: string;
  queue: { name: string; color: string; waited: number }[];
  note?: string;
  cooling?: number;
  wide?: boolean;
}) {
  const col = locked ? "#ff5c5c" : "#3ddc97";
  return (
    <div className={`border bg-ink-950/60 p-2.5 ${wide ? "md:col-span-2 xl:col-span-3" : ""}`}>
      <div className="flex items-center gap-2">
        <motion.svg
          width="18" height="18" viewBox="0 0 18 18"
          animate={locked ? { rotate: [0, -8, 0] } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <rect x="3" y="8" width="12" height="8" rx="1.5" fill={`${col}22`} stroke={col} strokeWidth="1.5" />
          {locked ? (
            <path d="M6 8V5.5a3 3 0 0 1 6 0V8" fill="none" stroke={col} strokeWidth="1.5" />
          ) : (
            <path d="M6 8V5.5a3 3 0 0 1 6 0" fill="none" stroke={col} strokeWidth="1.5" />
          )}
          <circle cx="9" cy="12" r="1.3" fill={col} />
        </motion.svg>
        <div className="min-w-0">
          <div className="truncate font-mono text-[9.5px] text-ink-100">{title}</div>
          <div className="text-[8px] tracking-[0.16em]" style={{ color: col }}>
            {cooling !== undefined ? `COOLING ${cooling}ms` : locked ? `LOCKED · owner: ${owner}` : "UNLOCKED — free to take"}
          </div>
        </div>
        {owner && locked && (
          <motion.span
            key={owner}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="ml-auto border px-1.5 py-0.5 text-[8.5px]"
            style={{ borderColor: `${ownerColor}55`, color: ownerColor, background: `${ownerColor}12` }}
          >
            🔑 {owner}
          </motion.span>
        )}
      </div>
      {queue.length > 0 && (
        <div className="mt-2 border-t border-ink-700 pt-1.5">
          <div className="mb-1 text-[7.5px] tracking-[0.2em] text-ink-400">WAITING QUEUE →</div>
          <div className="flex flex-wrap items-center gap-1">
            {queue.map((q, i) => (
              <motion.span
                key={q.name}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-1 border px-1.5 py-[3px] text-[8.5px]"
                style={{ borderColor: `${q.color}44`, color: q.color }}
              >
                {i + 1}. {q.name}
                <span className="text-[7.5px] text-ink-400">{(q.waited / 1000).toFixed(1)}s</span>
              </motion.span>
            ))}
          </div>
        </div>
      )}
      {note && <div className="mt-1.5 text-[8px] tracking-wide text-ink-400">{note}</div>}
    </div>
  );
}

/* ================= CONDITION VARIABLES — the dormitory ================= */

function CondVarsTab({ snap }: { snap: Snapshot }) {
  const [spuriousDemo, setSpuriousDemo] = useState(0); // 0 idle, 1 woke, 2 re-checked, 3 back asleep
  const sleepers = snap.coders.filter((c) => c.phase === "wait");
  const lastSignal = useMemo(() => {
    for (let i = snap.events.length - 1; i >= 0; i--) {
      if (snap.events[i].type === "signal") return snap.events[i];
    }
    return null;
  }, [snap]);

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-3">
      {/* dormitory */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">DORMITORY — cond dongle_free</span>
          <span className="text-[8px] text-ink-400">{sleepers.length} sleeping</span>
        </div>
        <div className="mt-2 grid min-h-[110px] grid-cols-3 gap-1.5 border border-ink-600 bg-ink-950/50 p-2 sm:grid-cols-4">
          {sleepers.length === 0 && (
            <div className="col-span-full self-center text-center text-[9px] text-ink-400">— nobody sleeping: everyone either holds dongles or is thinking —</div>
          )}
          {sleepers.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="border border-ink-700 bg-ink-900 px-1.5 py-1 text-center"
            >
              <div className="text-[9px] font-semibold" style={{ color: identColor(c.id) }}>{c.name} 💤</div>
              <div className="font-mono text-[7px] text-ink-400">while(!free(D{c.wanting}))</div>
            </motion.div>
          ))}
        </div>

        {/* two-step cond_wait explainer, driven by the newest waiter */}
        <TwoStep waitCount={sleepers.length} t={snap.t} />

        <div className="mt-2 text-[8.5px] text-ink-400">
          {lastSignal
            ? <>last broadcast: <span className="text-[#3ddc97]">{lastSignal.msg}</span> — each woken thread must <span className="text-[#ffc53d]">re-check the predicate</span> before leaving the dormitory.</>
            : "no signal yet — a broadcast fires whenever a compile finishes and releases its dongles."}
        </div>
      </div>

      {/* spurious wakeup demo */}
      <div className="border border-ink-600 bg-ink-950/60 p-2.5">
        <div className="text-[9px] font-semibold tracking-[0.2em] text-[#ff8a3d]">SPURIOUS WAKEUP — why while(), not if()</div>
        <div className="mt-2 space-y-1 font-mono text-[9px]">
          <CodeLine on={spuriousDemo === 1} color="#8ca3b5">pthread_cond_wait(&amp;cond, &amp;mtx);</CodeLine>
          <CodeLine on={spuriousDemo === 1} color="#ff8a3d">// woke up — but WHY?</CodeLine>
          <CodeLine on={spuriousDemo === 2} color={spuriousDemo >= 2 ? "#3ddc97" : "#8ca3b5"}>while (!free(dongle)) {"{ /* re-check */"}</CodeLine>
          <CodeLine on={spuriousDemo === 3} color="#8ca3b5">{"    "}pthread_cond_wait(&amp;cond, &amp;mtx);</CodeLine>
          <CodeLine on={spuriousDemo === 2} color="#8ca3b5">{"}"}</CodeLine>
        </div>
        <div className="mt-2 min-h-[30px] text-[8.5px] leading-relaxed text-ink-300">
          {spuriousDemo === 0 && "The kernel may wake a waiter for no reason at all. With if() the thread would march on with the dongle still busy — while() sends it back to sleep."}
          {spuriousDemo === 1 && "⚡ woke spuriously — no signal was sent, and the dongle is NOT free."}
          {spuriousDemo === 2 && "🔁 predicate re-evaluated: free(dongle) == false → loop again."}
          {spuriousDemo === 3 && "💤 back in the dormitory. No state was corrupted — this is exactly why the check is a while()."}
        </div>
        <button
          onClick={() => {
            setSpuriousDemo(1);
            setTimeout(() => setSpuriousDemo(2), 900);
            setTimeout(() => setSpuriousDemo(3), 1800);
            setTimeout(() => setSpuriousDemo(0), 3400);
          }}
          disabled={spuriousDemo !== 0}
          className="mt-1.5 w-full border border-[#ff8a3d66] bg-[#ff8a3d10] px-2 py-1.5 text-[9px] font-semibold tracking-[0.16em] text-[#ff8a3d] transition-all hover:bg-[#ff8a3d1c] active:translate-y-px disabled:opacity-40"
        >
          {spuriousDemo === 0 ? "▶ TRIGGER SPURIOUS WAKEUP" : "WAKEUP IN PROGRESS…"}
        </button>
      </div>
    </div>
  );
}

function TwoStep({ waitCount, t }: { waitCount: number; t: number }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[8.5px]">
      <motion.div key={`s1-${waitCount}-${Math.floor(t / 2000)}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
        className="flex items-center gap-1.5 border border-[#3ddc9755] bg-[#3ddc970d] px-2 py-1 text-[#3ddc97]">
        ① release mutex
      </motion.div>
      <svg width="18" height="8"><path d="M0 4h14M11 1l4 3-4 3" stroke="#5c7488" fill="none" /></svg>
      <motion.div key={`s2-${waitCount}-${Math.floor(t / 2000)}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
        className="flex items-center gap-1.5 border border-[#8ca3b555] bg-[#8ca3b50d] px-2 py-1 text-[#8ca3b5]">
        ② go to sleep
      </motion.div>
      <span className="text-ink-400">— cond_wait does both ATOMICALLY, so no wakeup can slip between them.</span>
    </div>
  );
}

function CodeLine({ children, on, color }: { children: React.ReactNode; on: boolean; color: string }) {
  return (
    <motion.div
      animate={on ? { x: [0, 3, 0], background: ["rgba(255,138,61,0)", "rgba(255,138,61,0.18)", "rgba(255,138,61,0.06)"] } : {}}
      transition={{ duration: 0.6 }}
      className="border-l-2 px-2 py-[3px]"
      style={{ borderColor: on ? "#ff8a3d" : "#243644", color }}
    >
      {children}
    </motion.div>
  );
}

/* ================= LOGS ================= */

function LogsTab({ snap }: { snap: Snapshot }) {
  const [verbose, setVerbose] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => {
    const out: string[] = [];
    const name = (id: number) => snap.coders[id]?.name ?? "?";
    for (const e of snap.events) {
      const s = verbose ? verboseLine(e) : subjectLine(e, name);
      if (s) out.push(s);
    }
    return out;
  }, [snap, verbose]);

  const exportLog = () => {
    const name = (id: number) => snap.coders[id]?.name ?? "?";
    const body = snap.events.map((e) => `${subjectLine(e, name) ?? verboseLine(e)}`).join("\n");
    const blob = new Blob([body], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `codexion-t${snap.t}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const latencyCol = snap.maxDelta <= 10 ? "#3ddc97" : "#ff5c5c";

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">SERIALIZED LOG STREAM — never interleaved</span>
          <button
            onClick={() => setVerbose(!verbose)}
            className="ml-auto border px-2 py-[3px] text-[8px] tracking-[0.16em] transition-colors"
            style={verbose ? { borderColor: "#4cc9f077", color: "#4cc9f0" } : { borderColor: "#243644", color: "#5c7488" }}
          >
            {verbose ? "SUBJECT FORMAT" : "VERBOSE INTERNALS"}
          </button>
          <button onClick={exportLog} className="border border-[#3ddc9755] px-2 py-[3px] text-[8px] tracking-[0.16em] text-[#3ddc97] transition-colors hover:bg-[#3ddc9712]">
            {copied ? "SAVED ✓" : "EXPORT .log"}
          </button>
        </div>
        <div className="mt-2 h-[150px] overflow-y-auto border border-ink-600 bg-[#070b0f] p-2 font-mono text-[9.5px] leading-relaxed" style={{ scrollbarGutter: "stable" }}>
          {lines.length === 0 && <span className="text-ink-400">— no events this tick —</span>}
          {lines.map((l, i) => (
            <motion.div key={`${snap.t}-${i}`} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}
              className={l.includes("DEADLOCK") || l.includes("burned") ? "text-[#ff5c5c]" : "text-[#9db8cc]"}>
              {verbose ? l : <>
                <span className="text-[#5c7488]">&lt;{l.split(" ")[0]}ms&gt;</span> {l.split(" ").slice(1).join(" ")}
              </>}
            </motion.div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">10 MS BURNOUT PRECISION</div>
        <div className="mt-2 border p-2.5" style={{ borderColor: `${latencyCol}44`, background: `${latencyCol}0a` }}>
          <div className="font-display text-[26px] font-bold leading-none" style={{ color: latencyCol }}>
            Δ {snap.avgDelta || 0}<span className="text-[13px]"> ms avg</span>
          </div>
          <div className="mt-1 text-[9px] text-ink-300">
            worst detection: <b style={{ color: latencyCol }}>{snap.maxDelta || 0} ms</b> · scans: {snap.scans} · rescues: {snap.detections.length ? snap.detections.length + snap.coders.reduce((a, c) => a + c.burnouts, 0) - snap.detections.length : snap.coders.reduce((a, c) => a + c.burnouts, 0)}
          </div>
          <div className="mt-1.5 text-[8px] leading-relaxed text-ink-400">
            The monitor scans once per 10 ms tick, so detection latency is mathematically bounded: 0 ≤ Δ ≤ 10 ms. {snap.maxDelta <= 10 && snap.maxDelta > 0 ? "✓ within spec." : ""}
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {snap.detections.map((d, i) => (
            <div key={i} className="flex items-center gap-2 font-mono text-[8.5px] text-ink-300">
              <span className="text-[#5c7488]">{(d.t / 1000).toFixed(2)}s</span>
              <span style={{ color: identColor(d.coder) }}>{snap.coders[d.coder]?.name}</span>
              <span className="ml-auto" style={{ color: d.delta <= 10 ? "#3ddc97" : "#ff5c5c" }}>Δ{d.delta}ms {d.delta <= 10 ? "✓" : "✗"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
