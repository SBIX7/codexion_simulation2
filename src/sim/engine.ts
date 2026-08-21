/* ============================================================
   CODEXION — deterministic multithreading simulation core
   ------------------------------------------------------------
   Coders (threads) sit around a table of USB dongles (resources).
   To compile, a coder must hold BOTH adjacent dongles. The engine
   is a pure tick-machine: every tick it mutates internal state and
   emits an immutable Snapshot + events into a ring buffer that the
   visualization layer reads. The viz layer never writes back —
   this is what keeps the overlay non-intrusive.
   ============================================================ */

export type Strategy = "naive" | "ordered" | "trylock";
export type SchedulerPolicy = "fifo" | "edf";
export type Phase = "think" | "wait" | "compile" | "cooldown" | "burnout";

export interface SimConfig {
  coderCount: number;
  strategy: Strategy;
  scheduler: SchedulerPolicy;
  spurious: boolean; // simulate spurious wakeups (why while() matters)
  breaker: boolean; // automatic deadlock rollback after 2.5 s
  burnout: boolean; // monitor thread active
  cooldownMs: number; // dongle cooldown after release
  tickMs: number; // simulation resolution (monitor scans once per tick)
  deadlineBase: number; // EDF job deadline window
  deadlineSpread: number;
  energyInit: number;
  drainMul: number; // burnout drain multiplier
  seed: number;
}

export interface SimEvent {
  id: number;
  t: number;
  type: string;
  coder: number; // -1 = system
  dongle: number; // -1 = none
  msg: string;
}

export interface CoderSnap {
  id: number;
  name: string;
  phase: Phase;
  phaseSince: number;
  energy: number;
  held: number[];
  wanting: number; // dongle index or -1
  wantsSecond: boolean;
  deadline: number; // absolute ms, Infinity when idle
  waitSince: number; // -1 when not waiting
  compiles: number;
  misses: number;
  burnouts: number;
  thinkKind: string;
}

export interface DongleSnap {
  idx: number;
  holder: number; // coder id or -1
  coolingUntil: number; // 0 when not cooling
  waiters: number[];
}

export interface Detection {
  t: number;
  coder: number;
  delta: number; // detection latency in ms (must stay <= tickMs)
}

export interface HeapNode {
  id: number;
  deadline: number;
}

export interface Snapshot {
  t: number;
  tick: number;
  coders: CoderSnap[];
  dongles: DongleSnap[];
  mutexOwner: number;
  mutexQueue: number[];
  condQueue: number[];
  lastOp: string;
  fifoView: number[];
  heapView: HeapNode[];
  lastGrant: { fifo: number; edf: number } | null;
  grants: number;
  divergences: number;
  scans: number;
  detections: Detection[];
  avgDelta: number;
  maxDelta: number;
  deadlock: number[];
  deadlockSince: number;
  events: SimEvent[];
}

/* ---------------- internal mutable state ---------------- */

interface ICoder {
  id: number;
  name: string;
  phase: Phase;
  phaseSince: number;
  phaseUntil: number;
  energy: number;
  held: number[];
  wanting: number;
  wantsSecond: boolean;
  waitSince: number;
  deadline: number;
  compiles: number;
  misses: number;
  burnouts: number;
  zeroAt: number; // sim-ms when energy actually crossed 0 (-1 = not)
  thinkKind: "refactor" | "debug";
}

interface IDongle {
  idx: number;
  holder: number;
  coolingUntil: number;
  waiters: number[];
}

export interface Sim {
  cfg: SimConfig;
  t: number;
  tick: number;
  rng: () => number;
  coders: ICoder[];
  dongles: IDongle[];
  mutexOwner: number;
  mutexQueue: number[];
  lastOp: string;
  grants: number;
  divergences: number;
  lastGrant: { fifo: number; edf: number } | null;
  scans: number;
  detections: Detection[];
  deltaSum: number;
  deadlock: number[];
  deadlockSince: number;
  pending: SimEvent[];
  eventSeq: number;
}

export const NAMES = ["Ada", "Linus", "Grace", "Alan", "Edsger", "Barbara", "Donald", "Radia"];

