import type { ReactNode } from "react";
import type { Phase } from "../sim/engine";

/* per-coder identity hues (stable across panels) */
export const IDENT = [
  "#4cc9f0", "#3ddc97", "#ffc53d", "#ff8a3d",
  "#9db8cc", "#d8c34a", "#7fd8c9", "#e8a0a0",
];
export const identColor = (id: number) => IDENT[id % IDENT.length];

/* ---------------- semantic colors ---------------- */

export const PHASE_META: Record<Phase, { label: string; color: string; dim: string }> = {
  think: { label: "think", color: "#7c93a6", dim: "rgba(124,147,166,0.16)" },
  wait: { label: "wait", color: "#ffc53d", dim: "rgba(255,197,61,0.16)" },
  compile: { label: "compile", color: "#3ddc97", dim: "rgba(61,220,151,0.16)" },
  cooldown: { label: "cooldown", color: "#4cc9f0", dim: "rgba(76,201,240,0.16)" },
  burnout: { label: "burnout", color: "#ff5c5c", dim: "rgba(255,92,92,0.16)" },
};

export const DONGLE_COLORS = {
  available: "#4cc9f0",
  inuse: "#ff5c5c",
  cooling: "#ffc53d",
};

export const EVENT_COLORS: Record<string, string> = {
  acquire: "#3ddc97",
  release: "#4cc9f0",
  wait: "#ffc53d",
  signal: "#8ca3b5",
  spurious: "#ff8a3d",
  "compile-start": "#3ddc97",
  miss: "#ff8a3d",
  burnout: "#ff5c5c",
  deadlock: "#ff5c5c",
  rollback: "#ff8a3d",
  recover: "#7c93a6",
};

/* ---------------- panel with module toggle ---------------- */

export function Panel({
  code,
  title,
  enabled,
  onToggle,
  accent = "#4cc9f0",
  right,
  children,
  className = "",
  offlineNote,
}: {
  code: string;
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  accent?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  offlineNote?: string;
}) {
  return (
    <section
      className={`relative border border-ink-700 bg-ink-900/80 ${className}`}
      style={{ boxShadow: enabled ? `inset 0 1px 0 rgba(232,240,246,0.04)` : "none" }}
    >
      <header className="flex items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span
          className="px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em]"
          style={{ color: accent, background: `${accent}14`, border: `1px solid ${accent}44` }}
        >
          {code}
        </span>
        <h2 className="font-display text-[13px] font-semibold tracking-wide text-ink-100">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {right}
          <ModuleSwitch on={enabled} onChange={onToggle} />
        </div>
      </header>
      {enabled ? (
        <div className="flicker-in">{children}</div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3 text-[10px] tracking-wider text-ink-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-600" />
          MODULE OFFLINE — {offlineNote ?? "simulation core continues unaffected"}
        </div>
      )}
    </section>
  );
}

export function ModuleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="group flex items-center gap-1.5"
      title={on ? "module online — click to detach" : "module offline — click to attach"}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "led-on" : ""}`}
        style={{ background: on ? "#3ddc97" : "#3a4c5c", color: "#3ddc97" }}
      />
      <span
        className="relative inline-flex h-[14px] w-[26px] items-center border transition-colors"
        style={{
          borderColor: on ? "#3ddc9766" : "#243644",
          background: on ? "rgba(61,220,151,0.12)" : "#0b1117",
        }}
      >
        <span
          className="absolute h-[8px] w-[10px] transition-all duration-200"
          style={{
            left: on ? "13px" : "2px",
            background: on ? "#3ddc97" : "#5c7488",
          }}
        />
      </span>
    </button>
  );
}

/* ---------------- segmented control ---------------- */

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex border border-ink-600 bg-ink-900">
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`${size === "sm" ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-1 text-[11px]"} font-medium tracking-wide transition-colors ${
            i > 0 ? "border-l border-ink-600" : ""
          }`}
          style={
            o.value === value
              ? { background: "rgba(76,201,240,0.14)", color: "#4cc9f0" }
              : { color: "#8ca3b5" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CheckChip({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center gap-1.5 border px-2 py-1 text-[10px] tracking-wide transition-colors"
      style={{
        borderColor: on ? "#ff8a3d66" : "#243644",
        color: on ? "#ff8a3d" : "#5c7488",
        background: on ? "rgba(255,138,61,0.08)" : "transparent",
      }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
        {on && <path d="M1.5 5.5 4 8l4.5-6" stroke="currentColor" strokeWidth="1.6" fill="none" />}
      </svg>
      {label}
    </button>
  );
}

/* ---------------- transport glyphs (inline SVG) ---------------- */

const g = { fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;

export const PlayGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
    <path d="M3.5 2.2 11.5 7 3.5 11.8Z" fill="currentColor" />
  </svg>
);
export const PauseGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
    <path d="M4.2 2.5v9M9.8 2.5v9" {...g} strokeWidth={2.2} />
  </svg>
);
export const StepGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
    <path d="M2.8 2.5 8.5 7l-5.7 4.5Z" fill="currentColor" />
    <path d="M11.2 2.5v9" {...g} strokeWidth={2} />
  </svg>
);
export const ResetGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
    <path d="M11.5 7a4.5 4.5 0 1 1-1.4-3.25" {...g} />
    <path d="M10.5 1.4v2.6H7.9" {...g} />
  </svg>
);
export const DiceGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
    <rect x="1.8" y="1.8" width="10.4" height="10.4" {...g} />
    <circle cx="4.9" cy="4.9" r="1" fill="currentColor" />
    <circle cx="9.1" cy="9.1" r="1" fill="currentColor" />
    <circle cx="9.1" cy="4.9" r="1" fill="currentColor" />
    <circle cx="4.9" cy="9.1" r="1" fill="currentColor" />
  </svg>
);

export function TransportBtn({
  onClick,
  children,
  label,
  primary = false,
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 items-center justify-center border transition-all active:translate-y-px"
      style={{
        width: primary ? 44 : 32,
        borderColor: primary ? "#3ddc9766" : "#243644",
        background: primary ? "rgba(61,220,151,0.12)" : "#0e161e",
        color: primary ? "#3ddc97" : "#8ca3b5",
      }}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, color = "#e8f0f6" }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.16em] text-ink-400">{label}</span>
      <span className="font-display text-[15px] font-semibold leading-tight" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
