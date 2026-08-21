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
import { CRITICAL_TYPES, findIdxByTime } from "../sim/derive";

/* bounded history: ~100 s of sim at 10 ms ticks */
const MAX_HISTORY = 10000;
const TRIM_TO = 8000;

/* speed detents required by the spec: 0.1 → 10, default 1× */
export const SPEED_DETENTS = [0.1, 0.25, 0.5, 1, 2, 4, 10];
const SLOWMO_SPEED = 0.25;

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
  playing: boolean;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  speed: number;
  setSpeed: (v: number) => void;
  baseSpeed: number;
  stepOnce: () => void;
  stepBack: () => void;
  restart: () => void;
  scrubTo: (i: number) => void;
  jumpToTime: (t: number) => void;
  scrubbing: boolean;
  setScrubbing: (b: boolean) => void;
  reroll: () => void;
  replayLast2s: () => void;
  slowMoArmed: boolean;
  setSlowMoArmed: (v: boolean) => void;
  slowMoActive: boolean;
  atLiveEdge: boolean;
}

export function useSimulation(): SimControls {
  const [preset, setPreset] = useState<PresetKey | null>("deadlock");
  const [cfg, setCfg] = useState<SimConfig>(() => ({ ...PRESETS.deadlock, seed: 1337 }));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeedState] = useState(1); // default 1× per spec
  const [scrubbing, setScrubbing] = useState(false);
  const [slowMoArmed, setSlowMoArmed] = useState(true);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [, setVersion] = useState(0);

  const simRef = useRef<Sim>(createSim(cfg));
  const histRef = useRef<Snapshot[]>([stepSim(createSim(cfg))]);
  const idxRef = useRef(0);

  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const scrubRef = useRef(scrubbing);
  const slowMoArmedRef = useRef(slowMoArmed);
  const slowMoUntilRef = useRef(0);
  const baseSpeedRef = useRef(1);
  const criticalLatchRef = useRef(false);
  playingRef.current = playing;
  speedRef.current = speed;
  scrubRef.current = scrubbing;
  slowMoArmedRef.current = slowMoArmed;

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const engageSlowMo = useCallback(() => {
    if (!slowMoArmedRef.current) return;
    if (slowMoUntilRef.current > performance.now()) return; // already engaged
    baseSpeedRef.current = speedRef.current > SLOWMO_SPEED ? speedRef.current : 1;
    slowMoUntilRef.current = performance.now() + 6000;
    setSpeedState(SLOWMO_SPEED);
    setSlowMoActive(true);
  }, []);

  const advance = useCallback(() => {
    const h = histRef.current;
    if (idxRef.current < h.length - 1) {
      idxRef.current++;
    } else {
      const s = stepSim(simRef.current);
      h.push(s);
      if (h.length > MAX_HISTORY) {
        h.splice(0, h.length - TRIM_TO);
        idxRef.current = h.length - 1;
      } else {
        idxRef.current = h.length - 1;
      }
    }
    const cur = h[idxRef.current];
    // slow-mo on critical events (deadlock / burnout / rollback / miss)
    if (cur.events.some((e) => CRITICAL_TYPES.has(e.type))) {
      if (!criticalLatchRef.current) engageSlowMo();
      criticalLatchRef.current = true;
    } else if (cur.tick % 40 === 0) {
      criticalLatchRef.current = false; // re-arm after quiet period (~400 ms)
    }
  }, [engageSlowMo]);

  /* fresh deterministic run on any config change */
  useEffect(() => {
    simRef.current = createSim(cfg);
    histRef.current = [stepSim(createSim(cfg))];
    idxRef.current = 0;
    criticalLatchRef.current = false;
    bump();
  }, [cfg, bump]);

  /* rAF playback loop */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      // release slow-mo after its window
      if (slowMoUntilRef.current && now > slowMoUntilRef.current) {
        slowMoUntilRef.current = 0;
        setSlowMoActive(false);
        setSpeedState(baseSpeedRef.current);
      }
      if (playingRef.current && !scrubRef.current) {
        const tickMs = simRef.current.cfg.tickMs;
        acc += (dt * speedRef.current) / tickMs;
        const nSteps = Math.min(60, Math.floor(acc));
        acc -= nSteps;
        for (let k = 0; k < nSteps; k++) advance();
        if (nSteps > 0) bump();
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

  const restart = useCallback(() => {
    setCfg((c) => ({ ...c })); // same seed → identical replay from t=0
    setPlaying(true);
  }, []);

  const stepOnce = useCallback(() => {
    setPlaying(false);
    advance();
    bump();
  }, [advance, bump]);

  const stepBack = useCallback(() => {
    setPlaying(false);
    idxRef.current = Math.max(0, idxRef.current - 1);
    bump();
  }, [bump]);

  const scrubTo = useCallback(
    (i: number) => {
      const h = histRef.current;
      idxRef.current = Math.max(0, Math.min(h.length - 1, Math.round(i)));
      bump();
    },
    [bump]
  );

  const jumpToTime = useCallback(
    (t: number) => {
      scrubTo(findIdxByTime(histRef.current, t));
    },
    [scrubTo]
  );

  const replayLast2s = useCallback(() => {
    const h = histRef.current;
    const target = Math.max(0, h.length - 1 - Math.round(2000 / simRef.current.cfg.tickMs));
    setPlaying(false);
    idxRef.current = target;
    bump();
    // start in slow motion, live after ~2 s of sim time
    baseSpeedRef.current = Math.max(speedRef.current, 1);
    slowMoUntilRef.current = performance.now() + 9000;
    setSpeedState(SLOWMO_SPEED);
    setSlowMoActive(true);
    setPlaying(true);
  }, [bump]);

  const setSpeed = useCallback((v: number) => {
    slowMoUntilRef.current = 0;
    setSlowMoActive(false);
    baseSpeedRef.current = v;
    setSpeedState(v);
  }, []);

  const h = histRef.current;
  const idx = Math.min(idxRef.current, h.length - 1);

  return {
    cfg,
    preset,
    presetInfo: preset
      ? PRESET_INFO[preset]
      : "custom configuration — changes restart the run deterministically",
    applyPreset,
    patchCfg,
    snap: h[idx],
    history: h,
    idx,
    historyLen: h.length,
    playing,
    togglePlay: () => setPlaying((p) => !p),
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    speed,
    setSpeed,
    baseSpeed: baseSpeedRef.current,
    stepOnce,
    stepBack,
    restart,
    scrubTo,
    jumpToTime,
    scrubbing,
    setScrubbing,
    reroll,
    replayLast2s,
    slowMoArmed,
    setSlowMoArmed,
    slowMoActive,
    atLiveEdge: idx >= h.length - 1,
  };
}