/* ---------------- seeded RNG (reproducible runs) ---------------- */

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- presets (known scenarios for verification) ---------------- */

export type PresetKey = "deadlock" | "starvation" | "burnout" | "free";

export const PRESETS: Record<PresetKey, Omit<SimConfig, "seed">> = {
  deadlock: {
    coderCount: 6, strategy: "naive", scheduler: "fifo", spurious: false,
    breaker: false, burnout: true, cooldownMs: 260, tickMs: 10,
    deadlineBase: 1600, deadlineSpread: 1600, energyInit: 100, drainMul: 1.15,
  },
  starvation: {
    coderCount: 8, strategy: "ordered", scheduler: "fifo", spurious: false,
    breaker: true, burnout: true, cooldownMs: 420, tickMs: 10,
    deadlineBase: 900, deadlineSpread: 700, energyInit: 100, drainMul: 0.8,
  },
  burnout: {
    coderCount: 7, strategy: "naive", scheduler: "edf", spurious: true,
    breaker: true, burnout: true, cooldownMs: 340, tickMs: 10,
    deadlineBase: 1400, deadlineSpread: 1200, energyInit: 72, drainMul: 1.9,
  },
  free: {
    coderCount: 5, strategy: "trylock", scheduler: "edf", spurious: false,
    breaker: true, burnout: true, cooldownMs: 160, tickMs: 10,
    deadlineBase: 1800, deadlineSpread: 1400, energyInit: 100, drainMul: 0.65,
  },
};

export const PRESET_INFO: Record<PresetKey, string> = {
  deadlock: "naive left→right grab · breaker OFF — watch the circular wait form, then see the burnout monitor break it by force-releasing a victim",
  starvation: "8 coders · FIFO grants · tight deadlines — long-waiting coders get starved; flip scheduler to EDF and compare",
  burnout: "high drain · low starting energy · spurious wakeups — verifies the monitor detects burnout within one 10 ms scan",
  free: "try&backoff · EDF · light load — healthy baseline run for comparison",
};

/* ---------------- construction ---------------- */

export function createSim(cfg: SimConfig): Sim {
  const rng = mulberry32(cfg.seed);
  const coders: ICoder[] = Array.from({ length: cfg.coderCount }, (_, i) => ({
    id: i,
    name: NAMES[i % NAMES.length],
    phase: "think",
    phaseSince: 0,
    phaseUntil: 250 + rng() * 1600, // staggered job arrivals
    energy: Math.min(100, cfg.energyInit * (0.85 + rng() * 0.2)),
    held: [],
    wanting: -1,
    wantsSecond: false,
    waitSince: -1,
    deadline: Infinity,
    compiles: 0,
    misses: 0,
    burnouts: 0,
    zeroAt: -1,
    thinkKind: rng() < 0.5 ? "refactor" : "debug",
  }));
  const dongles: IDongle[] = Array.from({ length: cfg.coderCount }, (_, i) => ({
    idx: i, holder: -1, coolingUntil: 0, waiters: [],
  }));
  return {
    cfg, t: 0, tick: 0, rng, coders, dongles,
    mutexOwner: -1, mutexQueue: [], lastOp: "monitor online — scanning every " + cfg.tickMs + " ms",
    grants: 0, divergences: 0, lastGrant: null,
    scans: 0, detections: [], deltaSum: 0,
    deadlock: [], deadlockSince: -1,
    pending: [], eventSeq: 0,
  };
}

/* ---------------- helpers ---------------- */

const firstIdx = (c: ICoder, n: number, s: Strategy) =>
  s === "ordered" ? Math.min(c.id, (c.id + 1) % n) : c.id;
const secondIdx = (c: ICoder, n: number, s: Strategy) =>
  s === "ordered" ? Math.max(c.id, (c.id + 1) % n) : (c.id + 1) % n;

function emit(sim: Sim, type: string, coder: number, dongle: number, msg: string) {
  sim.pending.push({ id: sim.eventSeq++, t: sim.t, type, coder, dongle, msg });
}

const isFree = (sim: Sim, d: IDongle) => d.holder === -1 && sim.t >= d.coolingUntil;

