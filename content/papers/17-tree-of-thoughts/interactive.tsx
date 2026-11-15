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
  Select,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// Demos 1 and 3 run a real Game of 24 search. The grader is a toy: an exact solver that is wrong at a chosen rate.
// The measured scores below are the paper's (Tables 2, 3, 5 and 7, and Figure 5).

const VIDEOS = [
  {
    file: "ChainVsTree.mp4",
    title: "From a chain to a tree",
    caption:
      "Figure 1: input-output prompting, chain of thought, self-consistency, and Tree of Thoughts, which proposes several thoughts, grades them, prunes dead ends, and backtracks.",
  },
  {
    file: "GameOf24Search.mp4",
    title: "Propose, evaluate, keep the best",
    caption:
      "Breadth-first search on the paper's example 4, 9, 10, 13. Grade each leftover state sure, maybe, or impossible, keep the best, and repeat until 4 × 6 = 24.",
  },
  {
    file: "ResultsAndAblations.mp4",
    title: "What the paper measured",
    caption:
      "Game of 24, Table 2: chain of thought 4% to Tree of Thoughts 74%. Mini crosswords, Table 3: 60% of words versus 15.6%, and removing pruning or backtracking hurts.",
  },
];

const EPS = 1e-6;
const memo = new Map<string, boolean>();
const keyOf = (numbers: number[]) => numbers.map((value) => Math.round(value * 1e5) / 1e5).sort((a, b) => a - b).join(",");

function solvable(numbers: number[]): boolean {
  if (numbers.length === 1) return Math.abs(numbers[0] - 24) < EPS;
  const key = keyOf(numbers);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      const rest = numbers.filter((_, index) => index !== i && index !== j);
      const a = numbers[i];
      const b = numbers[j];
      const results = [a + b, a * b, a - b, b - a];
      if (Math.abs(b) > EPS) results.push(a / b);
      if (Math.abs(a) > EPS) results.push(b / a);
      for (const result of results) {
        if (solvable([...rest, result])) {
          memo.set(key, true);
          return true;
        }
      }
    }
  }
  memo.set(key, false);
  return false;
}

function formatNumber(value: number): string {
  if (Math.abs(value - Math.round(value)) < EPS) return String(Math.round(value));
  for (let denominator = 2; denominator <= 12; denominator += 1) {
    const numerator = value * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < EPS) return `${Math.round(numerator)}/${denominator}`;
  }
  return value.toFixed(2);
}

type Move = { nums: number[]; eq: string };

