"use client";

import {
  Page,
  Section,
  Text,
  Callout,
  Segmented,
  Button,
  Table,
  Steps,
  LinkCards,
  Metrics,
  Toggle,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// The helix trajectory is the paper's Figure 1, shortened. Demo 3 is a toy sampler.
// Every other number is from Tables 1–5 of arXiv v3. Figure 3 is described without scores.

const VIDEOS = [
  {
    file: "ThoughtActObserve.mp4",
    title: "Think, act, observe, repeat",
    caption:
      "Figure 1: the Apple Remote question, solved in four Thought → Action → Observation steps. Standard, chain-of-thought, and act-only all get it wrong.",
  },
  {
    file: "FourWaysCompared.mp4",
    title: "Seven methods on HotpotQA and FEVER",
    caption: "Table 1, PaLM-540B prompting. Best: ReAct → CoT-SC at 35.1 exact match on HotpotQA, and CoT-SC → ReAct at 64.6 accuracy on FEVER.",
  },
  {
    file: "DecisionMaking.mp4",
    title: "A text house and an online shop",
    caption: "ALFWorld success, Table 3: ReAct best 71, BUTLER 37. WebShop success, Table 4: ReAct 40.0, imitation learning 29.1.",
  },
];

const TRAIL = [
  {
    thought: "I need to search Apple Remote and find the program it was originally designed to interact with.",
    action: "Search[Apple Remote]",
    observation: "The Apple Remote was originally designed to control the Front Row media center program.",
  },
  {
    thought: "Apple Remote was designed for Front Row. I need to search Front Row next.",
    action: "Search[Front Row]",
    observation: "Could not find [Front Row]. Similar: Front Row (software), Front Row Seat to Earth, Front Row Motorsports.",
  },
  {
    thought: "Front Row is not found. I need to search Front Row (software).",
    action: "Search[Front Row (software)]",
    observation: "Front Row is a discontinued media center, controlled by an Apple Remote or the keyboard function keys.",
  },
  {
    thought: "So the other device is the keyboard function keys.",
    action: "Finish[keyboard function keys]",
    observation: "Correct.",
  },
];

const PHASES = [
  { name: "Thought", color: 0xa78bfa },
  { name: "Action", color: 0xfb923c },
  { name: "Observation", color: 0x38bdf8 },
];

const MODES = {
  Standard: {
    lines: ["Question, then an answer from memory, with no lookup."],
    answer: "iPod",
    ok: false,
    note: "No working and no lookup. The guess from memory is wrong.",
  },
  "CoT only": {
    lines: ["Thought: the Apple Remote was designed for Apple TV, which an iPhone, iPad, or iPod Touch can control."],
    answer: "iPhone, iPad, iPod Touch",
    ok: false,
    note: "The reasoning is built on a made-up fact. The program was Front Row, not Apple TV.",
  },
  "Act only": {
    lines: ["Search[Apple Remote]", "Search[Front Row]", "Search[Front Row (software)]"],
    answer: "Finish[yes]",
    ok: false,
    note: "It found the right pages. Without thoughts it never put the facts together.",
  },
  ReAct: {
    lines: TRAIL.map((step) => `Thought → ${step.action}`),
    answer: "Finish[keyboard function keys]",
    ok: true,
    note: "Thoughts steer the searches. The observations keep the reasoning tied to the page.",
  },
} as const;

const RACES: Record<string, { unit: string; rows: { name: string; value: number; color: string }[] }> = {
  HotpotQA: {
    unit: "Exact match, PaLM-540B prompting (Table 1)",
    rows: [
      { name: "Standard", value: 28.7, color: "#64748b" },
      { name: "CoT", value: 29.4, color: "#a78bfa" },
      { name: "CoT-SC", value: 33.4, color: "#f472b6" },
      { name: "Act", value: 25.7, color: "#fb923c" },
      { name: "ReAct", value: 27.4, color: "#38bdf8" },
      { name: "CoT-SC → ReAct", value: 34.2, color: "#4ade80" },
      { name: "ReAct → CoT-SC", value: 35.1, color: "#facc15" },
    ],
  },
  FEVER: {
    unit: "Accuracy, PaLM-540B prompting (Table 1)",
    rows: [
      { name: "Standard", value: 57.1, color: "#64748b" },
      { name: "CoT", value: 56.3, color: "#a78bfa" },
      { name: "CoT-SC", value: 60.4, color: "#f472b6" },
      { name: "Act", value: 58.9, color: "#fb923c" },
      { name: "ReAct", value: 60.9, color: "#38bdf8" },
      { name: "CoT-SC → ReAct", value: 64.6, color: "#4ade80" },
      { name: "ReAct → CoT-SC", value: 62.0, color: "#facc15" },
    ],
  },
  ALFWorld: {
    unit: "Success on 134 unseen games (Table 3). Best of the reported runs, except the ReAct average.",
    rows: [
      { name: "BUTLER, trained", value: 37, color: "#64748b" },
      { name: "Act, best of 6", value: 45, color: "#fb923c" },
      { name: "ReAct-IM, best of 6", value: 53, color: "#a78bfa" },
      { name: "ReAct, average", value: 57, color: "#38bdf8" },
      { name: "ReAct, best of 6", value: 71, color: "#4ade80" },
    ],
  },
  WebShop: {
    unit: "Success rate on 500 test instructions (Table 4)",
    rows: [
      { name: "IL+RL, trained", value: 28.7, color: "#64748b" },
      { name: "IL, trained", value: 29.1, color: "#94a3b8" },
      { name: "Act", value: 30.1, color: "#fb923c" },
      { name: "ReAct", value: 40.0, color: "#4ade80" },
      { name: "Human expert", value: 59.6, color: "#facc15" },
    ],
  },
};

function helixPoint(progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * 2.5, y: -1.5 + progress * 1.05, z: Math.sin(angle) * 2.5 };
}