function removeFromWaiters(d: IDongle, id: number) {
  const i = d.waiters.indexOf(id);
  if (i >= 0) d.waiters.splice(i, 1);
}

function grant(sim: Sim, c: ICoder, d: IDongle) {
  d.holder = c.id;
  removeFromWaiters(d, c.id);
  c.held.push(d.idx);
  emit(sim, "acquire", c.id, d.idx, `${c.name} acquired D${d.idx}${c.held.length === 2 ? " (both held)" : ""}`);
}

function releaseDongle(sim: Sim, c: ICoder, idx: number, cool: boolean) {
  const d = sim.dongles[idx];
  d.holder = -1;
  d.coolingUntil = cool ? sim.t + sim.cfg.cooldownMs + sim.rng() * 140 : 0;
  emit(sim, "release", c.id, idx, `${c.name} released D${idx}${cool ? " → cooling" : ""}`);
}

function startJob(sim: Sim, c: ICoder) {
  const n = sim.cfg.coderCount;
  const want = firstIdx(c, n, sim.cfg.strategy);
  c.phase = "wait";
  c.phaseSince = sim.t;
  c.waitSince = sim.t;
  c.wanting = want;
  c.wantsSecond = false;
  c.deadline = sim.t + sim.cfg.deadlineBase + sim.rng() * sim.cfg.deadlineSpread;
  sim.dongles[want].waiters.push(c.id);
  emit(sim, "wait", c.id, want, `${c.name} needs D${want}${sim.cfg.strategy === "naive" ? " (left-first — deadlock-prone)" : ""} · deadline ${Math.round(c.deadline)}ms`);
}

function startCompile(sim: Sim, c: ICoder) {
  c.phase = "compile";
  c.phaseSince = sim.t;
  c.phaseUntil = sim.t + 300 + sim.rng() * 480;
  emit(sim, "compile-start", c.id, -1, `${c.name} compiling with D${c.held[0]}+D${c.held[1]}`);
}

function finishCompile(sim: Sim, c: ICoder) {
  c.compiles++;
  if (sim.t > c.deadline) {
    c.misses++;
    emit(sim, "miss", c.id, -1, `${c.name} missed deadline by ${Math.round(sim.t - c.deadline)}ms`);
  }
  const held = [...c.held];
  for (const idx of held) releaseDongle(sim, c, idx, true);
  emit(sim, "signal", -1, -1, `monitor: broadcast on dongle_free (2 waiters may wake)`);
  sim.lastOp = `release → signal(broadcast); waiters re-check predicate`;
  c.held = [];
  c.wantsSecond = false;
  c.wanting = -1;
  c.waitSince = -1;
  c.deadline = Infinity;
  c.phase = "cooldown";
  c.phaseSince = sim.t;
  c.phaseUntil = sim.t + 140 + sim.rng() * 240;
}

function triggerBurnout(sim: Sim, c: ICoder) {
  const delta = sim.t - c.zeroAt; // exact detection latency
  c.burnouts++;
  sim.detections.push({ t: sim.t, coder: c.id, delta });
  if (sim.detections.length > 60) sim.detections.shift();
  sim.deltaSum += delta;
  emit(sim, "burnout", c.id, -1, `MONITOR: ${c.name} burned out — detected Δ${delta}ms after zero-energy (≤${sim.cfg.tickMs}ms guarantee)`);
  for (const idx of [...c.held]) releaseDongle(sim, c, idx, false);
  for (const d of sim.dongles) removeFromWaiters(d, c.id);
  c.held = [];
  c.wantsSecond = false;
  c.wanting = -1;
  c.waitSince = -1;
  c.deadline = Infinity;
  c.phase = "burnout";
  c.phaseSince = sim.t;
  c.phaseUntil = sim.t + 1300 + sim.rng() * 600;
  sim.lastOp = `monitor: rescue(${c.name}) — forced release, Δ${delta}ms`;
}

/* ---------------- deadlock detection (wait-for graph) ---------------- */

