/* ============================================================
   Derivation layer — pure functions over engine snapshots.
   The engine is untouched; everything here is read-only analysis
   used by the presentation layer.
   ============================================================ */
import type { CoderSnap, HeapNode, SimEvent, Snapshot } from "./engine";

export const fmtT = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
export const fmtMs = (ms: number) => `${Math.round(ms)}ms`;

/* ---------- subject-format log stream ----------
   <ms> X has taken a dongle
   <ms> X is compiling / debugging / refactoring
   <ms> X burned out                                   */
export function subjectLine(e: SimEvent, name: (id: number) => string): string | null {
  switch (e.type) {
    case "acquire": return e.msg.includes("both") ? null : `${e.t} ${name(e.coder)} has taken a dongle`;
    case "compile-start": return `${e.t} ${name(e.coder)} is compiling`;
    case "burnout": return `${e.t} ${name(e.coder)} burned out`;
    case "wait": return e.msg.includes("holds") ? null : `${e.t} ${name(e.coder)} waits for a dongle`;
    case "release": return `${e.t} ${name(e.coder)} released a dongle`;
    case "deadlock": return `${e.t} DEADLOCK: ${e.msg}`;
    case "rollback": return `${e.t} ${name(e.coder)} was rolled back by the breaker`;
    case "spurious": return `${e.t} ${name(e.coder)} woke spuriously`;
    case "miss": return `${e.t} ${name(e.coder)} missed a deadline`;
    default: return null;
  }
}

/* richer internal line for verbose mode */
export function verboseLine(e: SimEvent): string {
  return `[t=${e.t}ms] ${e.type.toUpperCase().padEnd(14)} ${e.msg}`;
}

/* ---------- program counter per thread (under-the-hood) ---------- */
export function pcFor(c: CoderSnap): { fn: string; line: number } {
  switch (c.phase) {
    case "think":
      return c.thinkKind === "debug" ? { fn: "debug.c", line: 88 } : { fn: "refactor.c", line: 42 };
    case "wait":
      return c.wantsSecond ? { fn: "dongle.c", line: 57 } : { fn: "dongle.c", line: 31 };
    case "compile":
      return { fn: "compile.c", line: 23 };
    case "cooldown":
      return { fn: "break.c", line: 9 };
    case "burnout":
      return { fn: "monitor.c", line: 14 };
  }
}

export const pcNote = (c: CoderSnap) =>
  c.phase === "wait"
    ? "pthread_cond_wait() — atomically released the mutex and slept"
    : c.phase === "compile"
      ? "inside the critical section — holds both dongles"
      : c.phase === "burnout"
        ? "stack unwound by the monitor thread (rescue)"
        : "running userspace code on its private stack";

/* ---------- wait-for edges (resource allocation graph) ---------- */
export interface WaitEdge { from: number; to: number; dongle: number }
export function waitEdges(snap: Snapshot): WaitEdge[] {
  const out: WaitEdge[] = [];
  for (const c of snap.coders) {
    if (c.phase === "wait" && c.wanting >= 0) {
      const h = snap.dongles[c.wanting].holder;
      if (h >= 0 && h !== c.id) out.push({ from: c.id, to: h, dongle: c.wanting });
    }
  }
  return out;
}

/* ---------- Coffman conditions, evaluated live ---------- */
export function coffman(snap: Snapshot, breakerOn: boolean) {
  const holdAndWait = snap.coders.some((c) => c.held.length > 0 && c.wanting >= 0 && !c.held.includes(c.wanting));
  const circular = snap.deadlock.length > 1;
  return [
    { name: "Mutual exclusion", holds: true, note: "a dongle is held by at most one coder" },
    { name: "Hold and wait", holds: holdAndWait, note: "someone holds a dongle while requesting another" },
    { name: "No preemption", holds: !breakerOn, note: breakerOn ? "breaker can preempt — condition BROKEN on purpose" : "nothing is ever forcibly taken" },
    { name: "Circular wait", holds: circular, note: circular ? "cycle in the wait-for graph" : "no cycle in the wait-for graph" },
  ];
}

