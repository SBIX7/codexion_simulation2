import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSim,
  stepSim,
  PRESETS,
  PRESET_INFO,
  type PresetKey,
  type Sim,
  type SimConfig,
  type Snapshot,
} from "../sim/engine";

/* History cap: ~90 s of sim at 10 ms ticks; oldest frames trimmed in blocks
   so the scrub window stays bounded without reallocating every tick. */
const MAX_HISTORY = 9000;
const TRIM_TO = 7000;

export interface SimControls {
  cfg: SimConfig;
  preset: PresetKey | null;
  presetInfo: string;
  applyPreset: (k: PresetKey) => void;
  patchCfg: (p: Partial<SimConfig>) => void;
  snap: Snapshot;
  history: Snapshot[];
  idx: number;
  historyLen: number;
  trimmed: number;
  playing: boolean;
  togglePlay: () => void;
  speed: number;
  setSpeed: (v: number) => void;
  stepOnce: () => void;
  scrubTo: (i: number) => void;
  scrubbing: boolean;
  setScrubbing: (b: boolean) => void;
  reroll: () => void;
}

export function useSimulation(): SimControls {
  const [preset, setPreset] = useState<PresetKey | null>("deadlock");
  const [cfg, setCfg] = useState<SimConfig>(() => ({
    ...PRESETS.deadlock,
    seed: 1337,
  }));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [scrubbing, setScrubbing] = useState(false);
  const [, setVersion] = useState(0);

  const simRef = useRef<Sim>(createSim(cfg));
  const histRef = useRef<Snapshot[]>([stepSim(createSim(cfg))]);
  const idxRef = useRef(0);
  const trimmedRef = useRef(0);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const scrubRef = useRef(scrubbing);
  playingRef.current = playing;
  speedRef.current = speed;
  scrubRef.current = scrubbing;

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const advance = useCallback(() => {
    const h = histRef.current;
    if (idxRef.current < h.length - 1) {
      idxRef.current++;
    } else {
      const s = stepSim(simRef.current);
      h.push(s);
      if (h.length > MAX_HISTORY) {
        h.splice(0, h.length - TRIM_TO);
        trimmedRef.current += h.length < 0 ? 0 : MAX_HISTORY - TRIM_TO;
        idxRef.current = h.length - 1;
      } else {
        idxRef.current = h.length - 1;
      }
    }
  }, []);

  /* re-seed / re-config ⇒ fresh deterministic run */
  useEffect(() => {
    simRef.current = createSim(cfg);
    histRef.current = [stepSim(createSim(cfg))];
    idxRef.current = 0;
    trimmedRef.current = 0;
    bump();
  }, [cfg, bump]);

  /* playback loop — rAF accumulator, non-blocking by construction */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (playingRef.current && !scrubRef.current) {
        // speed 1 ⇒ realtime (10 ms sim per 10 ms wall)
        acc += (dt * speedRef.current) / simRef.current.cfg.tickMs;
        const n = Math.min(48, Math.floor(acc));
        acc -= n;
        for (let k = 0; k < n; k++) advance();
        if (n > 0) bump();
      } else {
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [advance, bump]);

  const applyPreset = useCallback((k: PresetKey) => {
    setPreset(k);
    setCfg({ ...PRESETS[k], seed: (Math.random() * 1e9) | 0 });
    setPlaying(true);
  }, []);

  const patchCfg = useCallback((p: Partial<SimConfig>) => {
    setPreset(null);
    setCfg((c) => ({ ...c, ...p }));
  }, []);

  const reroll = useCallback(() => {
    setCfg((c) => ({ ...c, seed: (Math.random() * 1e9) | 0 }));
    setPlaying(true);
  }, []);

  const stepOnce = useCallback(() => {
    setPlaying(false);
    advance();
    bump();
  }, [advance, bump]);

  const scrubTo = useCallback(
    (i: number) => {
      const h = histRef.current;
      idxRef.current = Math.max(0, Math.min(h.length - 1, Math.round(i)));
      bump();
    },
    [bump]
  );

  const h = histRef.current;
  const idx = Math.min(idxRef.current, h.length - 1);

  return {
    cfg,
    preset,
    presetInfo: preset ? PRESET_INFO[preset] : "custom configuration — policy changes restart the run deterministically from a fresh seed",
    applyPreset,
    patchCfg,
    snap: h[idx],
    history: h,
    idx,
    historyLen: h.length,
    trimmed: trimmedRef.current,
    playing,
    togglePlay: () => setPlaying((p) => !p),
    speed,
    setSpeed,
    stepOnce,
    scrubTo,
    scrubbing,
    setScrubbing,
    reroll,
  };
}
