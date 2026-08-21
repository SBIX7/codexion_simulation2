import { motion } from "framer-motion";
import type { Snapshot } from "../sim/engine";
import { coffman, heapOps, waitEdges, type DrawerTab } from "../sim/derive";
import { identColor } from "../components/ui";

export default function GraphHeap({ tab, snap, cfgScheduler }: { tab: DrawerTab; snap: Snapshot; cfgScheduler: "fifo" | "edf" }) {
  if (tab === "graph") return <ResourceGraph snap={snap} />;
  return <HeapView snap={snap} policy={cfgScheduler} />;
}

/* ================= RESOURCE ALLOCATION GRAPH + COFFMAN ================= */

function ResourceGraph({ snap }: { snap: Snapshot }) {
  const n = snap.coders.length;
  const W = 560;
  const H = 190;
  const tx = (i: number) => 90 + (i * (W - 260)) / Math.max(1, n - 1 || 1);
  const threadY = 46;
  const dongleY = 140;
  const dx = (i: number) => 90 + ((i + 0.5) * (W - 260)) / Math.max(1, n);
  const edges = waitEdges(snap);
  const conds = coffman(snap, snap.deadlockSince >= 0);
  const deadlocked = new Set(snap.deadlock);

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div>
        <div className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">RESOURCE ALLOCATION GRAPH — live</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
          <defs>
            <marker id="gAssign" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M0.5 0.5 7 4 0.5 7.5Z" fill="#ff5c5c" />
            </marker>
            <marker id="gRequest" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M0.5 0.5 7 4 0.5 7.5Z" fill="#ffc53d" />
            </marker>
          </defs>

          {/* assignment edges: dongle → holder (solid red) */}
          {snap.dongles.filter((d) => d.holder >= 0).map((d) => (
            <motion.line
              key={`a-${d.idx}`}
              x1={dx(d.idx)} y1={dongleY - 12} x2={tx(d.holder)} y2={threadY + 14}
              stroke="#ff5c5c" strokeWidth="1.8" markerEnd="url(#gAssign)"
              initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ duration: 0.5 }}
            />
          ))}

          {/* request edges: thread → dongle (dashed amber) */}
          {snap.coders.filter((c) => c.wanting >= 0 && !c.held.includes(c.wanting)).map((c) => {
            const hot = deadlocked.has(c.id);
            return (
              <motion.line
                key={`r-${c.id}`}
                x1={tx(c.id)} y1={threadY + 14} x2={dx(c.wanting)} y2={dongleY - 12}
                stroke={hot ? "#ff5c5c" : "#ffc53d"} strokeWidth="1.4" strokeDasharray="4 4"
                markerEnd={hot ? "url(#gAssign)" : "url(#gRequest)"}
                initial={{ opacity: 0 }}
                animate={hot ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.75 }}
                transition={hot ? { duration: 0.8, repeat: Infinity } : { duration: 0.5 }}
              />
            );
          })}

          {/* thread nodes */}
          {snap.coders.map((c) => (
            <g key={`t-${c.id}`} transform={`translate(${tx(c.id)},${threadY})`}>
              <circle r={13} fill="#0e161e" stroke={deadlocked.has(c.id) ? "#ff5c5c" : identColor(c.id)} strokeWidth={deadlocked.has(c.id) ? 2.4 : 1.6} />
              <text y={3.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Space Grotesk" fill={deadlocked.has(c.id) ? "#ff5c5c" : identColor(c.id)}>
                T{c.id + 1}
              </text>
              <text y={-19} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono" fill="#5c7488">{c.name}</text>
            </g>
          ))}

          {/* dongle nodes */}
          {snap.dongles.map((d) => (
            <g key={`d-${d.idx}`} transform={`translate(${dx(d.idx)},${dongleY})`}>
              <rect x={-11} y={-11} width={22} height={22} fill="#0e161e" stroke={d.holder >= 0 ? "#ff5c5c" : "#4cc9f0"} strokeWidth="1.6" />
              <text y={3.5} textAnchor="middle" fontSize="8" fontFamily="IBM Plex Mono" fill={d.holder >= 0 ? "#ff5c5c" : "#4cc9f0"}>
                D{d.idx}
              </text>
            </g>
          ))}
        </svg>
        <div className="flex gap-4 text-[8px] tracking-wider text-ink-400">
          <span><span className="text-[#ff5c5c]">━▶</span> assignment (dongle → holder)</span>
          <span><span className="text-[#ffc53d]">╌╌▶</span> request (thread → wanted dongle)</span>
          <span className="text-[#ff5c5c]">red cycle = deadlock</span>
        </div>
      </div>

      {/* coffman conditions */}
      <div>
        <div className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">COFFMAN CONDITIONS — all four ⇒ deadlock</div>
        <div className="mt-2 space-y-1.5">
          {conds.map((cnd) => (
            <div key={cnd.name} className="flex items-start gap-2 border border-ink-700 bg-ink-950/60 px-2.5 py-1.5">
              <motion.span
                key={String(cnd.holds)}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="mt-[1px] font-mono text-[11px] font-bold"
                style={{ color: cnd.holds ? "#ff8a3d" : "#3ddc97" }}
              >
                {cnd.holds ? "✔" : "✘"}
              </motion.span>
              <div>
                <div className="text-[9.5px] font-semibold text-ink-100">{cnd.name}</div>
                <div className="text-[8px] leading-snug text-ink-400">{cnd.note}</div>
              </div>
            </div>
          ))}
        </div>
        <div
          className="mt-2 border px-2.5 py-2 text-[9px] font-semibold tracking-[0.14em]"
          style={
            snap.deadlock.length > 1
              ? { borderColor: "#ff5c5c77", background: "rgba(255,92,92,0.1)", color: "#ff5c5c" }
              : { borderColor: "#3ddc9755", background: "rgba(61,220,151,0.06)", color: "#3ddc97" }
          }
        >
          {snap.deadlock.length > 1 ? `⦿ DEADLOCK ACTIVE — cycle on threads ${snap.deadlock.map((d) => "T" + (d + 1)).join(", ")}` : "NO CYCLE — the graph is still a DAG"}
        </div>
      </div>
    </div>
  );
}