/* ---------- heap operations between snapshots (EDF internals) ---------- */
export interface HeapOp { kind: "insert" | "extract" | "reorder"; id: number; key: number }
export function heapOps(prev: HeapNode[] | undefined, cur: HeapNode[]): HeapOp[] {
  if (!prev) return [];
  const ops: HeapOp[] = [];
  const pIds = new Set(prev.map((n) => n.id));
  const cIds = new Set(cur.map((n) => n.id));
  for (const n of cur) if (!pIds.has(n.id)) ops.push({ kind: "insert", id: n.id, key: n.deadline });
  for (const n of prev) if (!cIds.has(n.id)) ops.push({ kind: "extract", id: n.id, key: n.deadline });
  if (!ops.length && prev.map((n) => n.id).join() !== cur.map((n) => n.id).join()) {
    ops.push({ kind: "reorder", id: cur[0]?.id ?? -1, key: cur[0]?.deadline ?? 0 });
  }
  return ops;
}

/* ---------- live metrics for the dashboard strip ---------- */
export interface Metrics {
  active: number; waiting: number; blocked: number; compiling: number;
  free: number; held: number; cooling: number;
  compiles: number; misses: number; burnouts: number;
  avgWait: number; maxWait: number; utilization: number;
  grants: number; divergences: number;
  avgDelta: number; maxDelta: number;
}

export function metrics(snap: Snapshot, history: Snapshot[], idx: number): Metrics {
  const waiting = snap.coders.filter((c) => c.phase === "wait");
  const waits = waiting.map((c) => snap.t - c.waitSince);
  // utilization: fraction of dongle-ms that were "held" over the last ~1.5 s
  const win = Math.max(1, Math.min(150, idx + 1));
  let heldSamples = 0;
  let totalSamples = 0;
  for (let i = idx - win + 1; i <= idx; i++) {
    if (i < 0) continue;
    const s = history[i];
    totalSamples += s.dongles.length;
    heldSamples += s.dongles.filter((d) => d.holder >= 0).length;
  }
  const t = (a: number, b: number) => a + b;
  return {
    active: snap.coders.filter((c) => c.phase !== "burnout").length,
    waiting: waiting.length,
    blocked: waiting.filter((c) => c.wantsSecond).length,
    compiling: snap.coders.filter((c) => c.phase === "compile").length,
    free: snap.dongles.filter((d) => d.holder === -1 && snap.t >= d.coolingUntil).length,
    held: snap.dongles.filter((d) => d.holder >= 0).length,
    cooling: snap.dongles.filter((d) => d.holder === -1 && snap.t < d.coolingUntil).length,
    compiles: snap.coders.map((c) => c.compiles).reduce(t, 0),
    misses: snap.coders.map((c) => c.misses).reduce(t, 0),
    burnouts: snap.coders.map((c) => c.burnouts).reduce(t, 0),
    avgWait: waits.length ? waits.reduce(t, 0) / waits.length : 0,
    maxWait: waits.length ? Math.max(...waits) : 0,
    utilization: totalSamples ? heldSamples / totalSamples : 0,
    grants: snap.grants,
    divergences: snap.divergences,
    avgDelta: snap.avgDelta,
    maxDelta: snap.maxDelta,
  };
}

