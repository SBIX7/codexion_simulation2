import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Snapshot } from "../sim/engine";
import { DONGLE_COLORS, PHASE_META, identColor } from "./ui";

const C = 210; // center
const R = 148; // ring radius

function pos(i: number, n: number, radius = R) {
  const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
  return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) };
}

const PHASE_SHORT: Record<string, string> = {
  think: "THK", wait: "WAIT", compile: "CMP", cooldown: "CLD", burnout: "BRN",
};

export default function Stage({ snap, enabled }: { snap: Snapshot; enabled: boolean }) {
  const n = snap.coders.length;

  const dongleState = (d: (typeof snap.dongles)[number]) =>
    d.holder >= 0 ? "inuse" : snap.t < d.coolingUntil ? "cooling" : "available";

  const recentAcquire = useMemo(() => {
    const m = new Set<number>();
    for (const e of snap.events) if (e.type === "acquire") m.add(e.dongle);
    return m;
  }, [snap]);

  if (!enabled) return null;

  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <svg viewBox="0 0 420 420" className="w-full">
        {/* table ring */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="#1a2733" strokeWidth="1.5" strokeDasharray="2 6" />
        <circle cx={C} cy={C} r={R - 34} fill="none" stroke="#111b24" strokeWidth="1" />

        {/* monitor sentinel orbiting the table (one sweep per scan period) */}
        <g style={{ transformOrigin: "210px 210px", animation: "spin-slow 3s linear infinite" }}>
          <circle cx={C} cy={C - R} r={4} fill="#3ddc97" opacity={0.9} />
          <circle cx={C} cy={C - R} r={8} fill="none" stroke="#3ddc97" opacity={0.35} />
        </g>

        {/* deadlock cycle ring */}
        {snap.deadlock.length > 0 && (
          <g>
            <circle
              className="deadlock-ring"
              cx={C} cy={C} r={R}
              fill="none" stroke="#ff5c5c" strokeWidth="2.5"
              strokeDasharray="14 10" opacity="0.85"
            />
            {snap.deadlock.map((id) => {
              const p = pos(id, n);
              return (
                <motion.circle
                  key={`dl-${id}`}
                  cx={p.x} cy={p.y} r={30}
                  fill="none" stroke="#ff5c5c" strokeWidth="1.5"
                  strokeDasharray="4 4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.2, 0.9, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
              );
            })}
          </g>
        )}

        {/* arms: held (solid, identity color) + reaching (dashed amber) */}
        {snap.coders.map((c) => {
          const cp = pos(c.id, n);
          return (
            <g key={`arms-${c.id}`}>
              {c.held.map((di) => {
                const dp = pos(di + 0.5, n, R);
                return (
                  <motion.line
                    key={`h-${c.id}-${di}`}
                    x1={cp.x} y1={cp.y} x2={dp.x} y2={dp.y}
                    animate={{ x2: dp.x, y2: dp.y }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    stroke={identColor(c.id)}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                );
              })}
              {c.wanting >= 0 && !c.held.includes(c.wanting) && (
                <line
                  className="reach"
                  x1={cp.x} y1={cp.y}
                  x2={pos(c.wanting + 0.5, n, R).x}
                  y2={pos(c.wanting + 0.5, n, R).y}
                  stroke="#ffc53d"
                  strokeWidth="1.8"
                  opacity="0.8"
                />
              )}
            </g>
          );
        })}

        {/* dongles at edge midpoints */}
        {snap.dongles.map((d) => {
          const p = pos(d.idx + 0.5, n, R);
          const st = dongleState(d);
          const col = DONGLE_COLORS[st];
          const coolFrac =
            st === "cooling" ? Math.max(0, (d.coolingUntil - snap.t) / 600) : 0;
          const flash = recentAcquire.has(d.idx);
          return (
            <g key={`d-${d.idx}`} transform={`translate(${p.x},${p.y})`}>
              {d.waiters.length > 1 && (
                <circle className="contend-pulse" r={16} fill="none" stroke="#ffc53d" strokeWidth="1.5" />
              )}
              <motion.rect
                x={-16} y={-11} width={32} height={22} rx={3}
                animate={{ scale: flash ? [1, 1.28, 1] : 1 }}
                transition={{ duration: 0.45 }}
                fill={`${col}1f`}
                stroke={col}
                strokeWidth="1.6"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
              {/* usb contacts */}
              <rect x={-8} y={-5} width={4} height={3} fill={col} opacity={0.8} />
              <rect x={-8} y={2} width={4} height={3} fill={col} opacity={0.8} />
              <text x={5} y={3.5} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono" fill={col}>
                D{d.idx}
              </text>
              {st === "cooling" && (
                <rect x={-16} y={13} width={32 * coolFrac} height={2.5} fill={col} opacity={0.9} />
              )}
              {d.waiters.length > 0 && (
                <g transform="translate(14,-16)">
                  <rect x={-2} y={-8} width={16} height={11} fill="#0b1117" stroke="#ffc53d" strokeWidth="0.8" />
                  <text x={6} y={0.5} textAnchor="middle" fontSize="8" fontFamily="IBM Plex Mono" fill="#ffc53d">
                    ×{d.waiters.length}
                  </text>
                </g>
              )}
              <title>
                {`D${d.idx} — ${st}${d.holder >= 0 ? ` (held by ${snap.coders[d.holder].name})` : ""}${
                  d.waiters.length ? ` · waiters: ${d.waiters.map((w) => snap.coders[w].name).join(", ")}` : ""
                }`}
              </title>
            </g>
          );
        })}

        {/* coders */}
        {snap.coders.map((c) => {
          const p = pos(c.id, n);
          const meta = PHASE_META[c.phase];
          const inCycle = snap.deadlock.includes(c.id);
          const stroke = inCycle ? "#ff5c5c" : meta.color;
          return (
            <g key={`c-${c.id}`} transform={`translate(${p.x},${p.y})`}>
              <circle r={24} fill="#0e161e" stroke={stroke} strokeWidth={inCycle ? 2.6 : 1.8} />
              <circle r={28} fill="none" stroke={stroke} strokeWidth="0.7" opacity="0.35" strokeDasharray="2 5" />
              <text
                y={-2} textAnchor="middle" fontSize="10" fontWeight="600"
                fontFamily="Space Grotesk" fill={stroke} letterSpacing="0.08em"
              >
                {PHASE_SHORT[c.phase]}
              </text>
              <text y={10} textAnchor="middle" fontSize="7.5" fontFamily="IBM Plex Mono" fill="#8ca3b5">
                {c.thinkKind === "debug" && c.phase === "think" ? "debugging" : c.phase === "think" ? "refactor" : c.name}
              </text>
              {/* energy arc */}
              <path
                d={arcPath(20, -150, -150 + c.energy * 3)}
                fill="none"
                stroke={c.energy > 50 ? "#3ddc97" : c.energy > 25 ? "#ffc53d" : "#ff5c5c"}
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.9"
              />
              <text y={41} textAnchor="middle" fontSize="8.5" fontFamily="IBM Plex Mono" fill={identColor(c.id)}>
                {c.name}
              </text>
              <text y={51} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono" fill="#5c7488">
                {c.held.length === 2
                  ? `D${c.held[0]}+D${c.held[1]}`
                  : c.wanting >= 0
                    ? `→D${c.wanting}`
                    : `E ${Math.round(c.energy)}`}
              </text>
              <title>{`${c.name} — ${c.phase} · energy ${Math.round(c.energy)} · compiles ${c.compiles} · misses ${c.misses}`}</title>
            </g>
          );
        })}

        {/* center: simulation clock */}
        <g>
          <text x={C} y={C - 16} textAnchor="middle" fontSize="11" fontFamily="IBM Plex Mono" fill="#5c7488">
            SIM CLOCK
          </text>
          <text x={C} y={C + 8} textAnchor="middle" fontSize="26" fontWeight="600" fontFamily="Space Grotesk" fill="#e8f0f6">
            {(snap.t / 1000).toFixed(2)}
            <tspan fontSize="12" fill="#8ca3b5"> s</tspan>
          </text>
          <text x={C} y={C + 26} textAnchor="middle" fontSize="9" fontFamily="IBM Plex Mono" fill="#5c7488">
            tick {snap.tick} · Δ10ms
          </text>
          {snap.deadlock.length > 0 && (
            <motion.g
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <rect x={C - 78} y={C + 36} width={156} height={20} fill="rgba(255,92,92,0.12)" stroke="#ff5c5c" strokeWidth="1" />
              <text x={C} y={C + 50} textAnchor="middle" fontSize="9.5" fontFamily="IBM Plex Mono" fill="#ff5c5c" letterSpacing="0.12em">
                ⦿ CIRCULAR WAIT ×{snap.deadlock.length}
              </text>
            </motion.g>
          )}
        </g>
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-[9px] tracking-wider text-ink-400">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2" style={{ background: DONGLE_COLORS.available }} /> DONGLE FREE
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2" style={{ background: DONGLE_COLORS.inuse }} /> IN USE
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2" style={{ background: DONGLE_COLORS.cooling }} /> COOLING
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#ffc53d" strokeWidth="1.6" strokeDasharray="4 3" /></svg>
          REACHING
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#3ddc97" strokeWidth="2.2" /></svg>
          HELD
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#3ddc97]" /> MONITOR SWEEP
        </span>
      </div>
    </div>
  );
}

/* arc from a1 to a2 degrees at radius r, centered on (0,0) */
function arcPath(r: number, a1: number, a2: number) {
  const p1 = polar(r, a1);
  const p2 = polar(r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
}
function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}
