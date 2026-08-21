import { useState } from "react";
import { motion } from "framer-motion";
import type { PresetKey } from "../sim/engine";
import type { ConceptId, DrawerTab } from "../sim/derive";

export interface TutorialActions {
  preset?: PresetKey;
  speed?: number;
  focus?: ConceptId | null;
  tab?: DrawerTab;
  drawer?: boolean;
  playing?: boolean;
}

interface Step {
  title: string;
  body: string;
  actions: TutorialActions;
  quiz: { q: string; options: string[]; answer: number; hint: string };
}

const STEPS: Step[] = [
  {
    title: "Read the co-working hub",
    body:
      "Each glowing node is a thread (a coder). The USB icons between them are shared dongles. A gray breathing ring means the coder is blocked, waiting for a dongle. A solid red beam means they HOLD one — two beams and a green pulse means they are compiling. The small green dot orbiting the table is the monitor thread.",
    actions: { preset: "free", speed: 0.5, focus: "threads", playing: true },
    quiz: {
      q: "A coder shows a gray, slowly breathing ring. What is happening?",
      options: ["It is compiling", "It is blocked, waiting for a dongle", "It burned out", "It is refactoring"],
      answer: 1,
      hint: "Breathing gray = parked in a wait queue. Green pulse would be compiling.",
    },
  },
  {
    title: "The mutex: one key at a time",
    body:
      "Open the MUTEXES tab. Every grant decision goes through grant_mutex — the thread holding the key is green-locked, everyone else lines up in the waiting queue with a live wait timer. Unlock hands the key to the head of the line. Watch wait times grow under load: that number IS starvation.",
    actions: { focus: "mutex", tab: "mutexes", drawer: true, speed: 0.5 },
    quiz: {
      q: "A thread calls pthread_mutex_unlock(). Who gets the mutex?",
      options: ["A random waiter", "The thread at the head of the wait queue", "All waiters at once", "Nobody until a new lock call"],
      answer: 1,
      hint: "Unlock wakes exactly one waiter — the first in line.",
    },
  },
  {
    title: "Condition variables: the dormitory",
    body:
      "Waiting coders don't spin — they sleep in the cond-var dormitory. pthread_cond_wait does two things ATOMICALLY: release the mutex, then sleep. When a compile finishes, a broadcast wakes everyone, and each woken thread must re-check the predicate. Trigger the spurious wakeup demo to see why that check is a while(), never an if().",
    actions: { focus: "condvar", tab: "condvars", drawer: true, speed: 0.5 },
    quiz: {
      q: "Why must the condition be checked with while() instead of if()?",
      options: [
        "while() is faster",
        "Spurious wakeups can wake a thread even though nothing changed",
        "if() does not release the mutex",
        "The compiler requires it",
      ],
      answer: 1,
      hint: "The kernel may wake sleepers for no reason — the loop re-validates the world.",
    },
  },
  {
    title: "Deadlock: the circle that never breaks",
    body:
      "Scenario: DEADLOCK TRAP. Everyone grabs their LEFT dongle first, then waits for the RIGHT one. Red curved arrows draw the wait-for graph — when they close into a circle (1→2→3→1), all four Coffman conditions hold and nobody can move. Check the RESOURCE GRAPH tab: four green ticks turn into the deadlock banner. Slow-motion kicks in automatically so you can watch it close.",
    actions: { preset: "deadlock", speed: 0.5, focus: "deadlock", tab: "graph", drawer: true, playing: true },
    quiz: {
      q: "Which of these is NOT one of the four Coffman conditions?",
      options: ["Mutual exclusion", "Hold and wait", "Round-robin scheduling", "Circular wait"],
      answer: 2,
      hint: "The fourth one is 'no preemption'. Scheduling policy is a different topic.",
    },
  },
  {
    title: "EDF: the deadline radar",
    body:
      "The ring around each waiting coder is a deadline radar — it shrinks as burnout approaches and turns green → amber → red. Under FIFO the queue ignores those rings; under EDF the waiters form a binary min-heap keyed by deadline, so the reddest ring is always granted next. Open the PRIORITY QUEUE tab and watch insert / sift-up / extract-min as coders arrive and get served.",
    actions: { preset: "starvation", speed: 0.5, focus: "scheduling", tab: "heap", drawer: true },
    quiz: {
      q: "In the EDF min-heap, which thread sits at the root?",
      options: ["The one that arrived first", "The one with the earliest deadline", "The one holding a dongle", "The monitor thread"],
      answer: 1,
      hint: "Earliest Deadline First — the smallest key wins the root.",
    },
  },
  {
    title: "The monitor thread: 10 ms precision",
    body:
      "deadline = last_compile_start + time_to_burnout. The monitor thread scans every radar once per 10 ms tick. The moment a coder's energy crosses zero, the next scan rescues them and force-releases their dongles — so detection latency Δ is mathematically bounded: 0 ≤ Δ ≤ 10 ms. Open the LOGS tab and check the Δ stamps: every rescue must print ✓.",
    actions: { preset: "burnout", speed: 1, focus: "burnout", tab: "logs", drawer: true },
    quiz: {
      q: "Why can the monitor never be later than 10 ms?",
      options: [
        "Because burnout is predicted in advance",
        "Because it scans once per 10 ms tick, so the worst case is one full scan period",
        "Because coders warn it before burning out",
        "Because the OS prioritizes the monitor thread",
      ],
      answer: 1,
      hint: "Think about the worst case: zero-energy happens right after a scan.",
    },
  },
];