/* ---------- timeline: locate the frame nearest a timestamp ---------- */
export function findIdxByTime(history: Snapshot[], t: number): number {
  let lo = 0, hi = history.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/* ---------- global state summary (timeline hover preview) ---------- */
export function stateSummary(s: Snapshot): string {
  const counts: Record<string, number> = {};
  for (const c of s.coders) counts[c.phase] = (counts[c.phase] ?? 0) + 1;
  const parts = [
    counts.compile ? `${counts.compile} compiling` : null,
    counts.wait ? `${counts.wait} waiting` : null,
    counts.think ? `${counts.think} thinking` : null,
    counts.burnout ? `${counts.burnout} burned out` : null,
  ].filter(Boolean);
  const dl = s.deadlock.length ? " · ⦿ DEADLOCK" : "";
  return (parts.join(" · ") || "idle") + dl;
}

/* ---------- concept catalog (sidebar / focus mode) ---------- */
export type ConceptId =
  | "threads" | "race" | "mutex" | "condvar"
  | "deadlock" | "scheduling" | "burnout" | "cooldown";

export type DrawerTab =
  | "process" | "mutexes" | "condvars" | "racelab" | "graph" | "heap" | "logs";

export interface Concept {
  id: ConceptId;
  label: string;
  color: string;
  def: string;
  why: string;
  primitive: string;
  tab: DrawerTab;
}

export const CONCEPTS: Concept[] = [
  {
    id: "threads", label: "Threads & Process", color: "#4CC9F0", tab: "process",
    def: "One Codexion process owns the code, data and a shared heap. Each coder is a thread with its own private stack and program counter.",
    why: "All dongle structs and queues live in the shared heap — that is precisely why threads can step on each other.",
    primitive: "pthread_create() · pthread_t · one stack per thread",
  },
  {
    id: "race", label: "Race Condition", color: "#FF5C5C", tab: "racelab",
    def: "Two threads read–compute–write the same variable and the result depends on interleaving. One update gets lost.",
    why: "Every shared counter in Codexion (compiles, energy) is a race waiting to happen without a lock.",
    primitive: "counter++ compiles to LOAD / INC / STORE — not atomic",
  },
  {
    id: "mutex", label: "Mutex", color: "#FFC53D", tab: "mutexes",
    def: "A mutex is a token only one thread may hold. Others block in an ordered queue until it is released.",
    why: "The monitor serializes every grant decision with one mutex — that is what makes the log lines never interleave.",
    primitive: "pthread_mutex_lock() / pthread_mutex_unlock()",
  },
  {
    id: "condvar", label: "Condition Variables", color: "#9DB8CC", tab: "condvars",
    def: "cond_wait atomically releases the mutex and sleeps. signal wakes one waiter; broadcast wakes all. while() guards spurious wakeups.",
    why: "Waiting coders sleep on dongle_free instead of spinning; the release→sleep must be atomic or wakeups are lost.",
    primitive: "pthread_cond_wait() · pthread_cond_signal() · pthread_cond_broadcast()",
  },
  {
    id: "deadlock", label: "Deadlock", color: "#FF5C5C", tab: "graph",
    def: "All four Coffman conditions hold at once: mutual exclusion, hold & wait, no preemption, circular wait. Nobody can move.",
    why: "Naïve left-then-right grabbing makes the wait-for graph close into a cycle — the whole table freezes.",
    primitive: "wait-for graph cycle · fix: ordered acquisition, try-lock, or preemption",
  },
  {
    id: "scheduling", label: "FIFO vs EDF", color: "#3DDC97", tab: "heap",
    def: "FIFO serves by arrival order. EDF (Earliest Deadline First) keeps waiters in a binary min-heap keyed by deadline.",
    why: "Under load, FIFO lets urgent coders starve behind relaxed ones; EDF promotes whoever burns out soonest.",
    primitive: "binary min-heap · insert = sift-up · grant = extract-min",
  },
  {
    id: "burnout", label: "Burnout & Monitor", color: "#FF5C5C", tab: "logs",
    def: "deadline = last_compile_start + time_to_burnout. A monitor thread scans all arcs once per tick and must detect zero-energy within 10 ms.",
    why: "Late detection means the coder vanishes mid-compile holding dongles — the monitor is the safety net.",
    primitive: "dedicated monitor thread · one scan per 10 ms tick ⇒ Δ ≤ 10 ms",
  },
  {
    id: "cooldown", label: "Dongle Cooldown", color: "#FF8A3D", tab: "mutexes",
    def: "After release a dongle stays unavailable for X ms. Waiters parked on it must keep sleeping through the cooldown.",
    why: "Cooldown turns a free dongle into a timed trap — long cooldowns + short tempers = cascading burnouts.",
    primitive: "predicate: free(d) = (holder == −1) && now ≥ cooling_until",
  },
];

export const conceptById = (id: ConceptId) => CONCEPTS.find((c) => c.id === id)!;

/* critical event detection for slow-mo + storytelling */
export const CRITICAL_TYPES = new Set(["deadlock", "burnout", "rollback", "miss"]);
