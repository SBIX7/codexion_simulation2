# CODEXION — Concurrency Under the Hood

A C-multithreading simulation turned into an interactive diagnostic console.
*Coders* (threads) sit around a circular co-working table and compete for limited USB
*dongles* (resources): compiling requires **both** adjacent dongles, and the whole point
is to see — visually, at thread level — how deadlocks, starvation, races and burnouts
actually happen, and how mutexes, condition variables and EDF scheduling prevent them.

The simulation core is a deterministic 10 ms tick engine. **Everything you see is derived
from immutable snapshots of that engine** — the visualization layer is strictly read-only,
so it can never perturb the behavior it explains.

---

## Run it locally

```bash
# 1. install dependencies
npm install

# 2a. development server (hot reload)
npm run dev          # → http://localhost:5173

# 2b. production build + preview
npm run build        # outputs dist/
npm run preview      # serves dist/

# optional: type-check without building
npm run typecheck
```

Stack: **React 18 + TypeScript + Vite 6**, Tailwind CSS 4, Framer Motion. No backend, no env vars.

---

## The layout

```
┌ header ─── scenario presets · acquire/scheduler policy · toggles · guided tour · theme ─┐
│ concept sidebar (focus mode) │   metrics strip                                          │
│                              │   ◉ circular co-working hub (the centerpiece)            │
│                              │   event stream (collapsed, synced with the timeline)     │
│                              │   UNDER THE HOOD drawer — 7 tabs, one at a time          │
└ time machine ─── gantt scrubber · restart/step-back/play/step · 0.1×–10× · slow-mo ─────┘
```

### 1. Time Machine (bottom bar, always visible)
- **Speed slider with detents** `0.1× 0.25× 0.5× 1× 2× 4× 10×` — default **1×**.
- **Restart · Step back · Play/Pause · Step forward** (exactly one 10 ms tick).
- **Gantt scrubber**: one lane per thread, drag to scrub, hover to preview the exact
  global state at that millisecond, dots = acquisitions, ▲ flags = burnouts,
  red lines = deadlock instants.
- **Slow-mo on critical events**: deadlocks / burnouts / misses automatically drop the
  speed to 0.25× for a few seconds (toggleable). **⟲ Replay last 2 s** rewinds and
  replays at quarter speed.

### 2. The circular co-working hub
- Coders as glowing nodes: **green pulse** = compiling, **amber** = debugging,
  **cyan** = refactoring, **gray breathing** = waiting, **red flash** = burned out.
- Dongles between neighbours: **cyan** available · **red** held (animated beam to the
  holder) · **orange** cooling with a radial countdown sweep.
- **Deadline radar** around every waiting coder — a shrinking arc
  (`deadline = last_compile_start + time_to_burnout`) turning green → amber → red.
  This alone makes FIFO vs EDF intuitive.
- The **monitor thread** orbits the table, scanning every 10 ms; it flashes red when a
  burnout is imminent.
- On circular wait, the **wait-for graph** is drawn over the table (`1 → 2 → 3 → 1`),
  pulsing red.
- **Focus mode**: picking a concept in the left sidebar dims everything unrelated.
- Click any coder or dongle to jump straight to its under-the-hood tab.

### 3. Under-the-Hood drawer (7 tabs, one open at a time)
| Tab | Shows |
|---|---|
| **Process & Threads** | one process memory map (`.text`, `.data`, shared **heap**), one private **stack per thread** with a live **program counter**, `pthread_create` animated |
| **Mutexes** | green/red padlock per dongle + the global `grant_mutex`, ordered wait queues with live wait timers |
| **Cond Vars** | the *dormitory* of sleeping threads, the atomic *release-mutex → sleep* two-step, signal/broadcast, and an interactive **spurious-wakeup demo** (`while` vs `if`) |
| **Race Lab** | register-level `counter++` interleaving (LOAD/INC/STORE) with the **lost update**, side-by-side with the mutex-protected run — Step/Play/Pause |
| **Resource Graph** | live resource-allocation graph + the **four Coffman conditions** with ✔/✘ indicators |
| **Priority Queue** | the actual EDF **binary min-heap** with animated insert/sift-up/extract-min (FIFO shows the plain queue), tie-break rule included |
| **Logs** | serialized log stream in the subject format (`<ms> X has taken a dongle`), verbose mode, **export .log**, and the **10 ms burnout-precision** meter (avg/worst Δ) |

### 4. Compare / What-If view
Split-screen **FIFO vs EDF** (or *baseline vs one changed parameter*) running two
lockstep engines with the **same seed**: synchronized mini-Gantts plus a shared stats
strip (burnouts, compiles, avg/max wait, utilization, misses) with delta arrows.
Preloaded: *FIFO fails · EDF saves*, *Both succeed*, *Infeasible workload*.

### 5. Pedagogy
- **Guided tour**: 6 steps, each sets up the live scenario, explains it, then validates
  with a quiz question.
- **Event storytelling**: critical events raise a toast (“⦿ Circular wait forming…”)
  with **SHOW ME WHY** — pauses, rewinds 2 s, opens the matching drawer tab, and
  focuses the concept.
- **Debug mode**: verbose internals, ms-precision timeline, log export.

---

## Predefined scenarios

| Button | What it demonstrates |
|---|---|
| **DEADLOCK TRAP** | naïve left→right grabbing closes the wait-for cycle; breaker OFF lets you watch it freeze until the monitor rescues a victim |
| **STARVATION** | FIFO lets urgent coders rot in the queue — flip SCHED to EDF and compare |
| **BURNOUT WAVE** | high drain + spurious wakeups; every rescue stamps **Δ ≤ 10 ms** in the LOGS tab |
| **FREE RUN** | try-lock + EDF healthy baseline |

---

## Architecture (why the viz can't break the sim)

```
src/sim/engine.ts    pure tick machine: createSim(cfg) → stepSim(sim) → immutable Snapshot
src/sim/derive.ts    read-only analysis: metrics, wait-for edges, Coffman, heap ops, logs
src/hooks/           rAF playback loop + history ring buffer (scrub/replay/step-back)
src/components/      stage, time machine, sidebar, comparison, tutorial, toasts
src/drawer/          under-the-hood tabs (process, mutexes, condvars, race lab, graph, heap, logs)
```

- The engine never imports UI code; animation data travels outward via snapshots only.
- History is a bounded ring buffer; scrubbing re-reads recorded snapshots — no re-simulation drift.
- Every module is toggleable/collapsible; turning one off never touches the core loop.

## Accessibility & polish
Dark theme by default (deep navy `#0C1218`) with a light-mode cross-fade, Space Grotesk +
IBM Plex Mono, tooltips on every control, consistent semantic colors
(cyan = available, green = success, amber = warning, red = locked/burnout, orange = cooldown,
gray = waiting).
