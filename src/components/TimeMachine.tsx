import { useMemo, useRef, useState } from "react";
import type { SimControls } from "../hooks/useSimulation";
import { SPEED_DETENTS } from "../hooks/useSimulation";
import { collectRuns, type Snapshot } from "../sim/engine";
import { PHASE_META, identColor, Tip } from "./ui";
import { findIdxByTime, stateSummary } from "../sim/derive";

const WINDOW_TICKS = 1200; // 12 s of sim visible in the scrubber

export default function TimeMachine({ sim }: { sim: SimControls }) {
  const { history, idx, snap } = sim;
  const ganttRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const startIdx = Math.max(0, idx - WINDOW_TICKS + 1);
  const startT = history[startIdx].t;
  const endT = snap.t;
  const span = Math.max(1, endT - startT);
  const pct = (t: number) => `${((t - startT) / span) * 100}%`;

  const lanes = useMemo(
    () =>
      snap.coders.map((c) => ({
        id: c.id,
        runs: collectRuns(history, idx, c.id, startT),
      })),
    [history, idx, snap.coders, startT]
  );

  /* event markers inside the window */
  const markers = useMemo(() => {
    const dots: { coder: number; t: number; kind: string }[] = [];
    for (let i = startIdx; i <= idx; i++) {
      const s = history[i];
      for (const e of s.events) {
        if (e.type === "acquire") dots.push({ coder: e.coder, t: e.t, kind: "acquire" });
        if (e.type === "burnout") dots.push({ coder: e.coder, t: e.t, kind: "burnout" });
        if (e.type === "deadlock") dots.push({ coder: -1, t: e.t, kind: "deadlock" });
      }
      if (dots.length > 600) break;
    }
    return dots;
  }, [history, startIdx, idx]);

  const idxFromClientX = (clientX: number) => {
    const el = ganttRef.current;
    if (!el) return idx;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return findIdxByTime(history, startT + f * span);
  };

  const hoverSnap: Snapshot | null = hoverIdx !== null ? history[hoverIdx] : null;

  return (
    <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-ink-700">
      {/* ---------- gantt scrubber ---------- */}
      <div
        ref={ganttRef}
        className="relative mx-auto cursor-crosshair px-3 pt-2"
        style={{ height: 26 + lanes.length * 13 }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          sim.setScrubbing(true);
          sim.pause();
          sim.scrubTo(idxFromClientX(e.clientX));
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          setHoverIdx(idxFromClientX(e.clientX));
          if (draggingRef.current) sim.scrubTo(idxFromClientX(e.clientX));
        }}
        onPointerUp={() => {
          draggingRef.current = false;
          sim.setScrubbing(false);
        }}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* lanes */}
        <div className="relative">
          {lanes.map((lane) => (
            <div key={lane.id} className="relative mb-[3px] flex items-center" style={{ height: 10 }}>
              <span
                className="mr-2 w-10 shrink-0 text-right text-[7.5px] tracking-wider"
                style={{ color: identColor(lane.id) }}
              >
                T{lane.id + 1}
              </span>
              <div className="relative h-[7px] flex-1 bg-[#0b111799]">
                {lane.runs.map((r, i) => {
                  const left = ((Math.max(r.from, startT) - startT) / span) * 100;
                  const w = Math.max(0.15, ((Math.min(r.to, endT) - Math.max(r.from, startT)) / span) * 100);
                  const meta = PHASE_META[r.phase];
                  return (
                    <div
                      key={i}
                      className="absolute top-0 h-full"
                      style={{
                        left: `${left}%`,
                        width: `${w}%`,
                        background: meta.color,
                        opacity: r.phase === "wait" ? 0.55 : 0.9,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* event markers */}
          {markers.map((m, i) => {
            const left = pct(m.t);
            if (m.kind === "deadlock")
              return (
                <div key={`m-${i}`} className="absolute top-0 h-full w-[2px] bg-[#ff5c5c]" style={{ left, opacity: 0.7 }} title={`deadlock @ ${m.t}ms`} />
              );
            const laneY = m.coder >= 0 ? m.coder * 13 : 0;
            return (
              <div
                key={`m-${i}`}
                className="absolute"
                style={{ left, top: laneY + 1 }}
                title={`${m.kind} @ ${m.t}ms`}
              >
                {m.kind === "burnout" ? (
                  <svg width="7" height="8" viewBox="0 0 7 8"><path d="M3.5 0 7 8H0Z" fill="#ff5c5c" /></svg>
                ) : (
                  <i className="block h-[5px] w-[5px] rounded-full bg-[#4cc9f0]" />
                )}
              </div>
            );
          })}

          {/* playhead + hover crosshair */}
          <div className="pointer-events-none absolute top-0 h-full w-[2px] bg-[#e8f0f6]" style={{ left: pct(snap.t), boxShadow: "0 0 8px rgba(232,240,246,0.7)" }} />
          {hoverIdx !== null && hoverIdx !== idx && (
            <div className="pointer-events-none absolute top-0 h-full w-px bg-[#4cc9f0aa]" style={{ left: pct(history[hoverIdx].t) }} />
          )}
        </div>

        {/* hover preview card */}
        {hoverSnap && hoverIdx !== null && hoverIdx !== idx && (
          <div
            className="pointer-events-none absolute bottom-full mb-1 z-50 border border-ink-600 bg-[#111b24f5] px-2.5 py-1.5 text-[9px] leading-relaxed"
            style={{ left: pct(history[hoverIdx].t), transform: "translateX(-50%)" }}
          >
            <div className="font-mono text-[#4cc9f0]">{(hoverSnap.t / 1000).toFixed(2)}s · tick {hoverSnap.tick}</div>
            <div className="text-ink-300">{stateSummary(hoverSnap)}</div>
            <div className="text-[7.5px] tracking-[0.18em] text-ink-400">CLICK TO JUMP</div>
          </div>
        )}
      </div>

      {/* ---------- transport row ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-800 px-3 py-2">
        <div className="flex items-center gap-1">
          <TBtn label="restart run" onClick={sim.restart}>
            <path d="M11.5 7a4.5 4.5 0 1 1-1.4-3.25M10.5 1.4v2.6H7.9" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </TBtn>
          <TBtn label="step back one tick" onClick={sim.stepBack}>
            <path d="M11.2 2.5 5.5 7l5.7 4.5ZM2.8 2.5v9" fill="currentColor" stroke="none" />
          </TBtn>
          <button
            onClick={sim.togglePlay}
            aria-label={sim.playing ? "pause" : "play"}
            className="flex h-9 w-12 items-center justify-center border border-[#3ddc9777] bg-[#3ddc9714] text-[#3ddc97] transition-all hover:bg-[#3ddc9722] active:translate-y-px"
          >
            {sim.playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4.2 2.5v9M9.8 2.5v9" stroke="currentColor" strokeWidth="2.3" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 2.2 11.5 7 3.5 11.8Z" fill="currentColor" /></svg>
            )}
          </button>
          <Tip tip="advance exactly one event-tick (10 ms of sim)">
            <TBtn label="step forward one tick" onClick={sim.stepOnce}>
              <path d="M2.8 2.5 8.5 7l-5.7 4.5ZM11.2 2.5v9" fill="currentColor" stroke="none" />
            </TBtn>
          </Tip>
        </div>

        {/* speed slider with detents */}
        <div className="flex min-w-[240px] flex-1 items-center gap-2.5">
          <span className="text-[8px] tracking-[0.2em] text-ink-400">SPEED</span>
          <input
            type="range"
            className="speed w-full max-w-[180px]"
            min={0}
            max={SPEED_DETENTS.length - 1}
            step={1}
            value={Math.max(0, SPEED_DETENTS.findIndex((d) => Math.abs(d - sim.speed) < 1e-6))}
            onChange={(e) => sim.setSpeed(SPEED_DETENTS[Number(e.target.value)])}
            aria-label="simulation speed"
          />
          <div className="flex gap-[3px]">
            {SPEED_DETENTS.map((d) => (
              <button
                key={d}
                onClick={() => sim.setSpeed(d)}
                className="border px-1.5 py-[2px] text-[9px] tabular-nums transition-colors"
                style={
                  Math.abs(sim.speed - d) < 1e-6
                    ? { borderColor: "#4cc9f088", color: "#4cc9f0", background: "rgba(76,201,240,0.12)" }
                    : { borderColor: "#243644", color: "#5c7488" }
                }
              >
                {d}×
              </button>
            ))}
          </div>
        </div>

        <Tip tip="when a deadlock / burnout / miss occurs, speed drops to 0.25× for 6 s so you can watch it happen">
          <button
            onClick={() => sim.setSlowMoArmed(!sim.slowMoArmed)}
            className="flex items-center gap-1.5 border px-2 py-1 text-[9px] tracking-[0.14em] transition-colors"
            style={
              sim.slowMoArmed
                ? { borderColor: "#ff5c5c77", color: "#ff5c5c", background: "rgba(255,92,92,0.1)" }
                : { borderColor: "#243644", color: "#5c7488" }
            }
          >
            <i className={`h-1.5 w-1.5 rounded-full ${sim.slowMoActive ? "led-on" : ""}`} style={{ background: sim.slowMoArmed ? "#ff5c5c" : "#3a4c5c", color: "#ff5c5c" }} />
            SLOW-MO ON CRITICAL
          </button>
        </Tip>

        <Tip tip="rewind 2 s and replay at 0.25× — perfect for re-watching a deadlock form">
          <button
            onClick={sim.replayLast2s}
            className="border border-[#ffc53d66] bg-[#ffc53d10] px-2 py-1 text-[9px] tracking-[0.14em] text-[#ffc53d] transition-all hover:bg-[#ffc53d1c] active:translate-y-px"
          >
            ⟲ REPLAY LAST 2 s
          </button>
        </Tip>

        {/* clock */}
        <div className="ml-auto flex items-center gap-3">
          <span
            className={`border px-1.5 py-[2px] text-[8px] tracking-[0.2em] ${sim.atLiveEdge ? "border-[#3ddc9766] text-[#3ddc97]" : "border-[#ffc53d66] text-[#ffc53d]"}`}
          >
            {sim.atLiveEdge ? "● LIVE" : "⏸ SCRUBBING"}
          </span>
          <span className="font-display text-[20px] font-semibold tabular-nums leading-none text-ink-100">
            {(snap.t / 1000).toFixed(2)}
            <span className="text-[11px] text-ink-400"> s</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function TBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center border border-ink-600 bg-[#0e161e] text-ink-300 transition-all hover:border-[#4cc9f066] hover:text-[#4cc9f0] active:translate-y-px"
    >
      <svg width="13" height="13" viewBox="0 0 14 14">{children}</svg>
    </button>
  );
}