export default function Tutorial({ run, onClose }: { run: (a: TutorialActions) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"read" | "quiz" | "wrong">("read");

  const s = STEPS[step];
  const enter = (i: number) => {
    setStep(i);
    setPhase("read");
    run(STEPS[i].actions);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#070b0fd9] p-4 backdrop-blur-[3px]">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[560px] border border-[#4cc9f044] bg-[#0e161ef5] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <header className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
          <span className="border border-[#4cc9f055] bg-[#4cc9f012] px-1.5 py-0.5 text-[8.5px] font-bold tracking-[0.2em] text-[#4cc9f0]">
            GUIDED TOUR {step + 1}/{STEPS.length}
          </span>
          <span className="font-display text-[15px] font-semibold text-ink-100">{s.title}</span>
          <button onClick={onClose} className="ml-auto text-[9px] tracking-[0.18em] text-ink-400 transition-colors hover:text-ink-100">
            SKIP ✕
          </button>
        </header>

        {/* progress */}
        <div className="flex gap-1 px-4 pt-3">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => enter(i)} className="h-[3px] flex-1 transition-colors" style={{ background: i <= step ? "#4cc9f0" : "#243644" }} />
          ))}
        </div>

        <div className="px-4 py-3.5">
          {phase === "read" ? (
            <>
              <p className="text-[12px] leading-relaxed text-ink-300">{s.body}</p>
              <div className="mt-2 border border-dashed border-ink-600 px-3 py-2 text-[9.5px] tracking-wide text-ink-400">
                👁 the simulation behind this card has been set up for this lesson — you can already see it happening.
              </div>
              <button
                onClick={() => setPhase("quiz")}
                className="mt-3.5 w-full border border-[#3ddc9777] bg-[#3ddc9712] px-3 py-2.5 text-[11px] font-bold tracking-[0.16em] text-[#3ddc97] transition-all hover:bg-[#3ddc9720] active:translate-y-px"
              >
                I SEE IT — QUIZ ME ▸
              </button>
            </>
          ) : (
            <>
              <div className="text-[8.5px] tracking-[0.22em] text-[#ffc53d]">VALIDATION</div>
              <p className="mt-1 text-[13px] font-medium leading-snug text-ink-100">{s.quiz.q}</p>
              <div className="mt-3 space-y-1.5">
                {s.quiz.options.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => (i === s.quiz.answer ? (step < STEPS.length - 1 ? enter(step + 1) : onClose()) : setPhase("wrong"))}
                    className="block w-full border border-ink-600 px-3 py-2 text-left text-[11px] text-ink-300 transition-all hover:border-[#4cc9f077] hover:bg-[#4cc9f00d] hover:text-ink-100 active:translate-y-px"
                  >
                    <span className="mr-2 font-mono text-[#4cc9f0]">{String.fromCharCode(65 + i)}</span>
                    {o}
                  </button>
                ))}
              </div>
              {phase === "wrong" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 border border-[#ff5c5c55] bg-[#ff5c5c0d] px-3 py-2 text-[10px] text-[#ff8a8a]">
                  ✗ not quite — {s.quiz.hint} Try again above.
                </motion.div>
              )}
              {step === STEPS.length - 1 && phase !== "wrong" && (
                <div className="mt-2 text-[9px] text-ink-400">last step — a correct answer completes the tour.</div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
