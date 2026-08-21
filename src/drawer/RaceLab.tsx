import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { identColor } from "../components/ui";

/* classic counter++ race: LOAD / INC / STORE at register granularity.
   Left: no lock → interleaving loses an update. Right: mutex → atomic. */

type Side = "a" | "b";
interface Step {
  side: Side;
  actor: 0 | 1;
  op: "LOCK" | "LOAD" | "INC" | "STORE" | "UNLOCK" | "BLOCK";
  reg: number | null;
  mem: number;
  note: string;
  lost?: boolean;
}

const SCRIPT: Step[] = [
  // ---- unprotected ----
  { side: "a", actor: 0, op: "LOAD", reg: 0, mem: 0, note: "T1 copies counter into r1" },
  { side: "a", actor: 1, op: "LOAD", reg: 0, mem: 0, note: "T2 reads the SAME 0 before T1 writes" },
  { side: "a", actor: 0, op: "INC", reg: 1, mem: 0, note: "r1 = r1 + 1 (private register)" },
  { side: "a", actor: 1, op: "INC", reg: 1, mem: 0, note: "r2 = r2 + 1 — both computed from 0" },
  { side: "a", actor: 0, op: "STORE", reg: 1, mem: 1, note: "counter = r1 → 1" },
  { side: "a", actor: 1, op: "STORE", reg: 1, mem: 1, note: "counter = r2 → 1. T1's update is LOST.", lost: true },
  // ---- mutex protected ----
  { side: "b", actor: 0, op: "LOCK", reg: null, mem: 0, note: "T1 takes counter_mutex" },
  { side: "b", actor: 1, op: "BLOCK", reg: null, mem: 0, note: "T2 tries to lock → parks in the wait queue" },
  { side: "b", actor: 0, op: "LOAD", reg: 0, mem: 0, note: "r1 = 0, inside the critical section" },
  { side: "b", actor: 0, op: "INC", reg: 1, mem: 0, note: "r1 = 1" },
  { side: "b", actor: 0, op: "STORE", reg: 1, mem: 1, note: "counter = 1" },
  { side: "b", actor: 0, op: "UNLOCK", reg: null, mem: 1, note: "unlock → T2 is woken and acquires" },
  { side: "b", actor: 1, op: "LOAD", reg: 1, mem: 1, note: "T2 now reads 1 — it SEES T1's write" },
  { side: "b", actor: 1, op: "INC", reg: 2, mem: 1, note: "r2 = 2" },
  { side: "b", actor: 1, op: "STORE", reg: 2, mem: 2, note: "counter = 2 ✓ both increments survive" },
  { side: "b", actor: 1, op: "UNLOCK", reg: null, mem: 2, note: "critical section done" },
];

const OP_COLOR: Record<Step["op"], string> = {
  LOAD: "#4cc9f0", INC: "#ffc53d", STORE: "#ff8a3d",
  LOCK: "#3ddc97", UNLOCK: "#3ddc97", BLOCK: "#ff5c5c",
};