function detectDeadlock(sim: Sim) {
  const n = sim.cfg.coderCount;
  // edge: waiting coder -> holder of the dongle it wants
  const edge = new Map<number, number>();
  for (const c of sim.coders) {
    if (c.phase === "wait" && c.wanting >= 0) {
      const h = sim.dongles[c.wanting].holder;
      if (h >= 0 && h !== c.id) edge.set(c.id, h);
    }
  }
  let cycle: number[] = [];
  const visited = new Set<number>();
  for (const start of edge.keys()) {
    if (visited.has(start)) continue;
    const path: number[] = [];
    const onPath = new Set<number>();
    let cur: number | undefined = start;
    while (cur !== undefined && !visited.has(cur) && !onPath.has(cur)) {
      path.push(cur);
      onPath.add(cur);
      cur = edge.get(cur);
    }
    if (cur !== undefined && onPath.has(cur)) {
      cycle = path.slice(path.indexOf(cur));
      break;
    }
    for (const p of path) visited.add(p);
  }
  if (cycle.length > 1) {
    if (!sim.deadlock.length) {
      sim.deadlock = [...cycle].sort((a, b) => a - b);
      sim.deadlockSince = sim.t;
      const names = sim.deadlock.map((id) => sim.coders[id].name).join(" → ");
      emit(sim, "deadlock", -1, -1, `CIRCULAR WAIT: ${names} → (each holds left, waits right)`);
    }
  } else {
    sim.deadlock = [];
    sim.deadlockSince = -1;
  }
  return n;
}

function breakDeadlock(sim: Sim) {
  // victim = most recently blocked waiter inside the cycle (youngest victim rule)
  const victims = sim.coders.filter((c) => sim.deadlock.includes(c.id) && c.phase === "wait");
  if (!victims.length) return;
  const victim = victims.reduce((a, b) => (a.waitSince > b.waitSince ? a : b));
  for (const idx of [...victim.held]) releaseDongle(sim, victim, idx, false);
  victim.held = [];
  victim.wantsSecond = false;
  victim.wanting = -1;
  victim.waitSince = -1;
  victim.phase = "think";
  victim.phaseSince = sim.t;
  victim.phaseUntil = sim.t + 700 + sim.rng() * 500;
  emit(sim, "rollback", victim.id, -1, `DEADLOCK BREAKER: ${victim.name} rolled back (released held dongle, retries later)`);
  sim.lastOp = `breaker: rollback(${victim.name}) — cycle dissolved`;
  sim.deadlock = [];
  sim.deadlockSince = -1;
}

/* ---------------- EDF min-heap (array form, for visualization) ---------------- */

function buildHeap(ordered: ICoder[]): HeapNode[] {
  const heap: HeapNode[] = [];
  const siftUp = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].deadline <= heap[i].deadline) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  for (const c of ordered) {
    heap.push({ id: c.id, deadline: c.deadline });
    siftUp(heap.length - 1);
  }
  return heap;
}

/* ---------------- the tick ---------------- */