function Helix({ playing, replay }: { playing: boolean; replay: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ playing, reduced, replay, progress: 0 });
  live.current.playing = playing;
  live.current.reduced = reduced;

  useEffect(() => {
    live.current.progress = reduced ? 4 : 0;
    live.current.replay = replay;
  }, [replay, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelsRef.current;
    if (!canvas || !labelLayer) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1020);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(4, 8, 6);
      scene.add(key);
      scene.add(new THREE.GridHelper(14, 14, 0x243044, 0x1a2433));

      const ghostPositions = new Float32Array(241 * 3);
      for (let index = 0; index <= 240; index += 1) {
        const point = helixPoint((index / 240) * 4);
        ghostPositions[index * 3] = point.x;
        ghostPositions[index * 3 + 1] = point.y;
        ghostPositions[index * 3 + 2] = point.z;
      }
      const ghost = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(ghostPositions, 3)),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 }),
      );
      scene.add(ghost);
      const traveledPositions = ghostPositions.slice();
      const traveled = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(traveledPositions, 3)),
        new THREE.LineBasicMaterial({ color: 0xc4b5fd }),
      );
      traveled.geometry.setDrawRange(0, 1);
      scene.add(traveled);

      const nodes = [0, 1, 2, 3].flatMap((lap) =>
        PHASES.map((phase, phaseIndex) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 16, 12),
            new THREE.MeshStandardMaterial({ color: phase.color, emissive: phase.color, emissiveIntensity: 0.15 }),
          );
          const point = helixPoint(lap + (phaseIndex + 0.5) / 3);
          mesh.position.set(point.x, point.y, point.z);
          scene.add(mesh);
          return mesh;
        }),
      );
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      scene.add(spark);

      const shelf = new THREE.Group();
      for (let book = 0; book < 5; book += 1) {
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 1.1, 0.7),
          new THREE.MeshStandardMaterial({ color: [0x1d4ed8, 0x0369a1, 0x0f766e, 0x7c3aed, 0xb45309][book] }),
        );
        cover.position.set(0, 0.55, (book - 2) * 0.28);
        shelf.add(cover);
      }
      shelf.position.set(5.4, 0, 0);
      scene.add(shelf);
      const page = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.02, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x38bdf8, emissiveIntensity: 0.2 }),
      );
      page.visible = false;
      scene.add(page);
      const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(5.4, 0.8, 0)]);
      const beam = new THREE.Line(beamGeometry, new THREE.LineDashedMaterial({ color: 0x38bdf8, dashSize: 0.15, gapSize: 0.1 }));
      beam.computeLineDistances();
      beam.visible = false;
      scene.add(beam);

      const labelEls = ["Thought", "Action", "Observation"].map((name, index) => {
        const el = document.createElement("div");
        el.textContent = name;
        el.style.cssText = `position:absolute;transform:translate(-50%,-140%);font:600 12px sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000;color:${["#c4b5fd", "#fdba74", "#7dd3fc"][index]}`;
        labelLayer.appendChild(el);
        return el;
      });
      const projector = new THREE.Vector3();
      const project = (x: number, y: number, z: number, el: HTMLDivElement) => {
        projector.set(x, y, z).project(camera);
        if (projector.z > 1) {
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";
        el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };

      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 420;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.55;
      let pitch = 0.42;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.2, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      let seenReplay = live.current.replay;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        if (live.current.replay !== seenReplay) {
          seenReplay = live.current.replay;
          live.current.progress = live.current.reduced ? 4 : 0;
        }
        if (live.current.reduced) live.current.progress = 4;
        else if (live.current.playing) live.current.progress = Math.min(4, live.current.progress + 0.006);
        const progress = live.current.progress;
        traveled.geometry.setDrawRange(0, Math.max(2, Math.floor((progress / 4) * 241)));
        const head = helixPoint(Math.min(progress, 3.999));
        spark.position.set(head.x, head.y, head.z);
        const phase = Math.min(2, Math.floor((progress % 1) * 3));
        nodes.forEach((mesh, index) => {
          const nodeProgress = Math.floor(index / 3) + ((index % 3) + 0.5) / 3;
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.emissiveIntensity = progress >= nodeProgress ? 0.55 : 0.05;
        });
        const acting = phase === 1 && progress < 4;
        const observing = phase === 2 && progress < 4;
        beam.visible = acting;
        page.visible = observing;
        if (observing) {
          const fraction = (progress % 1 - 2 / 3) * 3;
          page.position.set(5.4 + (head.x - 5.4) * fraction, 0.9 + (head.y - 0.9) * fraction, head.z * fraction);
        }
        const positions = beam.geometry.getAttribute("position");
        positions.setXYZ(0, head.x, head.y, head.z);
        positions.needsUpdate = true;
        if (!drag && !live.current.reduced) yaw += 0.003;
        const aspect = Math.max(camera.aspect, 0.5);
        const radius = Math.max(11.5, 6.4 / (Math.tan((42 * Math.PI) / 360) * aspect));
        camera.position.set(Math.sin(yaw) * radius, 1.2 + Math.sin(pitch) * radius * 0.55, Math.cos(yaw) * radius);
        camera.lookAt(0.4, 0.6, 0);
        const currentLap = Math.min(3, Math.floor(progress));
        PHASES.forEach((_, index) => {
          const point = helixPoint(currentLap + (index + 0.5) / 3);
          project(point.x, point.y, point.z, labelEls[index]);
        });
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        labelEls.forEach((el) => el.remove());
        [ghost, traveled, beam].forEach((line) => {
          line.geometry.dispose();
          (line.material as { dispose: () => void }).dispose();
        });
        nodes.forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        spark.geometry.dispose();
        (spark.material as { dispose: () => void }).dispose();
        page.geometry.dispose();
        (page.material as { dispose: () => void }).dispose();
        shelf.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material && "dispose" in mesh.material) (mesh.material as { dispose: () => void }).dispose();
        });
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        aria-label="A helix of four ReAct steps. Each lap is a thought, an action, and an observation. The bookshelf is the Wikipedia tool."
        style={{ width: "100%", height: 420, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#0b1020" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", left: 12, bottom: 12, color: "#cbd5e1", fontSize: 12, pointerEvents: "none" }}>
        Purple thought, orange action, blue observation. Drag to orbit.
      </div>
    </div>
  );
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function toyOutcomes(mode: string, memory: number, run: number) {
  const random = rng(77 + run * 31 + Math.round(memory * 100));
  const outcomes: number[] = [];
  for (let index = 0; index < 100; index += 1) {
    const first = random();
    const second = random();
    if (mode === "CoT only") outcomes.push(first < memory ? 0 : 1);
    else if (mode === "Act only") outcomes.push(first < 0.8 && second < 0.45 ? 0 : 2);
    else outcomes.push(first < 0.8 && second < 0.85 ? 0 : 2);
  }
  return outcomes;
}

function ToyField({ mode, memory, run }: { mode: string; memory: number; run: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const outcomes = useMemo(() => toyOutcomes(mode, memory, run), [mode, memory, run]);
  const live = useRef({ outcomes, reduced, shown: 0 });
  live.current.outcomes = outcomes;
  live.current.reduced = reduced;

  useEffect(() => {
    live.current.shown = reduced ? 100 : 0;
  }, [outcomes, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    const draw = () => {
      if (dead) return;
      if (!live.current.reduced) live.current.shown = Math.min(100, live.current.shown + 1.4);
      const shown = live.current.shown;
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < 100; index += 1) {
        const x = 36 + (index % 20) * ((canvas.width - 72) / 19);
        const y = 28 + Math.floor(index / 20) * 32;
        const outcome = live.current.outcomes[index];
        context.fillStyle = index >= shown ? "rgba(255,255,255,0.12)" : outcome === 0 ? "#4ade80" : outcome === 1 ? "#f87171" : "#fbbf24";
        context.beginPath();
        context.arc(x, y, 8, 0, Math.PI * 2);
        context.fill();
      }
      if (shown < 100) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [outcomes]);

  const counts = outcomes.reduce(
    (total, outcome) => {
      if (outcome === 0) total.right += 1;
      else if (outcome === 1) total.hallucinated += 1;
      else total.stuck += 1;
      return total;
    },
    { right: 0, hallucinated: 0, stuck: 0 },
  );
  return (
    <div>
      <canvas ref={canvasRef} width={900} height={190} aria-label="Toy field of 100 questions. Green is right, red is a hallucinated fact, amber is stuck." style={{ width: "100%", borderRadius: 12, display: "block", background: "#0b1020" }} />
      <Metrics
        metrics={[
          { label: "Right", value: String(counts.right), tone: "success" },
          { label: "Hallucinated a fact", value: String(counts.hallucinated), tone: counts.hallucinated ? "danger" : undefined },
          { label: "Stuck or could not combine", value: String(counts.stuck) },
        ]}
      />
    </div>
  );
}

function Race({ task, replay }: { task: string; replay: number }) {
  const reduced = useReducedMotion();
  const [grow, setGrow] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      setGrow(1);
      return;
    }
    setGrow(0);
    const id = window.setTimeout(() => setGrow(1), 40);
    return () => window.clearTimeout(id);
  }, [task, replay, reduced]);
  const race = RACES[task];
  const max = Math.max(...race.rows.map((row) => row.value), 75);
  return (
    <svg width="100%" viewBox="0 0 760 300" role="img" aria-label={`${task} results. ${race.unit}`} style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      {race.rows.map((row, index) => {
        const y = 16 + index * (268 / race.rows.length);
        const width = grow ? (row.value / max) * 430 : 0;
        return (
          <g key={row.name}>
            <text x={250} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">
              {row.name}
            </text>
            <rect x={262} y={y} height={18} rx={4} fill={row.color} width={width}>
              {reduced ? null : <animate attributeName="width" from="0" to={(row.value / max) * 430} dur={`${0.7 + index * 0.08}s`} fill="freeze" />}
            </rect>
            <text x={270 + (row.value / max) * 430} y={y + 14} fill="#ffffff" fontSize="12">
              {Number.isInteger(row.value) ? row.value : row.value.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const SUCCESS_ROWS = [
  ["True positive: right answer, sound facts and reasoning", "94%", "86%"],
  ["False positive: right answer, hallucinated trace or facts", "6%", "14%"],
];
const FAILURE_ROWS = [
  ["Reasoning error, including repeating itself", "47%", "16%"],
  ["Search result error", "23%", "—"],
  ["Hallucination", "0%", "56%"],
  ["Label ambiguity", "29%", "28%"],
];

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video src={`/videos/16-react/${file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "What does ReAct add to a language-model agent?",
    options: [
      "A bigger model",
      "Interleaved thoughts and real actions, reading each observation before the next step",
      "Training with reinforcement learning",
      "A majority vote over many answers",
    ],
    answer: 1,
    why: "ReAct is prompting only. The model writes a thought, takes an action, reads the observation, and repeats. Voting is self-consistency.",
  },
  {
    q: "In the HotpotQA error study (Table 2), what is chain-of-thought's biggest failure mode?",
    options: ["The search returned nothing", "Hallucinated facts or reasoning, 56% of its failures", "Label ambiguity", "Running out of steps"],
    answer: 1,
    why: "Chain-of-thought cannot check a fact. Hallucination was 0% of ReAct's failures. Chain-of-thought also had more false-positive successes, 14% versus 6%.",
  },
  {
    q: "Why did act-only do worse than ReAct even though it can search the same Wikipedia?",
    options: [
      "Its searches were blocked",
      "Without thoughts it cannot plan, track progress, or put the findings together",
      "It used a smaller model",
      "It was given fewer examples",
    ],
    answer: 1,
    why: "In Figure 1, act-only finds the right pages and then answers \"yes\". Same model, and the example trajectories with the thoughts removed.",
  },
  {
    q: "On HotpotQA, plain ReAct (27.4) was slightly below chain-of-thought (29.4). What worked best?",
    options: [
      "More Wikipedia actions",
      "Combining ReAct with self-consistency and switching when one is unsure or stuck (35.1 HotpotQA, 64.6 FEVER)",
      "Standard prompting",
      "Removing the lookup action",
    ],
    answer: 1,
    why: "ReAct → CoT-SC is best on HotpotQA at 35.1 exact match. CoT-SC → ReAct is best on FEVER at 64.6 accuracy. That is internal knowledge plus external facts.",
  },
  {
    q: "On ALFWorld, how did ReAct prompted with two examples compare with BUTLER, trained on 100,000 expert trajectories per task type?",
    options: ["Much worse", "About the same", "Much better: 71% versus 37% success on the best trials", "They were not compared"],
    answer: 2,
    why: "The gap is 34 points. Even the worst ReAct trial, 48%, beat the best act-only trial, 45%, and the best BUTLER trial, 37%.",
  },
];

export default function App() {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  const [replay, setReplay] = useState(0);
  const [mode, setMode] = useState<keyof typeof MODES>("ReAct");
  const [toyMode, setToyMode] = useState("ReAct");
  const [memory, setMemory] = useState("60%");
  const [toyRun, setToyRun] = useState(0);
  const [task, setTask] = useState("HotpotQA");
  const [raceRun, setRaceRun] = useState(0);
  const [showFailures, setShowFailures] = useState(false);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const chosen = MODES[mode];

  return (
    <Page
      title="ReAct: think a step, take an action, then read what comes back"
      summary="Paper #16 · Yao, Zhao, Yu, Du, Shafran, Narasimhan, Cao · Princeton and Google Research · ICLR 2023 · arXiv 2210.03629"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        Let the model take turns. It writes a thought, takes a real action such as a Wikipedia search, reads what comes back, and thinks again, so the plan is checked against the world.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          Chain-of-thought (paper #14) got large models to show their working, and self-consistency (paper #15) made that working more reliable by voting. Both still happen inside the model. When it needs a fact it does not know, it invents one and keeps going. GPT-3 (paper #8) had shown that a few examples in the prompt can set the style of the answer. ReAct uses that same trick for a style that includes tool calls.
        </Text>
        <Text>
          A thought changes nothing outside the model. It adds a plan, a extracted fact, or a correction to the context. An action, such as search[entity], lookup[string], or finish[answer], does change the world and returns an observation. On question answering the prompt makes them alternate. On longer games the model decides when a thought is worth writing. The model is a frozen PaLM-540B. HotpotQA uses six hand-written trajectories and FEVER uses three. Nothing is trained for those prompting results.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: the Thought, Action, Observation helix" caption="Each lap is one step of the Apple Remote trajectory in Figure 1. The bookshelf is the Wikipedia tool. Drag to orbit.">
        <Helix playing={playing} replay={replay} />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <Button label={playing ? "Pause" : "Play"} variant="primary" onClick={() => setPlaying((value) => !value)} />
          <Button
            label="Replay"
            onClick={() => {
              setReplay((value) => value + 1);
              setPlaying(true);
            }}
          />
        </div>
        <Text>
          Aside from the Apple Remote, what other device can control the program the Apple Remote was originally designed to interact with? The helix climbs through four searches and ends at keyboard function keys.
        </Text>
        <Steps
          steps={TRAIL.map((step, index) => ({
            title: `Step ${index + 1}`,
            detail: `${step.thought} ${step.action} Observation: ${step.observation}`,
          }))}
        />
      </Section>

      <Section heading="Demo 2: the same question, four ways" caption="The four answers are the ones in Figure 1.">
        <Segmented options={["Standard", "CoT only", "Act only", "ReAct"]} value={mode} onChange={(value) => setMode(value as keyof typeof MODES)} />
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, background: "#0b1020", color: "#e2e8f0", padding: 14, borderRadius: 12, margin: "10px 0" }}>
          {chosen.lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div style={{ marginTop: 8, color: chosen.ok ? "#4ade80" : "#f87171" }}>
            Answer: {chosen.answer} {chosen.ok ? "✓" : "✗"}
          </div>
        </div>
        <Callout tone={chosen.ok ? "success" : "warning"}>{chosen.note}</Callout>
      </Section>

      <Section heading="Demo 3: a toy hallucination simulator" caption="Toy data, not the paper. One hundred made-up questions. Green is right, red is a made-up fact, amber is stuck or unable to combine the facts.">
        <Text>
          The toy rule: chain-of-thought is right only when its memory of the fact is right, and otherwise it invents one. Act-only and ReAct find the page 80% of the time. Act-only then combines the facts correctly 45% of the time, ReAct 85% of the time. A failed search leaves the agent stuck. Those probabilities are made up so the mechanism is easy to see.
        </Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          <Segmented
            options={["CoT only", "Act only", "ReAct"]}
            value={toyMode}
            onChange={(value) => {
              setToyMode(value);
              setToyRun((count) => count + 1);
            }}
          />
          <Segmented
            options={["30%", "60%", "90%"]}
            value={memory}
            onChange={(value) => {
              setMemory(value);
              setToyRun((count) => count + 1);
            }}
          />
        </div>
        <p className="viz-note">The memory setting is how often the model already knows the fact. It only changes the chain-of-thought toy.</p>
        <ToyField mode={toyMode} memory={Number.parseInt(memory, 10) / 100} run={toyRun} />
      </Section>

      <Section heading="Demo 4: the paper's results" caption={RACES[task].unit}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <Segmented
            options={["HotpotQA", "FEVER", "ALFWorld", "WebShop"]}
            value={task}
            onChange={(value) => {
              setTask(value);
              setRaceRun((count) => count + 1);
            }}
          />
          <Button label="Replay" onClick={() => setRaceRun((count) => count + 1)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <Race task={task} replay={raceRun} />
        </div>
        <Text>
          On ALFWorld the best ReAct trial is 71% against 45% for act-only and 37% for BUTLER, which trained on 10^5 expert trajectories per task type. On WebShop, ReAct&apos;s success rate is 40.0% against 29.1% for imitation learning and 28.7% for imitation plus reinforcement learning. Human experts reach 59.6%. WebShop scores, a separate Table 4 column, are 66.6 for ReAct, 62.3 for act-only, 59.9 for imitation learning, and 82.1 for the human expert.
        </Text>
      </Section>

      <Section heading="Demo 5: where the successes and failures come from" caption="Table 2. People labelled 50 correct and 50 incorrect HotpotQA trajectories each for ReAct and for chain-of-thought. The percentages are shares within successes, or within failures, not of all 200 trajectories.">
        <Toggle label={showFailures ? "Showing the failure breakdown" : "Showing the success breakdown"} value={showFailures} onChange={setShowFailures} />
        <Table columns={showFailures ? ["Failure type", "ReAct", "Chain-of-thought"] : ["Success type", "ReAct", "Chain-of-thought"]} rows={showFailures ? FAILURE_ROWS : SUCCESS_ROWS} />
        <Text>
          {showFailures
            ? "Hallucination is 56% of chain-of-thought's failures and 0% of ReAct's. ReAct pays for that grounding with more reasoning errors, including loops, and with searches that return nothing useful (23% of its failures)."
            : "Of the trajectories that got the answer right, 94% of ReAct's had a sound trace against 86% for chain-of-thought. The other successes were right answers sitting on a hallucinated trace."}
        </Text>
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Write a thought", detail: "The thought plans the next lookup, pulls a fact out of the last observation, notices a failed search, or decides it is time to stop. It returns no observation." },
            { title: "Take an action", detail: "On HotpotQA and FEVER the actions are search[entity], lookup[string], and finish[answer]. The Wikipedia API is deliberately simple: the first five sentences, or the next sentence that contains a string." },
            { title: "Read the observation", detail: "The next thought is conditioned on that text. A missing page returns similar titles, which is what lets the model reformulate Front Row as Front Row (software)." },
            { title: "Hand off when stuck", detail: "ReAct → CoT-SC falls back to a 21-sample self-consistency vote if ReAct has no answer in 7 HotpotQA steps or 5 FEVER steps. The other way, a weak majority (fewer than half of the samples) falls back to ReAct." },
          ]}
        />
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "35.1", label: "Best HotpotQA exact match", detail: "ReAct → CoT-SC. CoT-SC alone is 33.4 (Table 1)", tone: "success" },
            { value: "64.6", label: "Best FEVER accuracy", detail: "CoT-SC → ReAct. CoT-SC alone is 60.4 (Table 1)", tone: "success" },
            { value: "71 vs 37", label: "ALFWorld, best ReAct vs BUTLER", detail: "Two prompt trajectories against 10^5 training trajectories (Table 3)" },
            { value: "0% vs 56%", label: "Hallucination's share of failures", detail: "ReAct versus chain-of-thought on HotpotQA (Table 2)" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Grounding removes the main chain-of-thought failure", "Hallucination is 0% of ReAct's HotpotQA failures and 56% of chain-of-thought's. False-positive successes are 6% versus 14% (Table 2)"],
            ["Plain ReAct is not uniformly better than chain-of-thought", "FEVER 60.9 versus 56.3, but HotpotQA exact match 27.4 versus 29.4. Act-only is 25.7 and 58.9 (Table 1)"],
            ["The combination is the best prompted result", "ReAct → CoT-SC reaches 35.1 on HotpotQA. CoT-SC → ReAct reaches 64.6 on FEVER. Both match a 21-sample vote with only 3 to 5 samples in Figure 2"],
            ["Two examples beat a trained household agent", "Best ReAct trial 71%, best act-only 45%, BUTLER 37%. The worst ReAct trial is 48%. The relative gain over act-only across six trials averages 62% (Section 4, Table 3)"],
            ["One example beats trained shoppers on success rate", "WebShop success 40.0 for ReAct, 30.1 for act-only, 29.1 for imitation learning, 28.7 for imitation plus RL, 59.6 for a human expert (Table 4)"],
            ["Thoughts beat inner-monologue prompting", "ReAct 71 versus ReAct-IM 53 on ALFWorld, better on five of the six task types (Table 3)"],
            ["PaLM and GPT-3 are close under the same prompt", "On a 500-question HotpotQA slice, PaLM-540B exact match is 29.4 and GPT-3 text-davinci-002 is 30.8. ALFWorld success is 70.9 versus 78.4 (Table 5)"],
            ["Fine-tuning flips the small-model ranking", "Figure 3 only, with no scores printed in the text: prompted ReAct is the worst of the four methods at 8B and 62B. After fine-tuning on 3,000 correct trajectories it is the best, and the fine-tuned 8B model beats every 62B prompting method, while the fine-tuned 62B model beats every 540B prompting method"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          Prompted ReAct is less flexible than chain-of-thought: it repeats thoughts and actions, and an unhelpful search is 23% of its HotpotQA failures. Complex action spaces need more demonstrations than fit in the context. It is still far below the supervised state of the art on HotpotQA and FEVER (67.5 exact match and 89.5 accuracy, Table 1) and far below human experts on WebShop. It also depends on the search returning something useful.
        </Callout>
      </Section>

      <QuizSync slug="16-react" picks={picks} answers={QUIZ.map((item) => item.answer)} />
      <Section heading="Quick quiz">
        {QUIZ.map((item, index) => (
          <Section key={item.q} heading={`${index + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, optionIndex) => (
                <Button
                  key={option}
                  label={option}
                  variant={picks[index] === optionIndex ? "primary" : "quiet"}
                  onClick={() => setPicks(picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)))}
                />
              ))}
            </div>
            {picks[index] === null ? null : picks[index] === item.answer ? (
              <Callout tone="success" lead="Right.">
                {item.why}
              </Callout>
            ) : (
              <Callout tone="warning" lead="Not quite.">
                {item.why}
              </Callout>
            )}
          </Section>
        ))}
        <Text>In your own words: why does mixing thinking steps with real actions, such as searching Wikipedia, beat thinking alone or acting alone?</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "ReAct: Synergizing Reasoning and Acting in Language Models (abstract)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/abs/2210.03629" },
            { title: "ReAct (PDF)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/pdf/2210.03629" },
            { title: "Project page", site: "react-lm.github.io", date: "2022", href: "https://react-lm.github.io/" },
            { title: "Self-consistency, the vote ReAct hands off to", site: "Papers a Day", date: "2023", href: "/papers/15-self-consistency" },
            { title: "Chain-of-thought prompting, the thoughts without the tools", site: "Papers a Day", date: "2022", href: "/papers/14-chain-of-thought" },
          ]}
        />
      </Section>
    </Page>
  );
}
