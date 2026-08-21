import { motion } from "framer-motion";
import type { Snapshot } from "../sim/engine";
import type { ConceptId } from "../sim/derive";
import { waitEdges } from "../sim/derive";
import { DONGLE_COLORS, THINK_COLORS, identColor } from "./ui";

const C = 210;
const R = 146;

function pos(i: number, n: number, radius = R) {
  const a = ((-90 + (i * 360) / Math.max(1, n)) * Math.PI) / 180;
  return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) };
}

/* which hub groups stay lit for each focus concept */
const FOCUS_GROUPS: Record<ConceptId, Set<string>> = {
  threads: new Set(["coders", "monitor"]),
  race: new Set(["coders"]),
  mutex: new Set(["coders", "dongles"]),
  condvar: new Set(["coders", "dongles"]),
  deadlock: new Set(["coders", "dongles", "arrows"]),
  scheduling: new Set(["coders", "radars"]),
  burnout: new Set(["coders", "radars", "monitor"]),
  cooldown: new Set(["dongles", "coders"]),
};

export default function Stage({
  snap,
  focus,
  onSelect,
}: {
  snap: Snapshot;
  focus: ConceptId | null;
  onSelect: (kind: "coder" | "dongle", id: number) => void;
}) {
  const n = snap.coders.length;
  const lit = focus ? FOCUS_GROUPS[focus] : null;
  const op = (group: string) => (lit && !lit.has(group) ? "dimmed" : "");
  const edges = waitEdges(snap);
  const cycleEdges = edges.filter((e) => snap.deadlock.includes(e.from) && snap.deadlock.includes(e.to));

  const imminent = snap.coders.filter((c) => c.phase === "wait" && c.energy < 18);

  const dongleState = (d: (typeof snap.dongles)[number]) =>
    d.holder >= 0 ? "inuse" : snap.t < d.coolingUntil ? "cooling" : "available";

  return (
    <div className="relative mx-auto w-full max-w-[620px] select-none">
      <svg viewBox="0 0 420 420" className="w-full">
        <defs>
          <marker id="arrowRed" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0.5 0.5 7 4 0.5 7.5Z" fill="#ff5c5c" />
          </marker>
          <radialGradient id="hubGlow">
            <stop offset="0%" stopColor="rgba(76,201,240,0.10)" />
            <stop offset="100%" stopColor="rgba(76,201,240,0)" />
          </radialGradient>
        </defs>

        <circle cx={C} cy={C} r={185} fill="url(#hubGlow)" />
        <circle cx={C} cy={C} r={R} fill="none" stroke="#1a2733" strokeWidth="1.5" strokeDasharray="2 7" />

        {/* ---- monitor thread: orbits the table, scans the deadline arcs ---- */}
        <g className={`dim-able ${op("monitor")}`}>
          <g style={{ transformOrigin: "210px 210px", animation: "spin-slow 3.2s linear infinite" }}>
            <line x1={C} y1={C - 62} x2={C} y2={C - R + 8} stroke={imminent.length ? "#ff5c5c" : "#3ddc97"} strokeWidth="1.4" opacity="0.55" />
            <circle cx={C} cy={C - R} r={imminent.length ? 6 : 4} fill={imminent.length ? "#ff5c5c" : "#3ddc97"}>
              {imminent.length > 0 && (
                <animate attributeName="opacity" values="1;0.25;1" dur="0.7s" repeatCount="indefinite" />
              )}
            </circle>
            <circle cx={C} cy={C - R} r={9} fill="none" stroke={imminent.length ? "#ff5c5c" : "#3ddc97"} opacity="0.4" />
          </g>
          <text x={C} y={30} textAnchor="middle" fontSize="8" letterSpacing="0.22em" fill={imminent.length ? "#ff5c5c" : "#3ddc97"} opacity="0.85">
            MONITOR THREAD · scans every {snap.t % 10 === 0 ? 10 : 10} ms
          </text>
        </g>

        {/* ---- wait-for graph (deadlock overlay) ---- */}
        <g className={`dim-able ${op("arrows")}`}>
          {cycleEdges.map((e) => {
            const a = pos(e.from, n);
            const b = pos(e.to, n);
            const mx = (a.x + b.x) / 2 + (C - (a.x + b.x) / 2) * 0.45;
            const my = (a.y + b.y) / 2 + (C - (a.y + b.y) / 2) * 0.45;
            return (
              <motion.path
                key={`wfg-${e.from}-${e.to}`}
                d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                fill="none"
                stroke="#ff5c5c"
                strokeWidth="2"
                markerEnd="url(#arrowRed)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0.55, 1, 0.55] }}
                transition={{ pathLength: { duration: 0.6, ease: "easeOut" }, opacity: { duration: 1.1, repeat: Infinity } }}
              />
            );
          })}
          {snap.deadlock.length > 1 && (
            <motion.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <rect x={C - 92} y={C + 40} width={184} height={22} fill="rgba(255,92,92,0.12)" stroke="#ff5c5c" />
              <text x={C} y={C + 55} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono" fill="#ff5c5c" letterSpacing="0.1em">
                ⦿ {snap.deadlock.map((d) => d + 1).join(" → ")} → {snap.deadlock[0] + 1}
              </text>
            </motion.g>
          )}
        </g>

        {/* ---- dongles ---- */}
        <g className={`dim-able ${op("dongles")}`}>
          {snap.dongles.map((d) => {
            const p = pos(d.idx + 0.5, n, R);
            const st = dongleState(d);
            const col = DONGLE_COLORS[st];
            const coolFrac = st === "cooling" ? Math.max(0, Math.min(1, (d.coolingUntil - snap.t) / 600)) : 0;
            return (
              <g
                key={`d-${d.idx}`}
                transform={`translate(${p.x},${p.y})`}
                className="cursor-pointer"
                onClick={() => onSelect("dongle", d.idx)}
              >
                {st === "available" && <circle r={17} fill="none" stroke={col} opacity="0.16" strokeWidth="6" />}
                {st === "cooling" && (
                  <circle
                    r={19} fill="none" stroke={col} strokeWidth="2.4" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 19}`}
                    strokeDashoffset={`${2 * Math.PI * 19 * (1 - coolFrac)}`}
                    transform="rotate(-90)" opacity="0.9"
                  />
                )}
                {d.waiters.length > 1 && (
                  <circle className="contend-pulse" r={16} fill="none" stroke="#ffc53d" strokeWidth="1.4" />
                )}
                <rect x={-15} y={-10} width={30} height={20} rx={3} fill={`${col}22`} stroke={col} strokeWidth="1.6" />
                <rect x={-7.5} y={-4.5} width={3.6} height={2.6} fill={col} opacity={0.85} />
                <rect x={-7.5} y={1.9} width={3.6} height={2.6} fill={col} opacity={0.85} />
                <text x={5} y={3.4} textAnchor="middle" fontSize="8.5" fontFamily="IBM Plex Mono" fill={col}>
                  D{d.idx}
                </text>
                {st === "cooling" && (
                  <text y={31} textAnchor="middle" fontSize="7.5" fontFamily="IBM Plex Mono" fill={col}>
                    {Math.ceil(d.coolingUntil - snap.t)}ms
                  </text>
                )}
                {d.waiters.length > 0 && (
                  <g transform="translate(13,-15)">
                    <rect x={-2} y={-8} width={17} height={11} fill="#0b1117" stroke="#ffc53d" strokeWidth="0.8" />
                    <text x={6.5} y={0.5} textAnchor="middle" fontSize="7.5" fontFamily="IBM Plex Mono" fill="#ffc53d">
                      ×{d.waiters.length}
                    </text>
                  </g>
                )}
                <title>{`D${d.idx} — ${st}${d.holder >= 0 ? ` · held by ${snap.coders[d.holder].name}` : ""}${d.waiters.length ? ` · wanted by ${d.waiters.map((w) => snap.coders[w].name).join(", ")}` : ""} (click to inspect)`}</title>
              </g>
            );
          })}
        </g>

        {/* ---- held beams (red = in use, identity core = who holds it) ---- */}
        <g className={`dim-able ${op("dongles")}`}>
          {snap.coders.map((c) => {
            const cp = pos(c.id, n);
            return c.held.map((di) => {
              const dp = pos(di + 0.5, n, R);
              return (
                <motion.g key={`beam-${c.id}-${di}-${c.phaseSince}`}>
                  <motion.line
                    x1={cp.x} y1={cp.y}
                    initial={{ x2: cp.x, y2: cp.y, opacity: 0 }}
                    animate={{ x2: dp.x, y2: dp.y, opacity: 0.5 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    stroke="#ff5c5c" strokeWidth="5" strokeLinecap="round"
                  />
                  <motion.line
                    x1={cp.x} y1={cp.y}
                    initial={{ x2: cp.x, y2: cp.y }}
                    animate={{ x2: dp.x, y2: dp.y }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    stroke={identColor(c.id)} strokeWidth="1.8" strokeLinecap="round"
                  />
                </motion.g>
              );
            });
          })}
          {/* reaching arms */}
          {snap.coders.map((c) => {
            if (c.wanting < 0 || c.held.includes(c.wanting)) return null;
            const cp = pos(c.id, n);
            const dp = pos(c.wanting + 0.5, n, R);
            return (
              <line
                key={`reach-${c.id}`}
                className="reach"
                x1={cp.x} y1={cp.y} x2={dp.x} y2={dp.y}
                stroke="#8ca3b5" strokeWidth="1.6" opacity="0.75"
              />
            );
          })}
        </g>

        {/* ---- coders ---- */}
        <g className={`dim-able ${op("coders")}`}>
          {snap.coders.map((c) => {
            const p = pos(c.id, n);
            const stateCol =
              c.phase === "think"
                ? THINK_COLORS[c.thinkKind as "debug" | "refactor"]
                : c.phase === "wait" ? "#8ca3b5"
                : c.phase === "compile" ? "#3ddc97"
                : c.phase === "cooldown" ? "#ff8a3d"
                : "#ff5c5c";
            const inCycle = snap.deadlock.includes(c.id);
            return (
              <g key={`c-${c.id}`} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onClick={() => onSelect("coder", c.id)}>
                {/* state light */}
                {c.phase === "compile" && (
                  <motion.circle r={26} fill="none" stroke="#3ddc97" strokeWidth="2"
                    animate={{ opacity: [0.9, 0.25, 0.9], scale: [1, 1.14, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
                )}
                {c.phase === "wait" && (
                  <motion.circle r={26} fill="none" stroke="#8ca3b5" strokeWidth="1.6"
                    animate={{ opacity: [0.3, 0.85, 0.3] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
                )}
                {c.phase === "burnout" && (
                  <motion.circle r={26} fill="none" stroke="#ff5c5c" strokeWidth="2.4"
                    initial={{ opacity: 1, scale: 1.3 }}
                    animate={{ opacity: [1, 0.4], scale: 1 }}
                    transition={{ duration: 0.6 }} />
                )}
                <circle r={23} fill="#0e161e" stroke={inCycle ? "#ff5c5c" : stateCol} strokeWidth={inCycle ? 2.6 : 1.8} />
                <text y={-1} textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="Space Grotesk" fill={stateCol} letterSpacing="0.08em">
                  {c.phase === "think" ? (c.thinkKind === "debug" ? "DBG" : "RFC") : c.phase === "wait" ? "WAIT" : c.phase === "compile" ? "CMP" : c.phase === "cooldown" ? "CLD" : "BRN"}
                </text>
                <text y={10.5} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono" fill="#8ca3b5">
                  T{c.id + 1} · {c.name}
                </text>
                <text y={40} textAnchor="middle" fontSize="8.5" fontFamily="IBM Plex Mono" fill={identColor(c.id)}>
                  {c.held.length === 2 ? `D${c.held[0]}+D${c.held[1]}` : c.wanting >= 0 ? `→ D${c.wanting}` : `E ${Math.round(c.energy)}`}
                </text>
                {c.phase === "burnout" && (
                  <path d="M-8 -8 8 8 M8 -8 -8 8" stroke="#ff5c5c" strokeWidth="2" opacity="0.9" />
                )}
                <title>{`${c.name} (thread T${c.id + 1}) — ${c.phase} · energy ${Math.round(c.energy)} · compiles ${c.compiles} · misses ${c.misses} (click to inspect)`}</title>
              </g>
            );
          })}
        </g>

        {/* ---- deadline radars ---- */}
        <g className={`dim-able ${op("radars")}`}>
          {snap.coders.map((c) => {
            if (!isFinite(c.deadline)) return null;
            const p = pos(c.id, n);
            const total = 2600;
            const frac = Math.max(0, Math.min(1, (c.deadline - snap.t) / total));
            const col = frac > 0.5 ? "#3ddc97" : frac > 0.22 ? "#ffc53d" : "#ff5c5c";
            const r0 = 31;
            const a0 = -90;
            const a1 = -90 + 360 * frac;
            const rad = (d: number) => (d * Math.PI) / 180;
            const x0 = p.x + r0 * Math.cos(rad(a0));
            const y0 = p.y + r0 * Math.sin(rad(a0));
            const x1 = p.x + r0 * Math.cos(rad(a1));
            const y1 = p.y + r0 * Math.sin(rad(a1));
            const large = a1 - a0 > 180 ? 1 : 0;
            return (
              <g key={`rad-${c.id}`}>
                <circle cx={p.x} cy={p.y} r={r0} fill="none" stroke="#243644" strokeWidth="2" opacity="0.5" />
                {frac > 0.004 && (
                  <motion.path
                    d={`M ${x0} ${y0} A ${r0} ${r0} 0 ${large} 1 ${x1} ${y1}`}
                    fill="none" stroke={col} strokeWidth="2.6" strokeLinecap="round"
                    animate={frac <= 0.22 ? { opacity: [1, 0.35, 1] } : { opacity: 0.95 }}
                    transition={frac <= 0.22 ? { duration: 0.7, repeat: Infinity } : { duration: 0.4 }}
                  />
                )}
                <text x={p.x} y={p.y - 38} textAnchor="middle" fontSize="7.5" fontFamily="IBM Plex Mono" fill={col}>
                  {Math.max(0, Math.round(c.deadline - snap.t))}ms
                </text>
              </g>
            );
          })}
        </g>

        {/* ---- quantum compiler (center, visually secondary) ---- */}
        <g opacity="0.85">
          <g style={{ transformOrigin: "210px 200px", animation: "spin-slow 14s linear infinite" }}>
            <circle cx={C} cy={200} r={30} fill="none" stroke="#243644" strokeWidth="1" strokeDasharray="3 6" />
          </g>
          <g style={{ transformOrigin: "210px 200px", animation: "spin-slow 22s linear infinite reverse" }}>
            <circle cx={C} cy={200} r={22} fill="none" stroke="#1a2733" strokeWidth="1" strokeDasharray="2 5" />
          </g>
          <text x={C} y={197} textAnchor="middle" fontSize="7.5" letterSpacing="0.26em" fill="#5c7488">QUANTUM</text>
          <text x={C} y={207} textAnchor="middle" fontSize="7.5" letterSpacing="0.26em" fill="#5c7488">COMPILER</text>
          <text x={C} y={228} textAnchor="middle" fontSize="8.5" fontFamily="IBM Plex Mono" fill="#8ca3b5">
            tick {snap.tick}
          </text>
        </g>
      </svg>

      {/* legend */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-[8.5px] tracking-wider text-ink-400">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2" style={{ background: DONGLE_COLORS.available }} /> AVAILABLE</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2" style={{ background: DONGLE_COLORS.inuse }} /> HELD</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2" style={{ background: DONGLE_COLORS.cooling }} /> COOLDOWN</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: "#8ca3b5" }} /> WAITING</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: "#3ddc97" }} /> COMPILING</span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="#3ddc97" strokeWidth="2" strokeDasharray="22 10" /></svg>
          DEADLINE RADAR
        </span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#3ddc97]" /> MONITOR</span>
      </div>
    </div>
  );
}
