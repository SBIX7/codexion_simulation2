import { useMemo, useRef } from "react";
import { collectRuns, type SimEvent, type Snapshot } from "../sim/engine";
import { EVENT_COLORS, PHASE_META, identColor } from "./ui";

const WINDOW_MS = 8000;
const TICK_MS = 10;

const MARKER_TYPES = new Set(["acquire", "burnout", "miss", "spurious", "deadlock", "rollback"]);

export default function Timeline({
  history,
  idx,
  snap,
  scrubTo,
  setScrubbing,
  playing,
}: {
  history: Snapshot[];
  idx: number;
  snap: Snapshot;
  scrubTo: (i: number) => void;
  setScrubbing: (b: boolean) => void;
  playing: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startT = Math.max(0, snap.t - WINDOW_MS);
  const startIdx = Math.max(0, idx - Math.ceil(WINDOW_MS / TICK_MS) - 4);

  const lanes = useMemo(
    () =>
      snap.coders.map((c) => ({
        coder: c,
        runs: collectRuns(history, idx, c.id, startT, startIdx),
      })),
    [history, idx, snap.coders, startT, startIdx]
  );

  const events = useMemo(() => {
    const out: SimEvent[] = [];
    for (let i = startIdx; i <= idx; i++) {
      for (const e of history[i].events) {
        if (e.t >= startT && MARKER_TYPES.has(e.type)) out.push(e);
      }
    }
    return out.slice(-220);
  }, [history, idx, startIdx, startT]);

  const x = (t: number) => `${((t - startT) / WINDOW_MS) * 100}%`;

  const scrubFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const targetT = startT + frac * WINDOW_MS;
    scrubTo(idx - Math.round((snap.t - targetT) / TICK_MS));
  };

  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let t = Math.ceil(startT / 1000) * 1000; t <= snap.t; t += 1000) ticks.push(t);
    return ticks;
  }, [startT, snap.t]);

  return (
    <div>
      {/* ruler */}
      <div className="relative ml-[104px] mr-2 h-4 text-[8px] text-ink-400">
        {rulerTicks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 font-mono" style={{ left: x(t) }}>
            {(t / 1000).toFixed(0)}s
          </span>
        ))}
        <span className="absolute right-0 -top-0.5 flex items-center gap-1 text-[8px] tracking-[0.2em]" style={{ color: playing ? "#3ddc97" : "#ffc53d" }}>
          <i className={`h-1.5 w-1.5 rounded-full ${playing ? "led-on" : ""}`} style={{ background: "currentColor", color: "inherit" }} />
          {playing ? "LIVE" : "PAUSED"}
        </span>
      </div>

      {/* lanes */}
      <div
        ref={trackRef}
        className="relative ml-[104px] mr-2 cursor-ew-resize touch-none select-none border-y border-ink-700 bg-ink-950/60"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setScrubbing(true);
          scrubFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) scrubFromEvent(e.clientX);
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
        title="drag to scrub through recorded history"
      >
        {lanes.map(({ coder, runs }) => (
          <div key={coder.id} className="relative h-[22px] border-b border-ink-800 last:border-b-0">
            {runs.map((r, i) => {
              const meta = PHASE_META[r.phase];
              const left = ((r.from - startT) / WINDOW_MS) * 100;
              const width = Math.max(0.15, ((r.to - r.from) / WINDOW_MS) * 100);
              return (
                <div
                  key={i}
                  className="absolute inset-y-[4px]"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: meta.dim,
                    borderTop: `2px solid ${meta.color}`,
                    boxShadow: r.phase === "burnout" ? `0 0 8px ${meta.color}66` : undefined,
                  }}
                >
                  {width > 6 && (
                    <span className="pl-1 text-[7.5px] leading-[14px]" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                  )}
                </div>
              );
            })}
            {/* event markers on this coder's lane */}
            {events
              .filter((e) => e.coder === coder.id)
              .map((e) => (
                <span
                  key={e.id}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: x(e.t) }}
                  title={`t=${e.t}ms · ${e.type} — ${e.msg}`}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    {e.type === "acquire" ? (
                      <path d="M4 0 8 8H0Z" fill={EVENT_COLORS[e.type]} />
                    ) : e.type === "burnout" ? (
                      <path d="M4 0 8 4 4 8 0 4Z" fill={EVENT_COLORS[e.type]} />
                    ) : (
                      <circle cx="4" cy="4" r="3" fill={EVENT_COLORS[e.type] ?? "#8ca3b5"} />
                    )}
                  </svg>
                </span>
              ))}
            {/* lane label (outside track, negative margin) */}
            <div className="absolute right-full top-0 flex h-full w-[104px] items-center justify-end gap-1.5 pr-2">
              <span className="text-[9px]" style={{ color: identColor(coder.id) }}>
                {coder.name}
              </span>
              <span
                className="px-1 text-[7.5px] tracking-wider"
                style={{ color: PHASE_META[coder.phase].color, background: PHASE_META[coder.phase].dim }}
              >
                {PHASE_META[coder.phase].label}
              </span>
            </div>
          </div>
        ))}

        {/* playhead — window always ends at "now" */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-[#e8f0f6]" style={{ boxShadow: "0 0 10px rgba(232,240,246,0.8)" }} />
        <div className="pointer-events-none absolute inset-y-0 right-[2px] w-10 bg-gradient-to-l from-transparent to-[#e8f0f60d]" />

        {/* active deadlock tint */}
        {snap.deadlock.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-[#ff5c5c1f] to-transparent" />
        )}
      </div>

      {/* footer legend + scrub hint */}
      <div className="ml-[104px] mr-2 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] tracking-wider text-ink-400">
        {Object.entries(PHASE_META).map(([k, m]) => (
          <span key={k} className="flex items-center gap-1">
            <i className="h-[3px] w-3" style={{ background: m.color }} /> {m.label.toUpperCase()}
          </span>
        ))}
        <span className="ml-auto opacity-70">◂ drag to scrub recorded history · window = 8 s</span>
      </div>
    </div>
  );
}