/* ================= EDF BINARY HEAP / FIFO QUEUE ================= */

function HeapView({ snap, policy }: { snap: Snapshot; policy: "fifo" | "edf" }) {
  const prev = snap.heapView;
  const ops = heapOps(prevSnapHeap.current, prev);
  prevSnapHeap.current = prev;

  if (policy === "fifo") {
    return (
      <div className="p-3">
        <div className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">FIFO — plain arrival queue (no heap needed)</div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {snap.fifoView.length === 0 && <span className="text-[9px] text-ink-400">— queue empty —</span>}
          {snap.fifoView.map((id, i) => (
            <motion.span key={id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="flex items-center gap-1.5 border px-2 py-1 text-[9.5px]"
              style={{ borderColor: `${identColor(id)}55`, color: identColor(id), background: i === 0 ? `${identColor(id)}12` : "transparent" }}>
              {i + 1}. {snap.coders[id].name}
            </motion.span>
          ))}
        </div>
        <p className="mt-2 text-[8.5px] text-ink-400">
          Insert = push at the tail · grant = pop the head. Simple, but the head never looks at deadlines — switch SCHED to EDF to see the heap appear.
        </p>
      </div>
    );
  }

  const heap = snap.heapView;
  const opBadge = ops[0];
  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">EDF MIN-HEAP — keyed by deadline</span>
        {opBadge && (
          <motion.span key={`${opBadge.kind}-${opBadge.id}-${snap.tick}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="border px-1.5 py-[2px] text-[8px] tracking-[0.14em]"
            style={
              opBadge.kind === "insert" ? { borderColor: "#3ddc9766", color: "#3ddc97" }
              : opBadge.kind === "extract" ? { borderColor: "#ff5c5c66", color: "#ff5c5c" }
              : { borderColor: "#ffc53d66", color: "#ffc53d" }
            }>
            {opBadge.kind === "insert" ? "▲ INSERT + sift-up" : opBadge.kind === "extract" ? "▼ EXTRACT-MIN + sift-down" : "◆ SIFT (re-heapify)"} — {opBadge.id >= 0 ? snap.coders[opBadge.id]?.name : ""}
          </motion.span>
        )}
        <span className="ml-auto text-[8px] text-ink-400">tie-break: equal deadlines ⇒ lower thread id wins (stable)</span>
      </div>

      <div className="relative mt-2 h-[150px] border border-ink-600 bg-ink-950/50 p-2">
        {heap.length === 0 && <div className="grid h-full place-items-center text-[9px] text-ink-400">— heap empty: no waiting threads —</div>}
        {heap.map((node, i) => {
          const level = Math.floor(Math.log2(i + 1));
          const slot = i - (2 ** level - 1);
          const count = 2 ** level;
          const left = ((slot + 0.5) / count) * 100;
          const top = 12 + level * 44;
          const parent = i > 0 ? Math.floor((i - 1) / 2) : -1;
          const pLeft = parent >= 0 ? ((parent - (2 ** Math.floor(Math.log2(parent + 1))) + 0.5) / 2 ** Math.floor(Math.log2(parent + 1))) * 100 : 0;
          const pTop = parent >= 0 ? 12 + Math.floor(Math.log2(parent + 1)) * 44 : 0;
          const msLeft = Math.max(0, node.deadline - snap.t);
          const urgent = msLeft < 400;
          const isRoot = i === 0;
          const flash = opBadge && opBadge.id === node.id;
          return (
            <div key={node.id}>
              {parent >= 0 && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
                  <line x1={`${pLeft}%`} y1={pTop + 30} x2={`${left}%`} y2={top} stroke="#243644" strokeWidth="1" />
                </svg>
              )}
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22, duration: 0.55 }}
                className="absolute w-[74px] -translate-x-1/2 border px-1 py-1 text-center"
                style={{
                  left: `${left}%`,
                  top,
                  borderColor: isRoot ? "#3ddc9788" : urgent ? "#ff5c5c77" : `${identColor(node.id)}44`,
                  background: isRoot ? "rgba(61,220,151,0.1)" : flash ? "rgba(255,197,61,0.12)" : "#0b1117",
                  boxShadow: isRoot ? "0 0 14px rgba(61,220,151,0.25)" : undefined,
                }}
              >
                <div className="text-[8.5px] font-semibold" style={{ color: identColor(node.id) }}>{snap.coders[node.id].name}</div>
                <div className="font-mono text-[7.5px]" style={{ color: urgent ? "#ff5c5c" : "#8ca3b5" }}>
                  {(msLeft / 1000).toFixed(1)}s {isRoot && "◂ min"}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[8.5px] text-ink-400">
        Every new waiter is <span className="text-[#3ddc97]">inserted and sifted up</span>; every grant <span className="text-[#ff5c5c]">extracts the root and sifts down</span>.
        The root is always the coder closest to burnout — that single invariant is the entire EDF policy.
      </p>
    </div>
  );
}

/* mutable ref without importing React (module-local) */
const prevSnapHeap: { current: { id: number; deadline: number }[] | undefined } = { current: undefined };
