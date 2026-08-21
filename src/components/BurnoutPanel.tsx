import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { Snapshot } from "../sim/engine";
import { identColor } from "./ui";

export default function BurnoutPanel({ snap, enabledInCfg }: { snap: Snapshot; enabledInCfg: boolean }) {
  const risk = (e: number) => (e > 50 ? "#3ddc97" : e > 25 ? "#ffc53d" : "#ff5c5c");

  return (
    <div className="relative overflow-hidden p-3">
      {/* monitor sweep line — one pass per scan cycle */}
      {enabledInCfg && (
        <div className="monitor-sweep pointer-events-none absolute left-0 right-0 h-[2px] bg-[#3ddc9755]" style={{ boxShadow: "0 0 12px rgba(61,220,151,0.45)" }} />
      )}

      {!enabledInCfg ? (
        <div className="py-3 text-center text-[10px] text-ink-400">
          monitor thread disabled in simulation config — energy still drains, but nobody rescues anyone
        </div>
      ) : (
        <>
          {/* precision headline */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <MiniStat label="scans" value={snap.scans} />
            <MiniStat label="rescues" value={snap.detections.length ? snap.coders.reduce((a, c) => a + c.burnouts, 0) : 0} color="#ff8a3d" />
            <MiniStat label="avg Δ" value={`${snap.avgDelta}ms`} color={snap.avgDelta <= 10 ? "#3ddc97" : "#ff5c5c"} />
            <MiniStat label="max Δ" value={`${snap.maxDelta}ms`} color={snap.maxDelta <= 10 ? "#3ddc97" : "#ff5c5c"} />
          </div>
          <div className="mt-1.5 text-center text-[7.5px] tracking-[0.18em] text-ink-400">
            DETECTION GUARANTEE ≤ 10 MS — ONE SWEEP PER TICK
          </div>

          {/* per-coder energy */}
          <div className="mt-2.5 space-y-[5px]">
            {snap.coders.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-[9px]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: risk(c.energy), color: risk(c.energy), boxShadow: c.energy <= 25 ? `0 0 6px ${risk(c.energy)}` : "none" }}
                />
                <span className="w-14 shrink-0" style={{ color: identColor(c.id) }}>{c.name}</span>
                <div className="relative h-[7px] flex-1 border border-ink-700 bg-ink-950">
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    animate={{ width: `${c.energy}%`, background: risk(c.energy) }}
                    transition={{ duration: 0.25, ease: "linear" }}
                  />
                  {/* 25% threshold notch */}
                  <span className="absolute inset-y-0 left-1/4 w-px bg-[#ffc53d66]" />
                </div>
                <span className="w-8 shrink-0 text-right font-mono" style={{ color: risk(c.energy) }}>
                  {Math.round(c.energy)}
                </span>
                <span className="w-12 shrink-0 text-right text-[8px] text-ink-400">
                  {c.phase === "wait" ? `−drain` : c.phase === "burnout" ? "RESCUED" : c.phase === "compile" ? "−slow" : "+regen"}
                </span>
              </div>
            ))}
          </div>

          {/* detection ledger */}
          <div className="mt-2.5 border-t border-ink-700 pt-2">
            <div className="text-[8px] tracking-[0.22em] text-ink-400">DETECTION LEDGER · Δ = detected − actual</div>
            {snap.detections.length === 0 ? (
              <div className="mt-1 text-[9.5px] text-ink-400">no burnouts yet — energy floor not crossed</div>
            ) : (
              <div className="mt-1 space-y-[3px]">
                {snap.detections.map((d, i) => (
                  <motion.div
                    key={`${d.t}-${d.coder}`}
                    initial={i === 0 ? { opacity: 0, x: -6 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-[9px]"
                  >
                    <span className="text-ink-400">t={(d.t / 1000).toFixed(2)}s</span>
                    <span style={{ color: identColor(d.coder) }}>{snap.coders[d.coder]?.name}</span>
                    <span className="ml-auto font-mono" style={{ color: d.delta <= 10 ? "#3ddc97" : "#ff5c5c" }}>
                      Δ{d.delta}ms
                    </span>
                    <span className={`text-[7.5px] tracking-wider ${d.delta <= 10 ? "text-[#3ddc97]" : "text-[#ff5c5c]"}`}>
                      {d.delta <= 10 ? "✓ IN SPEC" : "✗ LATE"}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[8.5px] leading-relaxed text-ink-400">
              Ground truth (energy crossing zero) is stamped by the core; the monitor only observes once per
              10 ms tick — so every Δ must fall inside one scan window. That gap <em className="text-ink-300">is</em> the
              10 ms precision requirement, measured live.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const MiniStat = ({ label, value, color = "#e8f0f6" }: { label: string; value: ReactNode; color?: string }) => (
  <div className="border border-ink-700 bg-ink-900 px-1 py-1">
    <div className="font-display text-[13px] font-semibold leading-tight" style={{ color }}>{value}</div>
    <div className="text-[7px] uppercase tracking-[0.16em] text-ink-400">{label}</div>
  </div>
);