export function stepSim(sim: Sim): Snapshot {
  const { cfg } = sim;
  const n = cfg.coderCount;
  sim.t += cfg.tickMs;
  sim.tick++;

  /* 1 — monitor sweep (once per tick ⇒ burnout detection latency ≤ tickMs) */
  if (cfg.burnout) {
    sim.scans++;
    for (const c of sim.coders) {
      if (c.zeroAt >= 0 && c.phase !== "burnout") triggerBurnout(sim, c);
    }
  }

  /* 2 — per-coder timers & energy bookkeeping */
  for (const c of sim.coders) {
    switch (c.phase) {
      case "think":
        c.energy = Math.min(100, c.energy + 0.45);
        if (sim.t >= c.phaseUntil) startJob(sim, c);
        break;
      case "compile":
        c.energy = Math.max(0, c.energy - 0.05);
        if (sim.t >= c.phaseUntil) finishCompile(sim, c);
        break;
      case "cooldown":
        c.energy = Math.min(100, c.energy + 0.25);
        if (sim.t >= c.phaseUntil) {
          c.phase = "think";
          c.phaseSince = sim.t;
          c.phaseUntil = sim.t + 420 + sim.rng() * 850;
          c.thinkKind = sim.rng() < 0.5 ? "refactor" : "debug";
        }
        break;
      case "burnout":
        if (sim.t >= c.phaseUntil) {
          c.phase = "think";
          c.phaseSince = sim.t;
          c.phaseUntil = sim.t + 500 + sim.rng() * 700;
          c.energy = 55;
          c.zeroAt = -1;
          c.thinkKind = "debug";
          emit(sim, "recover", c.id, -1, `${c.name} back at the desk (energy restored to 55)`);
        }
        break;
      case "wait": {
        const d = sim.dongles[c.wanting];
        const crowd = d ? d.waiters.length : 1;
        c.energy = Math.max(0, c.energy - (0.5 + 0.22 * crowd) * cfg.drainMul);
        if (c.energy <= 0 && c.zeroAt < 0) {
          c.zeroAt = sim.t; // ground-truth burnout instant
          if (!cfg.burnout) {
            c.energy = 10;
            c.zeroAt = -1;
            emit(sim, "recover", c.id, -1, `${c.name} shook it off (monitor offline — no rescue logged)`);
          }
        }
        break;
      }
    }
  }

  /* 3 — monitor-serialized grant phase (mutex + condition variable) */
  const waiters = sim.coders.filter((c) => c.phase === "wait");
  const fifoOrder = [...waiters].sort((a, b) => a.waitSince - b.waitSince || a.id - b.id);
  const edfOrder = [...waiters].sort((a, b) => a.deadline - b.deadline || a.id - b.id);
  const ordered = cfg.scheduler === "edf" ? edfOrder : fifoOrder;

  // what WOULD each policy grant right now? (shadow comparison, pre-grant state)
  const fifoPick = fifoOrder.find((c) => isFree(sim, sim.dongles[c.wanting]))?.id ?? -1;
  const edfPick = edfOrder.find((c) => isFree(sim, sim.dongles[c.wanting]))?.id ?? -1;

  // mutex ownership for this tick's critical section (first-in-queue holds the token)
  sim.mutexOwner = ordered.length ? ordered[0].id : -1;
  sim.mutexQueue = ordered.slice(1).map((c) => c.id);

  for (const c of ordered) {
    if (c.phase !== "wait") continue; // woke & re-checked: no longer waiting
    if (cfg.strategy === "trylock") {
      const a = sim.dongles[firstIdx(c, n, cfg.strategy)];
      const b = sim.dongles[secondIdx(c, n, cfg.strategy)];
      if (isFree(sim, a) && isFree(sim, b)) {
        grant(sim, c, a);
        grant(sim, c, b);
        registerGrant(sim, fifoPick, edfPick);
        startCompile(sim, c);
        sim.lastOp = `${c.name}: trylock(D${a.idx},D${b.idx}) → both granted atomically`;
      } else if (sim.rng() < 0.28) {
        c.waitSince = sim.t + sim.rng() * 90; // randomized backoff jitter
        sim.lastOp = `${c.name}: trylock failed → exponential-ish backoff`;
      }
    } else {
      const d = sim.dongles[c.wanting];
      if (isFree(sim, d)) {
        grant(sim, c, d);
        if (!c.wantsSecond) {
          c.wantsSecond = true;
          const nxt = secondIdx(c, n, cfg.strategy);
          c.wanting = nxt;
          const d2 = sim.dongles[nxt];
          if (isFree(sim, d2)) {
            grant(sim, c, d2);
            registerGrant(sim, fifoPick, edfPick);
            startCompile(sim, c);
            sim.lastOp = `${c.name}: predicate free(D${d.idx}&&D${nxt}) → compile`;
          } else {
            d2.waiters.push(c.id);
            emit(sim, "wait", c.id, nxt, `${c.name} holds D${d.idx}, now blocks on D${nxt}${sim.cfg.strategy === "naive" ? " (half-held — circular wait fuel)" : ""}`);
            sim.lastOp = `${c.name}: while(!free(D${nxt})) → cond_wait() [holds D${d.idx}]`;
          }
        } else {
          registerGrant(sim, fifoPick, edfPick);
          startCompile(sim, c);
          sim.lastOp = `${c.name}: second dongle granted → compile`;
        }
      } else if (d.coolingUntil > sim.t && d.holder === -1) {
        sim.lastOp = `${c.name}: D${d.idx} cooling (${Math.ceil(d.coolingUntil - sim.t)}ms left) → stays queued`;
      }
    }
  }

  /* 4 — spurious wakeups: woken thread re-runs the while() predicate */
  const stillWaiting = sim.coders.filter((c) => c.phase === "wait");
  if (cfg.spurious && stillWaiting.length && sim.rng() < 0.06) {
    const c = stillWaiting[(sim.rng() * stillWaiting.length) | 0];
    const d = sim.dongles[c.wanting];
    if (!isFree(sim, d)) {
      emit(sim, "spurious", c.id, c.wanting, `${c.name} woke SPURIOUSLY → while(!free(D${c.wanting})) still false → back to cond_wait()`);
      sim.lastOp = `spurious wakeup: ${c.name} re-checked predicate → slept again (this is why it's while(), not if())`;
    }
  }

  /* 5 — queue views for the sync + scheduler panels */
  const condQueue = ordered.map((c) => c.id);
  const fifoView = fifoOrder.map((c) => c.id);
  const heapView = buildHeap(edfOrder);

  /* 6 — deadlock detection + optional breaker */
  detectDeadlock(sim);
  if (sim.deadlock.length && cfg.breaker && sim.t - sim.deadlockSince > 2500) breakDeadlock(sim);

  /* 7 — freeze this tick into an immutable snapshot */
  const events = sim.pending;
  sim.pending = [];

  return {
    t: sim.t,
    tick: sim.tick,
    coders: sim.coders.map((c) => ({
      id: c.id, name: c.name, phase: c.phase, phaseSince: c.phaseSince,
      energy: Math.round(c.energy * 10) / 10, held: [...c.held], wanting: c.wanting,
      wantsSecond: c.wantsSecond, deadline: c.deadline, waitSince: c.waitSince,
      compiles: c.compiles, misses: c.misses, burnouts: c.burnouts, thinkKind: c.thinkKind,
    })),
    dongles: sim.dongles.map((d) => ({
      idx: d.idx, holder: d.holder, coolingUntil: d.coolingUntil, waiters: [...d.waiters],
    })),
    mutexOwner: sim.mutexOwner,
    mutexQueue: [...sim.mutexQueue],
    condQueue,
    lastOp: sim.lastOp,
    fifoView,
    heapView,
    lastGrant: sim.lastGrant,
    grants: sim.grants,
    divergences: sim.divergences,
    scans: sim.scans,
    detections: [...sim.detections].slice(-8).reverse(),
    avgDelta: sim.detections.length ? Math.round((sim.deltaSum / sim.detections.length) * 10) / 10 : 0,
    maxDelta: sim.detections.length ? Math.max(...sim.detections.map((d) => d.delta)) : 0,
    deadlock: [...sim.deadlock],
    deadlockSince: sim.deadlockSince,
    events,
  };
}

function registerGrant(sim: Sim, fifoPick: number, edfPick: number) {
  sim.grants++;
  if (fifoPick >= 0 || edfPick >= 0) {
    if (fifoPick !== edfPick) sim.divergences++;
    sim.lastGrant = { fifo: fifoPick, edf: edfPick };
  }
}

/* ---------------- timeline helper: contiguous phase runs ---------------- */

export interface PhaseRun {
  phase: Phase;
  from: number;
  to: number;
}

export function collectRuns(
  history: Snapshot[],
  endIdx: number,
  coderId: number,
  startT: number,
  startIdx = 0
): PhaseRun[] {
  const runs: PhaseRun[] = [];
  let prev: Phase | null = startIdx > 0 ? history[startIdx].coders[coderId].phase : null;
  let cursor = startT;
  for (let i = startIdx; i <= endIdx; i++) {
    const s = history[i];
    const ph = s.coders[coderId].phase;
    if (ph !== prev) {
      if (prev !== null) {
        runs.push({ phase: prev, from: cursor, to: s.t });
        cursor = s.t;
      }
      prev = ph;
    }
  }
  if (prev !== null) {
    runs.push({ phase: prev, from: cursor, to: history[endIdx].t });
  }
  return runs;
}
