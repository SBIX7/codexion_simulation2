import { useMemo } from "react";
import type { SimEvent, Snapshot } from "../sim/engine";
import { EVENT_COLORS } from "./ui";

export default function EventLog({
  history,
  idx,
  onEventClick,
}: {
  history: Snapshot[];
  idx: number;
  onEventClick?: (e: SimEvent) => void;
}) {
  const events = useMemo(() => {
    const out: SimEvent[] = [];
    outer: for (let i = idx; i >= 0; i--) {
      const evs = history[i].events;
      for (let j = evs.length - 1; j >= 0; j--) {
        out.push(evs[j]);
        if (out.length >= 90) break outer;
      }
    }
    return out;
  }, [history, idx]);

  const total = useMemo(() => {
    let n = 0;
    for (let i = 0; i <= idx; i++) n += history[i].events.length;
    return n;
  }, [history, idx]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto px-2.5 py-2" style={{ scrollbarGutter: "stable" }}>
        {/* live cursor */}
        <div className="mb-1.5 flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-[#3ddc97]">
          <span className="blink inline-block h-[11px] w-[6px] bg-[#3ddc97]" />
          stdout — follow mode
        </div>
        {events.length === 0 && (
          <div className="text-[10px] text-ink-400">— quiet… threads are still thinking —</div>
        )}
        {events.map((e) => {
          const col = EVENT_COLORS[e.type] ?? "#8ca3b5";
          return (
            <div
              key={e.id}
              onClick={() => onEventClick?.(e)}
              className={`flicker-in group mb-[3px] flex gap-2 border-l-2 py-[1px] pl-2 text-[9.5px] leading-snug ${onEventClick ? "cursor-pointer hover:bg-[#4cc9f00d]" : ""}`}
              style={{ borderColor: `${col}55` }}
              title={`${e.msg}${onEventClick ? " — click to jump the timeline here" : ""}`}
            >
              <span className="shrink-0 font-mono text-ink-400">{(e.t / 1000).toFixed(2)}s</span>
              <span
                className="h-fit shrink-0 px-1 text-[7.5px] font-semibold uppercase tracking-wider"
                style={{ color: col, background: `${col}14` }}
              >
                {e.type}
              </span>
              <span className="min-w-0 text-ink-300 group-hover:text-ink-100">{e.msg}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-ink-700 px-3 py-1.5 text-[8px] tracking-[0.18em] text-ink-400">
        {total} EVENTS CAPTURED · RING BUFFER · VIZ-ONLY SINK
      </div>
    </div>
  );
}