function moves(numbers: number[]): Move[] {
  const output: Move[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < numbers.length; i += 1) {
    for (let j = i + 1; j < numbers.length; j += 1) {
      const rest = numbers.filter((_, index) => index !== i && index !== j);
      const high = Math.max(numbers[i], numbers[j]);
      const low = Math.min(numbers[i], numbers[j]);
      const options: [number, string][] = [
        [high + low, `${formatNumber(high)} + ${formatNumber(low)}`],
        [high * low, `${formatNumber(high)} × ${formatNumber(low)}`],
        [high - low, `${formatNumber(high)} − ${formatNumber(low)}`],
      ];
      if (low > EPS) options.push([high / low, `${formatNumber(high)} ÷ ${formatNumber(low)}`]);
      if (high > EPS && Math.abs(high - low) > EPS) options.push([low / high, `${formatNumber(low)} ÷ ${formatNumber(high)}`]);
      for (const [result, text] of options) {
        const next = [...rest, result];
        const key = keyOf(next);
        if (seen.has(key)) continue;
        seen.add(key);
        output.push({ nums: next, eq: `${text} = ${formatNumber(result)}` });
      }
    }
  }
  return output;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

type Grade = "sure" | "maybe" | "impossible";
type ThoughtNode = {
  id: number;
  nums: number[];
  eq: string;
  level: number;
  parent: number;
  grade: Grade;
  kept: boolean;
  good: boolean;
  ang: number;
  win: boolean;
};

const GRADE_COLOR: Record<Grade, number> = { sure: 0x4ade80, maybe: 0xfacc15, impossible: 0xf87171 };
const GRADE_SCORE: Record<Grade, number> = { sure: 2, maybe: 1, impossible: 0 };

function gradeState(good: boolean, errorRate: number, random: () => number): Grade {
  if (random() >= errorRate) return good ? "sure" : "impossible";
  return random() < 0.5 ? "maybe" : good ? "impossible" : "sure";
}

function buildTree(start: number[], mode: string, breadth: number, errorRate: number, seed: number) {
  const random = rng(seed);
  const nodes: ThoughtNode[] = [
    { id: 0, nums: start, eq: start.join(" "), level: 0, parent: -1, grade: "sure", kept: true, good: solvable(start), ang: 0, win: false },
  ];
  let frontier = [nodes[0]];
  for (let level = 1; level <= 3; level += 1) {
    const candidates: ThoughtNode[] = [];
    for (const state of frontier) {
      for (const move of moves(state.nums)) {
        const good = solvable(move.nums);
        candidates.push({
          id: nodes.length + candidates.length,
          nums: move.nums,
          eq: move.eq,
          level,
          parent: state.id,
          grade: mode === "cot" ? "maybe" : gradeState(good, level === 3 ? 0 : errorRate, random),
          kept: false,
          good,
          ang: 0,
          win: level === 3 && good,
        });
      }
    }
    const kept = mode === "cot"
      ? candidates.length ? [candidates[Math.floor(random() * candidates.length)]] : []
      : candidates
          .map((candidate) => ({ candidate, score: GRADE_SCORE[candidate.grade] + random() * 0.5 }))
          .sort((left, right) => right.score - left.score)
          .slice(0, level === 3 ? 1 : breadth)
          .map((item) => item.candidate);
    kept.forEach((node) => {
      node.kept = true;
    });
    const parentAngle = (node: ThoughtNode) => nodes[node.parent].ang;
    candidates
      .sort((left, right) => parentAngle(left) - parentAngle(right) || left.id - right.id)
      .forEach((node, index) => {
        node.ang = (index / Math.max(1, candidates.length)) * Math.PI * 2 + (level === 1 ? 0 : 0.02);
        node.id = nodes.length + index;
      });
    nodes.push(...candidates);
    frontier = kept;
  }
  const finalNode = frontier[0];
  const success = Boolean(finalNode) && Math.abs(finalNode.nums[0] - 24) < EPS;
  const path: ThoughtNode[] = [];
  if (finalNode) {
    let cursor: ThoughtNode | undefined = finalNode;
    while (cursor && cursor.id !== 0) {
      path.unshift(cursor);
      cursor = nodes[cursor.parent];
    }
  }
  return { nodes, success, path };
}

const PUZZLES: Record<string, number[]> = {
  "4 9 10 13 (paper example)": [4, 9, 10, 13],
  "3 3 8 8": [3, 3, 8, 8],
  "1 5 5 5": [1, 5, 5, 5],
  "2 3 5 12": [2, 3, 5, 12],
  "4 4 7 7": [4, 4, 7, 7],
  "1 3 4 6": [1, 3, 4, 6],
};

const RADII = [0, 2.4, 4.0, 5.3];
const HEIGHTS = [2.6, 0.9, -0.8, -2.5];

function TreeScene({ tree, playKey }: { tree: ReturnType<typeof buildTree>; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ tree, playKey, reduced, progress: 0 });
  live.current.tree = tree;
  live.current.playKey = playKey;
  live.current.reduced = reduced;

  useEffect(() => {
    live.current.playKey = playKey;
    live.current.progress = reduced ? 4.2 : 0;
  }, [playKey, reduced]);

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
      scene.background = new THREE.Color(0x070b16);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.85);
      light.position.set(4, 8, 5);
      scene.add(light);
      const rings = [1, 2, 3].map((level) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(RADII[level], 0.015, 8, 80),
          new THREE.MeshBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.18 }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = HEIGHTS[level];
        scene.add(ring);
        return ring;
      });
      const group = new THREE.Group();
      scene.add(group);
      const labelEls: HTMLDivElement[] = [];
      const point = new THREE.Vector3();
      const project = (x: number, y: number, z: number, el: HTMLDivElement) => {
        point.set(x, y, z).project(camera);
        if (point.z > 1) {
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";
        el.style.left = `${(point.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-point.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };
      let builtKey = "";
      const positions: { x: number; y: number; z: number; node: ThoughtNode }[] = [];
      const sync = () => {
        if (builtKey === live.current.playKey) return;
        builtKey = live.current.playKey;
        group.clear();
        labelEls.forEach((el) => el.remove());
        labelEls.length = 0;
        positions.length = 0;
        const current = live.current.tree;
        const place = (node: ThoughtNode) => ({
          x: Math.cos(node.ang) * RADII[node.level],
          y: HEIGHTS[node.level],
          z: Math.sin(node.ang) * RADII[node.level],
        });
        current.nodes.forEach((node) => {
          const spot = place(node);
          positions.push({ ...spot, node });
          if (node.level > 0) {
            const parent = place(current.nodes[node.parent]);
            const geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(parent.x, parent.y, parent.z),
              new THREE.Vector3(spot.x, spot.y, spot.z),
            ]);
            const win = current.success && current.path.some((item) => item.id === node.id);
            const line = new THREE.Line(
              geometry,
              new THREE.LineBasicMaterial({
                color: win ? 0xfde047 : GRADE_COLOR[node.grade],
                transparent: true,
                opacity: node.kept ? 0.85 : 0.12,
              }),
            );
            line.userData = { level: node.level, kept: node.kept };
            group.add(line);
          }
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(node.level === 0 ? 0.28 : node.kept ? 0.16 : 0.1, 16, 12),
            new THREE.MeshStandardMaterial({
              color: node.level === 0 ? 0xe2e8f0 : GRADE_COLOR[node.grade],
              emissive: node.level === 0 ? 0x334155 : GRADE_COLOR[node.grade],
              emissiveIntensity: node.kept ? 0.35 : 0.02,
              transparent: true,
              opacity: node.kept || node.level === 0 ? 1 : 0.22,
            }),
          );
          sphere.position.set(spot.x, spot.y, spot.z);
          sphere.userData = { level: node.level };
          group.add(sphere);
          if (node.kept || node.level === 0) {
            const el = document.createElement("div");
            el.textContent = node.level === 0 ? node.eq : node.nums.map(formatNumber).join(" ");
            el.style.cssText = "position:absolute;transform:translate(-50%,-150%);color:#f8fafc;font:600 12px sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000";
            el.dataset.level = String(node.level);
            labelLayer.appendChild(el);
            labelEls.push(el);
          }
        });
      };

      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 460;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.45;
      let pitch = 0.34;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(-0.1, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        sync();
        if (live.current.reduced) live.current.progress = 4.2;
        else live.current.progress = Math.min(4.2, live.current.progress + 0.008);
        const progress = live.current.progress;
        group.children.forEach((child) => {
          const level = Number(child.userData.level ?? 0);
          child.visible = level === 0 || progress > level - 0.55;
        });
        rings.forEach((ring, index) => {
          (ring.material as import("three").MeshBasicMaterial).opacity = progress > index ? 0.22 : 0.06;
        });
        if (!drag && !live.current.reduced) yaw += 0.0025;
        const aspect = Math.max(camera.aspect, 0.5);
        const radius = Math.max(13.5, 7.6 / (Math.tan((42 * Math.PI) / 360) * aspect));
        camera.position.set(Math.sin(yaw) * radius, 1.4 + Math.sin(pitch) * radius * 0.45, Math.cos(yaw) * radius);
        camera.lookAt(0, 0.2, 0);
        let labelIndex = 0;
        positions.forEach((spot) => {
          if (!(spot.node.kept || spot.node.level === 0)) return;
          const el = labelEls[labelIndex];
          labelIndex += 1;
          if (!el) return;
          const level = spot.node.level;
          if (level > 0 && progress <= level - 0.55) {
            el.style.visibility = "hidden";
            return;
          }
          project(spot.x, spot.y, spot.z, el);
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
        group.traverse((child) => {
          const mesh = child as import("three").Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const material = mesh.material as { dispose?: () => void } | undefined;
          material?.dispose?.();
        });
        rings.forEach((ring) => {
          ring.geometry.dispose();
          (ring.material as { dispose: () => void }).dispose();
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
        aria-label="Orbitable breadth-first tree for the Game of 24. Green is sure, yellow is maybe, red is impossible, and faded branches were pruned."
        style={{ width: "100%", height: 460, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#070b16" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", left: 12, bottom: 12, color: "#94a3b8", fontSize: 12, pointerEvents: "none" }}>
        Green sure, yellow maybe, red impossible, faded pruned. Drag to orbit.
      </div>
    </div>
  );
}

function Playground() {
  const [puzzle, setPuzzle] = useState("4 9 10 13 (paper example)");
  const [history, setHistory] = useState<{ nums: number[]; eq: string }[]>([{ nums: PUZZLES["4 9 10 13 (paper example)"], eq: "" }]);
  const [selected, setSelected] = useState<number[]>([]);
  const [operation, setOperation] = useState("+");
  const [showGrader, setShowGrader] = useState(false);
  const current = history[history.length - 1].nums;
  const done = current.length === 1;
  const won = done && Math.abs(current[0] - 24) < EPS;
  const alive = solvable(current);
  const choose = (index: number) => {
    setSelected(selected.includes(index) ? selected.filter((item) => item !== index) : selected.length >= 2 ? [selected[1], index] : [...selected, index]);
  };
  const apply = () => {
    if (selected.length !== 2 || done) return;
    const left = current[selected[0]];
    const right = current[selected[1]];
    let result = 0;
    if (operation === "+") result = left + right;
    else if (operation === "−") result = left - right;
    else if (operation === "×") result = left * right;
    else {
      if (Math.abs(right) < EPS) return;
      result = left / right;
    }
    setHistory([...history, { nums: current.filter((_, index) => !selected.includes(index)).concat(result), eq: `${formatNumber(left)} ${operation} ${formatNumber(right)} = ${formatNumber(result)}` }]);
    setSelected([]);
  };
  const reset = (name: string) => {
    setPuzzle(name);
    setHistory([{ nums: PUZZLES[name], eq: "" }]);
    setSelected([]);
  };
  const proposals = done ? [] : moves(current).map((move) => ({ ...move, ok: solvable(move.nums) }));
  return (
    <Section heading="Demo 2: play the Game of 24" caption="Each move is one thought. The grader here is an exact solver, so it shows what a perfect judge would see. GPT-4's judge in the paper was only approximately right.">
      <Select label="Puzzle" options={Object.keys(PUZZLES)} value={puzzle} onChange={reset} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
        {current.map((value, index) => (
          <button key={`${index}-${value}`} type="button" className={`k-btn${selected.includes(index) ? " primary" : ""}`} onClick={() => choose(index)}>
            {formatNumber(value)}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Segmented options={["+", "−", "×", "÷"]} value={operation} onChange={setOperation} />
        <Button label="Apply move" variant="primary" onClick={apply} disabled={selected.length !== 2 || done} />
        <Button
          label="Backtrack"
          onClick={() => {
            if (history.length > 1) {
              setHistory(history.slice(0, -1));
              setSelected([]);
            }
          }}
          disabled={history.length <= 1}
        />
        <Button label={showGrader ? "Hide grader" : "Show grader"} onClick={() => setShowGrader((value) => !value)} />
      </div>
      {history.length > 1 ? <Text>Your chain: {history.slice(1).map((step) => step.eq).join(" → ")}</Text> : null}
      {won ? (
        <Callout tone="success" lead="24.">You found a path. The first step had many other branches.</Callout>
      ) : done ? (
        <Callout tone="warning" lead={`Ended at ${formatNumber(current[0])}.`}>Backtrack and try another branch. A single chain cannot do that.</Callout>
      ) : showGrader ? (
        <Callout tone={alive ? "success" : "danger"} lead={alive ? "Grader: sure." : "Grader: impossible."}>
          {alive ? "24 can still be reached from here." : "No combination of these numbers makes 24. Search would prune this branch."}
        </Callout>
      ) : null}
      {showGrader && !done ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {proposals.map((proposal) => (
            <button
              key={proposal.eq}
              type="button"
              className="k-btn"
              onClick={() => {
                setHistory([...history, { nums: proposal.nums, eq: proposal.eq }]);
                setSelected([]);
              }}
              style={{ borderColor: proposal.ok ? "#4ade80" : "#f87171", opacity: proposal.ok ? 1 : 0.7 }}
            >
              {proposal.eq}
            </button>
          ))}
        </div>
      ) : null}
      {showGrader && !done ? (
        <Text>
          {proposals.filter((proposal) => proposal.ok).length} of {proposals.length} next thoughts can still reach 24. About 60% of GPT-4's chain-of-thought attempts on this task were already lost after the first equation (Figure 3b).
        </Text>
      ) : null}
    </Section>
  );
}

function makePuzzles(count: number, seed: number) {
  const random = rng(seed);
  const output: number[][] = [];
  while (output.length < count) {
    const puzzle = [0, 1, 2, 3].map(() => 1 + Math.floor(random() * 13));
    if (solvable(puzzle)) output.push(puzzle);
  }
  return output;
}

function ToyRace({ errorRate }: { errorRate: number }) {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(reduced ? 60 : 0);
  const puzzles = useMemo(() => makePuzzles(60, 7 + run), [run]);
  const results = useMemo(() => {
    const configs = [
      { mode: "cot", breadth: 1 },
      { mode: "tot", breadth: 1 },
      { mode: "tot", breadth: 3 },
      { mode: "tot", breadth: 5 },
    ];
    return configs.map((config, configIndex) =>
      puzzles.map((puzzle, puzzleIndex) => buildTree(puzzle, config.mode, config.breadth, errorRate, 1000 * run + 31 * puzzleIndex + configIndex).success),
    );
  }, [puzzles, errorRate, run]);
  useEffect(() => {
    if (reduced) {
      setShown(60);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => setShown((value) => (value >= 60 ? value : value + 1)), 40);
    return () => window.clearInterval(id);
  }, [puzzles, errorRate, reduced]);
  const labels = ["Chain, one path", "ToT, b = 1", "ToT, b = 3", "ToT, b = 5"];
  const colors = ["#94a3b8", "#38bdf8", "#a78bfa", "#4ade80"];
  return (
    <div>
      <svg width="100%" viewBox="0 0 720 220" role="img" aria-label="Toy race of chain of thought against trees of breadth 1, 3, and 5." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
        {results.map((row, index) => {
          const wins = row.slice(0, shown).filter(Boolean).length;
          const width = shown ? (wins / 60) * 420 : 0;
          const y = 18 + index * 48;
          return (
            <g key={labels[index]}>
              <text x={210} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">
                {labels[index]}
              </text>
              <rect x={222} y={y} height={20} rx={4} fill={colors[index]} width={width} />
              <text x={230 + width} y={y + 15} fill="#ffffff" fontSize="12">
                {wins} / {shown}{shown ? ` · ${Math.round((100 * wins) / shown)}%` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: 8 }}>
        <Button label="New batch of 60 toy puzzles" onClick={() => setRun((value) => value + 1)} />
      </div>
    </div>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video src={`/videos/17-tree-of-thoughts/${file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "What is a thought in Tree of Thoughts?",
    options: ["A single token", "A coherent chunk that is one intermediate step, such as one equation", "The final answer", "A neural network layer"],
    answer: 1,
    why: "The paper sizes the thought to the task: one equation in the Game of 24, a few words in crosswords, or a paragraph plan in creative writing.",
  },
  {
    q: "What does Tree of Thoughts add on top of chain of thought?",
    options: [
      "Fine-tuning and a bigger model",
      "Several candidate thoughts, self-grading, and a search that can prune and backtrack",
      "A web search tool",
      "A majority vote over final answers only",
    ],
    answer: 1,
    why: "The four choices are how to split the problem, how to generate thoughts, how to evaluate states, and which search to run. Voting over finished answers was self-consistency. Tools were ReAct.",
  },
  {
    q: "Who grades the partial solutions?",
    options: ["A separately trained reward model", "Human labelers", "The same language model, prompted to judge", "A hard-coded calculator"],
    answer: 2,
    why: "The language model is its own heuristic. It is asked whether a state is sure, maybe, or impossible, or it votes across states. It only has to be helpful, not perfect.",
  },
  {
    q: "On Game of 24 with GPT-4, chain of thought scored 4%. What did Tree of Thoughts with breadth 5 score?",
    options: ["9%", "27%", "49%", "74%"],
    answer: 3,
    why: "Table 2: 74%. The best of 100 chain-of-thought samples reached 49%, and self-consistency over 100 samples reached 9%.",
  },
  {
    q: "In mini crosswords, removing backtracking dropped word accuracy from 60% to what?",
    options: ["58%", "41.5%", "20%", "0%"],
    answer: 2,
    why: "Table 3: without backtracking, word accuracy is 20%. Without pruning it is 41.5%. Both the grade and the ability to back up matter.",
  },
  {
    q: "What is the main cost of Tree of Thoughts?",
    options: [
      "It needs retraining",
      "Many more model calls and tokens, about $0.74 versus $0.47 per Game of 24 puzzle against 100 chain-of-thought samples",
      "It only works on small models",
      "It cannot show its steps",
    ],
    answer: 1,
    why: "Search spends calls. The paper says it can take 5 to 100 times as many generated tokens as chain of thought, and it is unnecessary on tasks the model already solves well.",
  },
];

export default function App() {
  const [puzzle, setPuzzle] = useState("4 9 10 13 (paper example)");
  const [mode, setMode] = useState("tot");
  const [breadth, setBreadth] = useState("5");
  const [errorLabel, setErrorLabel] = useState("10%");
  const [seed, setSeed] = useState(1);
  const [raceError, setRaceError] = useState("10%");
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const errorRate = Number.parseInt(errorLabel, 10) / 100;
  const tree = useMemo(
    () => buildTree(PUZZLES[puzzle], mode, mode === "cot" ? 1 : Number.parseInt(breadth, 10), errorRate, seed),
    [puzzle, mode, breadth, errorRate, seed],
  );
  const playKey = `${puzzle}|${mode}|${breadth}|${errorLabel}|${seed}`;
  const levels = [1, 2, 3].map((level) => {
    const all = tree.nodes.filter((node) => node.level === level);
    return { level, all: all.length, kept: all.filter((node) => node.kept).length, sure: all.filter((node) => node.grade === "sure").length };
  });

  return (
    <Page
      title="Tree of Thoughts: search over partial solutions instead of writing one chain"
      summary="Paper #17 · Yao, Yu, Zhao, Shafran, Griffiths, Cao, Narasimhan · Princeton and Google DeepMind · NeurIPS 2023 · arXiv 2305.10601"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        Propose several possible next steps, have the model grade those partial solutions, keep the promising ones, and back up from dead ends.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          Chain of thought (paper #14) writes one line and cannot undo an early mistake. Self-consistency (paper #15) writes many finished lines and votes. ReAct (paper #16) adds actions in the world. None of them looks sideways at the first step. In the Game of 24, about 60% of GPT-4's chain-of-thought attempts were already lost after the first equation (Figure 3b).
        </Text>
        <Text>
          Tree of Thoughts treats the problem as a tree. A thought is one intermediate equation, a crossword word, or a writing plan. The same model proposes several thoughts, then judges each new state: sure, maybe, or impossible. Breadth-first search keeps the best b states at each step. Depth-first search follows one branch, prunes hopeless states, and backtracks. Input-output prompting, chain of thought, self-consistency, and self-refinement are all trees with a tight limit on depth or breadth. The experiments use GPT-4 from May 2023, with no training.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: an orbitable breadth-first tree" caption="The search over Game of 24 moves is real. The grader is a toy: an exact solver that is deliberately wrong at the error rate you pick, standing in for GPT-4's sure / maybe / impossible judgments. The final equation is checked exactly.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
          <Select label="Puzzle" options={Object.keys(PUZZLES)} value={puzzle} onChange={setPuzzle} />
          <Segmented
            options={[
              { value: "cot", label: "Chain (one path)" },
              { value: "tot", label: "Tree of Thoughts" },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === "tot" ? <Segmented options={["1", "2", "3", "5"].map((value) => ({ value, label: `b = ${value}` }))} value={breadth} onChange={setBreadth} /> : null}
          {mode === "tot" ? <Select label="Grader error (toy)" options={["0%", "10%", "25%", "50%"]} value={errorLabel} onChange={setErrorLabel} /> : null}
          <Button label="Re-run" variant="primary" onClick={() => setSeed((value) => value + 1)} />
        </div>
        <TreeScene tree={tree} playKey={playKey} />
        <Metrics
          metrics={levels.map((level) => ({
            value: `${level.kept} / ${level.all}`,
            label: `Step ${level.level}: kept / proposed`,
            detail: mode === "tot" ? `${level.sure} graded sure` : "one path, picked at random",
          }))}
        />
        {tree.path.length ? (
          <Callout tone={tree.success ? "success" : "warning"} lead={tree.success ? "Path found." : "Final path."}>
            {tree.path.map((node) => node.eq).join(" → ")}
            {tree.success ? "" : " (not 24)"}
          </Callout>
        ) : null}
        <Text>
          A chain commits to one random legal move at each step. Tree of Thoughts keeps up to b states. Raise the toy grader error and the search starts trusting bad branches. The paper's real grader was GPT-4, not this solver.
        </Text>
      </Section>

      <Playground />

      <Section heading="Demo 3: chain versus tree, on toy puzzles" caption="Sixty random solvable puzzles, solved by the same search as Demo 1. These bars are the toy simulation, not the paper. At grader error 10% and the first batch, the counts are 0, 36, 58, and 60. At 25% they are 0, 14, 37, and 50.">
        <Select label="Grader error (toy)" options={["0%", "10%", "25%", "50%"]} value={raceError} onChange={setRaceError} />
        <ToyRace errorRate={Number.parseInt(raceError, 10) / 100} />
        <Text>
          A wider beam helps when the grader is noisy. With a perfect grader, even breadth 1 solves these toy puzzles. The paper found the same shape on Game of 24: breadth 1 reached 45%, and breadth 5 reached 74%.
        </Text>
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Choose the size of a thought", detail: "One equation in the Game of 24, a few letters in crosswords, or a paragraph plan in creative writing. Small enough to sample several, large enough to judge." },
            { title: "Propose k next thoughts", detail: "Sample them independently when the space is rich, or list them in one propose prompt when duplicates would waste the search." },
            { title: "Ask the same model to grade the states", detail: "A value prompt can say sure, maybe, or impossible, sometimes after a short lookahead. A vote prompt compares states with each other." },
            { title: "Search", detail: "Breadth-first search keeps the best b states per step. Depth-first search follows the best branch, prunes a state at or below a threshold, and backtracks. A* and Monte Carlo tree search are left for later." },
          ]}
        />
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "4% → 74%", label: "Game of 24, GPT-4", detail: "Chain of thought versus Tree of Thoughts, breadth 5, 100 hard puzzles (Table 2)", tone: "success" },
            { value: "15.6% → 60%", label: "Crossword words correct", detail: "Chain of thought versus Tree of Thoughts, 20 games (Table 3)", tone: "success" },
            { value: "7.56 vs 6.93", label: "Creative-writing coherence", detail: "GPT-4 judge, Tree of Thoughts versus chain of thought (Figure 5a)" },
            { value: "~60%", label: "Chain-of-thought attempts already dead at step 1", detail: "Game of 24 error analysis (Figure 3b)", tone: "warning" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Search beats sampling finished answers", "Game of 24, Table 2: IO 7.3%, chain of thought 4.0%, self-consistency at 100 samples 9.0%, best of 100 chains 49%, Tree of Thoughts breadth 1 is 45%, breadth 5 is 74%"],
            ["Breadth matters", "Keeping 5 states per step instead of 1 raises Game of 24 from 45% to 74% (Table 2)"],
            ["Pruning and backtracking both matter", "Crossword words: 60% with both, 41.5% without pruning, 20% without backtracking. Games solved: 4 of 20, versus 1 of 20 for chain of thought (Table 3)"],
            ["It also helps open-ended writing", "Coherence 7.56 versus 6.93 versus 6.19 for input-output. In 100 blind human pairs, Tree of Thoughts was preferred 41 times, chain of thought 21, and 38 were similar (Figure 5)"],
            ["A weaker model gains less", "GPT-3.5 on Game of 24: Tree of Thoughts 19%, chain of thought 3%, input-output 6% (Table 5). Zero-shot on GSM8K is 90 versus 86, and StrategyQA 83 versus 82 (Table 4)"],
            ["It costs more calls", "Per Game of 24 puzzle, Table 7: Tree of Thoughts $0.74 and 74% success, versus best of 100 chains at $0.47 and 49%. Creative writing uses about five times as many tokens"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors note.">
          Only three hard tasks were tested, and the method is unnecessary where the model already does well. The model's own pruning can drop a correct but rare crossword word. Search also spends many more API calls, sometimes 5 to 100 times the tokens of one chain.
        </Callout>
      </Section>

      <QuizSync slug="17-tree-of-thoughts" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>
          In your own words: why does exploring a tree of thoughts, with the model grading its own partial steps, beat writing one chain, or even voting over many complete chains, on a puzzle like the Game of 24?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Tree of Thoughts (abstract)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/abs/2305.10601" },
            { title: "Tree of Thoughts (PDF)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/pdf/2305.10601" },
            { title: "Official code and prompts", site: "github.com", date: "2023", href: "https://github.com/princeton-nlp/tree-of-thought-llm" },
            { title: "ReAct, the same first author's previous step", site: "Papers a Day", date: "2023", href: "/papers/16-react" },
            { title: "Self-consistency, voting over finished chains", site: "Papers a Day", date: "2023", href: "/papers/15-self-consistency" },
            { title: "Chain-of-thought prompting", site: "Papers a Day", date: "2022", href: "/papers/14-chain-of-thought" },
          ]}
        />
      </Section>
    </Page>
  );
}
