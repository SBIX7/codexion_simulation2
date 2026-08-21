import { motion, AnimatePresence } from "framer-motion";
import type { Snapshot } from "../sim/engine";
import { identColor } from "./ui";

export default function SyncPanel({ snap }: { snap: Snapshot }) {
  const owner = snap.mutexOwner >= 0 ? snap.coders[snap.mutexOwner] : null;
  const spuriousNow = snap.events.some((e) => e.type === "spurious");

  return (
    <div className="space-y-3 p-3">
      {/* mutex token */}
      <div className="flex items-stretch gap-3">
        <div
          className="relative flex w-[104px] flex-col items-center justify-center border px-2 py-2"
          style={{
            borderColor: owner ? `${identColor(owner.id)}66` : "#243644",
            background: owner ? `${identColor(owner.id)}0f` : "#0b1117",
          }}
        >
          <span className="text-[8px] tracking-[0.22em] text-ink-400">MUTEX</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={owner ? owner.id : "free"}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.16 }}
              className="font-display text-[13px] font-semibold"
              style={{ color: owner ? identColor(owner.id) : "#5c7488" }}
            >
              {owner ? owner.name : "FREE"}
            </motion.span>
          </AnimatePresence>
          <span className="mt-0.5 text-[7.5px] text-ink-400">
            {owner ? "owns critical section" : "pthread_mutex_unlock'd"}
          </span>
          {owner && (
            <motion.span
              layoutId="mutex-token"
              className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full"
              style={{ background: identColor(owner.id), boxShadow: `0 0 8px ${identColor(owner.id)}` }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[8px] tracking-[0.22em] text-ink-400">LOCK WAIT QUEUE</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {snap.mutexQueue.length === 0 && (
              <span className="text-[9.5px] text-ink-400">— uncontended this tick</span>
            )}
            {snap.mutexQueue.map((id, i) => (
              <motion.span
                key={id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="border px-1.5 py-0.5 text-[9px]"
                style={{ borderColor: `${identColor(id)}55`, color: identColor(id) }}
              >
                {i + 1}·{snap.coders[id].name}
              </motion.span>
            ))}
          </div>
          <p className="mt-2 text-[8.5px] leading-relaxed text-ink-400">
            One token, one owner. Every grant decision below is serialized through this mutex — the queue
            shows who is blocked <em className="text-ink-300">entering</em> the monitor, not waiting on a dongle.
          </p>
        </div>
      </div>

      {/* condition variable */}
      <div
        className="border p-2.5 transition-colors"
        style={{ borderColor: spuriousNow ? "#ff8a3d88" : "#1a2733" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[8px] tracking-[0.22em] text-ink-400">COND VAR · dongle_free</span>
          <span className="text-[8px] text-ink-400">{snap.condQueue.length} sleeping</span>
        </div>
        <div className="mt-2 space-y-1">
          {snap.condQueue.length === 0 && (
            <div className="py-1 text-center text-[9.5px] text-ink-400">— queue empty, all predicates true —</div>
          )}
          {snap.condQueue.map((id, i) => {
            const c = snap.coders[id];
            return (
              <div key={`${id}-${i}`} className="flex items-center gap-2 text-[9.5px]">
                <span className="w-3 text-right text-ink-400">{i + 1}</span>
                <span className="h-[1px] w-3 bg-ink-600" />
                <span style={{ color: identColor(id) }}>{c.name}</span>
                <span className="text-ink-400">while(!free(D{c.wanting}))</span>
                <motion.span
                  className="ml-auto text-[8px] tracking-wider text-[#ffc53d]"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  zZ
                </motion.span>
              </div>
            );
          })}
        </div>
      </div>

      {/* last monitor operation */}
      <div className="border border-ink-700 bg-ink-950/70 px-2.5 py-2">
        <div className="text-[8px] tracking-[0.22em] text-ink-400">LAST MONITOR OP</div>
        <AnimatePresence mode="wait">
          <motion.div
            key={snap.lastOp + snap.t}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-1 text-[10px] leading-snug text-[#4cc9f0]"
          >
            <span className="text-ink-400">» </span>
            {snap.lastOp}
          </motion.div>
        </AnimatePresence>
      </div>

      {spuriousNow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border border-[#ff8a3d66] bg-[#ff8a3d12] px-2.5 py-1.5 text-[9px] leading-relaxed text-[#ff8a3d]"
        >
          ⚠ SPURIOUS WAKEUP OBSERVED — the woken thread re-ran its while() predicate and went straight
          back to sleep. This is exactly why condition waits need while(), never if().
        </motion.div>
      )}
    </div>
  );
}