export default function RaceLab() {
  const [pos, setPos] = useState(-1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPos((p) => {
        if (p >= SCRIPT.length - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, 950);
    return () => clearInterval(id);
  }, [playing]);

  const stateOf = (side: Side) => {
    let mem = 0;
    const regs: (number | null)[] = [null, null];
    let lockedBy: number | null = null;
    let blocked: number | null = null;
    let lastActive = -1;
    let lost = false;
    for (let i = 0; i <= pos; i++) {
      const s = SCRIPT[i];
      if (s.side !== side) continue;
      lastActive = i;
      mem = s.mem;
      if (s.reg !== null) regs[s.actor] = s.reg;
      if (s.op === "LOCK") { lockedBy = s.actor; blocked = null; }
      if (s.op === "UNLOCK") lockedBy = null;
      if (s.op === "BLOCK") blocked = s.actor;
      if (s.lost) lost = true;
    }
    return { mem, regs, lockedBy, blocked, lastActive, lost };
  };

  const a = stateOf("a");
  const b = stateOf("b");

  return (
    <div className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[9px] font-semibold tracking-[0.2em] text-ink-100">RACE LAB — counter++ is three instructions, not one</span>
        <div className="ml-auto flex items-center gap-1">
          <LabBtn onClick={() => { setPos(-1); setPlaying(false); }} label="reset">⟲ RESET</LabBtn>
          <LabBtn onClick={() => { setPlaying(false); setPos((p) => Math.min(SCRIPT.length - 1, p + 1)); }} label="step">STEP ▸</LabBtn>
          <LabBtn primary onClick={() => { if (pos >= SCRIPT.length - 1) setPos(-1); setPlaying((p) => !p); }} label="play/pause">
            {playing ? "❚❚ PAUSE" : "▶ PLAY"}
          </LabBtn>
        </div>
      </div>

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
        <SidePanel title="WITHOUT MUTEX — the interleaving" data={a} side="a" pos={pos} expected={2} tone="#ff5c5c" />
        <SidePanel title="WITH pthread_mutex — atomic" data={b} side="b" pos={pos} expected={2} tone="#3ddc97" />
      </div>

      <div className="mt-2.5 border border-ink-700 bg-ink-950/60 px-3 py-2 text-[9.5px] leading-relaxed text-ink-300">
        {pos < 0 && "Press PLAY (or STEP) — both sides run the same two threads; only the lock differs."}
        {pos >= 0 && SCRIPT[pos] && (
          <>
            <span style={{ color: OP_COLOR[SCRIPT[pos].op] }} className="font-semibold">{SCRIPT[pos].op}</span>
            {" — "}{SCRIPT[pos].note}
            {SCRIPT[pos].lost && <span className="ml-1 font-semibold text-[#ff5c5c]">⚠ lost update: expected 2, actual 1.</span>}
          </>
        )}
        {pos >= SCRIPT.length - 1 && (
          <div className="mt-1 text-[#3ddc97]">✓ finished: the mutex serialized the two critical sections, so no read stepped on a write.</div>
        )}
      </div>
    </div>
  );
}

interface SideState {
  mem: number; regs: (number | null)[]; lockedBy: number | null;
  blocked: number | null; lastActive: number; lost: boolean;
}

function SidePanel({
  title, data, side, pos, expected, tone,
}: {
  title: string;
  data: SideState;
  side: Side;
  pos: number;
  expected: number;
  tone: string;
}) {
  const steps = SCRIPT.map((s, i) => ({ s, i })).filter(({ s }) => s.side === side);
  const mismatch = data.lost && data.mem < expected;
  return (
    <div className="border border-ink-700 bg-ink-950/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold tracking-[0.16em]" style={{ color: tone }}>{title}</span>
        {data.lockedBy !== null && (
          <span className="border border-[#3ddc9766] bg-[#3ddc9710] px-1.5 py-[2px] text-[7.5px] tracking-wider text-[#3ddc97]">
            🔒 T{data.lockedBy + 1} in critical section
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2.5">
        {/* program listing */}
        <div className="flex-1 space-y-[3px]">
          {steps.map(({ s, i }) => {
            const active = i === data.lastActive;
            const done = i < data.lastActive;
            return (
              <motion.div
                key={i}
                animate={active ? { x: [0, 3, 0], background: ["rgba(76,201,240,0)", "rgba(76,201,240,0.16)", "rgba(76,201,240,0.05)"] } : {}}
                transition={{ duration: 0.55 }}
                className="flex items-center gap-1.5 border-l-2 px-1.5 py-[2.5px] font-mono text-[8.5px]"
                style={{ borderColor: active ? OP_COLOR[s.op] : "#243644", color: done ? "#5c7488" : active ? "#e8f0f6" : "#8ca3b5" }}
              >
                <span className="w-5 shrink-0 font-bold" style={{ color: identColor(s.actor) }}>T{s.actor + 1}</span>
                <span style={{ color: OP_COLOR[s.op] }}>{s.op}</span>
                {s.reg !== null && <span className="text-ink-400">r{s.actor + 1} = {s.reg}</span>}
              </motion.div>
            );
          })}
        </div>
        {/* registers + shared memory */}
        <div className="w-[104px] shrink-0 space-y-1.5">
          {[0, 1].map((t) => (
            <div key={t} className="border border-ink-700 px-1.5 py-1 text-center">
              <div className="text-[7px] tracking-[0.16em]" style={{ color: identColor(t) }}>REG r{t + 1}{data.blocked === t ? " · BLOCKED" : ""}</div>
              <div className="font-display text-[14px] font-semibold tabular-nums text-ink-100">{data.regs[t] ?? "—"}</div>
            </div>
          ))}
          <div className="border px-1.5 py-1.5 text-center" style={{ borderColor: mismatch ? "#ff5c5c88" : `${tone}55`, background: mismatch ? "rgba(255,92,92,0.1)" : `${tone}0a` }}>
            <div className="text-[7px] tracking-[0.16em] text-ink-400">SHARED MEM counter</div>
            <motion.div key={data.mem} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}
              className="font-display text-[20px] font-bold tabular-nums" style={{ color: mismatch ? "#ff5c5c" : tone }}>
              {data.mem}
            </motion.div>
            <div className="text-[7px] text-ink-400">expected {expected}</div>
          </div>
        </div>
      </div>
      {mismatch && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
          className="mt-1.5 border border-[#ff5c5c77] bg-[#ff5c5c12] px-2 py-1 text-[8.5px] font-semibold tracking-wider text-[#ff5c5c]">
          ⚠ LOST UPDATE — both threads stored 1, one increment vanished
        </motion.div>
      )}
    </div>
  );
}

function LabBtn({ onClick, children, label, primary }: { onClick: () => void; children: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="border px-2.5 py-1 text-[9px] font-semibold tracking-[0.14em] transition-all active:translate-y-px"
      style={primary ? { borderColor: "#3ddc9777", color: "#3ddc97", background: "rgba(61,220,151,0.1)" } : { borderColor: "#243644", color: "#8ca3b5" }}
    >
      {children}
    </button>
  );
}
