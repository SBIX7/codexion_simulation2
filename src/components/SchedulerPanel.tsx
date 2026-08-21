import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { SchedulerPolicy, Snapshot } from "../sim/engine";
import { identColor } from "./ui";

export default function SchedulerPanel({
  snap,
  policy,
}: {
  snap: Snapshot;
  policy: SchedulerPolicy;
}) {
  const waiting = snap.coders.filter((c) => c.phase === "wait");
  const starving = waiting.filter((c) => snap.t - c.waitSince > 2500);
  const divRate = snap.grants ? Math.round((snap.divergences / snap.grants) * 100) : 0;

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-2.5">
        {/* FIFO queue */}
        <div className="border border-ink-700 bg-ink-950/60 p-2" style={policy === "fifo" ? { borderColor: "#4cc9f066" } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] tracking-[0.2em]" style={{ color: policy === "fifo" ? "#4cc9f0" : "#5c7488" }}>
              FIFO QUEUE
            </span>
            {policy === "fifo" && <ActiveBadge />}
          </div>
          <div className="mt-1.5 space-y-1">
            {snap.fifoView.length === 0 && <Empty />}
            {snap.fifoView.map((id, i) => {
              const c = snap.coders[id];
              const waited = ((snap.t - c.waitSince) / 1000).toFixed(1);
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 text-[9px]"
                >
                  <span className="w-3 text-right text-ink-400">{i + 1}</span>
                  <span className="h-3 w-1" style={{ background: identColor(id) }} />
                  <span style={{ color: identColor(id) }}>{c.name}</span>
                  <span className="ml-auto text-ink-400">{waited}s</span>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[7.5px] text-ink-400">grant order = arrival order</div>
        </div>

        {/* EDF heap */}
        <div className="border border-ink-700 bg-ink-950/60 p-2" style={policy === "edf" ? { borderColor: "#3ddc9766" } : undefined}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] tracking-[0.2em]" style={{ color: policy === "edf" ? "#3ddc97" : "#5c7488" }}>
              EDF MIN-HEAP
            </span>
            {policy === "edf" && <ActiveBadge color="#3ddc97" />}
          </div>
          <div className="relative mt-1.5 h-[76px]">
            {snap.heapView.length === 0 && <Empty />}
            {snap.heapView.map((node, i) => {
              const level = Math.floor(Math.log2(i + 1));
              const slot = i - (2 ** level - 1);
              const count = 2 ** level;
              const left = ((slot + 0.5) / count) * 100;
              const msLeft = Math.max(0, node.deadline - snap.t);
              const urgent = msLeft < 400;
              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 26 }}
                  className="absolute -translate-x-1/2 border px-1 py-0.5 text-center text-[7.5px] leading-tight"
                  style={{
                    left: `${left}%`,
                    top: level * 25,
                    borderColor: urgent ? "#ff5c5c88" : `${identColor(node.id)}55`,
                    background: i === 0 ? `${identColor(node.id)}1a` : "#0b1117",
                    color: identColor(node.id),
                  }}
                  title={`${snap.coders[node.id].name} — deadline in ${Math.round(msLeft)}ms`}
                >
                  {snap.coders[node.id].name}
                  <br />
                  <span style={{ color: urgent ? "#ff5c5c" : "#8ca3b5" }}>{(msLeft / 1000).toFixed(1)}s</span>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-1 text-[7.5px] text-ink-400">root = earliest deadline wins</div>
        </div>
      </div>

      {/* shadow comparison of the last grant decision */}
      <div className="mt-2.5 border border-ink-700 bg-ink-950/70 px-2.5 py-2">
        <div className="text-[8px] tracking-[0.22em] text-ink-400">LAST GRANT DECISION · SHADOW COMPARE</div>
        {snap.lastGrant ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px]">
            <span className="text-ink-300">
              FIFO would pick{" "}
              <b style={{ color: snap.lastGrant.fifo >= 0 ? identColor(snap.lastGrant.fifo) : "#5c7488" }}>
                {snap.lastGrant.fifo >= 0 ? snap.coders[snap.lastGrant.fifo].name : "—"}
              </b>
            </span>
            <span className="text-ink-300">
              EDF would pick{" "}
              <b style={{ color: snap.lastGrant.edf >= 0 ? identColor(snap.lastGrant.edf) : "#5c7488" }}>
                {snap.lastGrant.edf >= 0 ? snap.coders[snap.lastGrant.edf].name : "—"}
              </b>
            </span>
            {snap.lastGrant.fifo !== snap.lastGrant.edf && snap.lastGrant.fifo >= 0 && snap.lastGrant.edf >= 0 && (
              <motion.span
                key={snap.grants}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[8.5px] tracking-wider text-[#ffc53d]"
              >
                ▲ POLICIES DIVERGE
              </motion.span>
            )}
          </div>
        ) : (
          <div className="mt-1 text-[9.5px] text-ink-400">no grants yet — both policies agree while queues are empty</div>
        )}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="grants" value={snap.grants} />
          <MiniStat label="diverged" value={snap.divergences} color={snap.divergences ? "#ffc53d" : undefined} />
          <MiniStat label="div rate" value={`${divRate}%`} />
        </div>
      </div>

      {/* starvation watch */}
      <div className="mt-2.5">
        <div className="text-[8px] tracking-[0.22em] text-ink-400">STARVATION WATCH · waited &gt; 2.5 s</div>
        {starving.length === 0 ? (
          <div className="mt-1 text-[9.5px] text-[#3ddc97]">✓ no thread beyond the starvation threshold</div>
        ) : (
          <div className="mt-1 space-y-1">
            {starving.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[9.5px]">
                <svg width="9" height="9" viewBox="0 0 10 10">
                  <path d="M5 1 9.3 8.6H0.7Z" fill="none" stroke="#ff5c5c" strokeWidth="1.3" />
                </svg>
                <span style={{ color: identColor(c.id) }}>{c.name}</span>
                <span className="text-ink-400">waited {((snap.t - c.waitSince) / 1000).toFixed(1)}s for D{c.wanting}</span>
                <span className="ml-auto text-[8px] tracking-wider text-[#ff5c5c]">STARVING</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ActiveBadge = ({ color = "#4cc9f0" }: { color?: string }) => (
  <span className="flex items-center gap-1 text-[7.5px] tracking-[0.18em]" style={{ color }}>
    <i className="led-on h-1 w-1 rounded-full" style={{ background: color, color }} />
    ACTIVE
  </span>
);

const Empty = () => <div className="py-1.5 text-center text-[9px] text-ink-400">— empty —</div>;

const MiniStat = ({ label, value, color = "#e8f0f6" }: { label: string; value: ReactNode; color?: string }) => (
  <div className="border border-ink-700 bg-ink-900 px-1 py-1">
    <div className="font-display text-[13px] font-semibold" style={{ color }}>{value}</div>
    <div className="text-[7.5px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
  </div>
);
