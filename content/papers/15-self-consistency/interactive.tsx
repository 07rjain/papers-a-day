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

// Demos 1 and 2 are toy samplers. The question and the answers $18, $26 and $14 come from Figure 1.
// Demo 3 and the claims table use the paper's numbers from Tables 1, 2, 3, 7 and 8.

const VIDEOS = [
  {
    file: "SampleAndVote.mp4",
    title: "Sample several answers, then vote",
    caption:
      "Figure 1: greedy decoding writes one chain and lands on $14. Sampling several chains gives $18, $26 and $18, and the most common answer, $18, is right.",
  },
  {
    file: "GainsByModel.mp4",
    title: "Same model, same prompt, more accuracy",
    caption: "GSM8K (Table 2): one greedy chain of thought versus self-consistency with 40 sampled paths. PaLM 540B goes from 56.5% to 74.4%.",
  },
  {
    file: "Aggregation.mp4",
    title: "How should the paths vote?",
    caption: "PaLM 540B on GSM8K (Table 1): a plain majority vote, 74.4%, does as well as the best probability-weighted scheme, 74.1%.",
  },
];

const ANSWERS = ["$18", "$26", "$14", "$22", "$10", "$32", "$16"];
const COLORS = [0x4ade80, 0xf87171, 0xfb923c, 0xf472b6, 0xa78bfa, 0x38bdf8, 0xfacc15];
const PATH_COUNTS = [1, 5, 10, 20, 40];
const FIELD_PATHS = [1, 3, 5, 10, 20, 40];
const QUESTION_COUNT = 120;

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sampleAnswer(random: () => number, accuracy: number, spread: string) {
  if (random() < accuracy) return 0;
  if (spread === "clump") return random() < 0.75 ? 1 : 2;
  const weights = [0.3, 0.22, 0.16, 0.13, 0.1, 0.09];
  let draw = random();
  let index = 0;
  while (index < weights.length - 1 && draw > weights[index]) {
    draw -= weights[index];
    index += 1;
  }
  return index + 1;
}

type Flyer = { answer: number; wobble: number; lift: number; delay: number };

function makeFlyers(count: number, accuracy: number, spread: string, run: number): Flyer[] {
  const random = rng(1000 + run * 97 + count * 7 + Math.round(accuracy * 100));
  const flyers: Flyer[] = [];
  for (let index = 0; index < count; index += 1) {
    flyers.push({
      answer: sampleAnswer(random, accuracy, spread),
      wobble: random() * 2 - 1,
      lift: 1.2 + random() * 2.2,
      delay: index * (count > 20 ? 4 : 9),
    });
  }
  return flyers;
}

function countsOf(flyers: Flyer[]) {
  const counts = ANSWERS.map(() => 0);
  flyers.forEach((flyer) => {
    counts[flyer.answer] += 1;
  });
  let best = 0;
  counts.forEach((count, index) => {
    if (count > counts[best]) best = index;
  });
  return { counts, best };
}

const QUESTION_DIFFICULTY = (() => {
  const random = rng(42);
  return Array.from({ length: QUESTION_COUNT }, () => Math.min(0.95, Math.max(0.05, 0.15 + random() * 0.8 * random() + random() * 0.25)));
})();

function majorityRight(question: number, paths: number, spread: string) {
  const accuracy = QUESTION_DIFFICULTY[question];
  const random = rng(7 + question * 131 + paths * 17);
  const counts = ANSWERS.map(() => 0);
  for (let index = 0; index < paths; index += 1) counts[sampleAnswer(random, accuracy, spread)] += 1;
  let best = 0;
  counts.forEach((count, index) => {
    if (count > counts[best]) best = index;
  });
  return best === 0 ? 1 : 0;
}

function pillarPosition(index: number) {
  const angle = -1.1 + (index / (ANSWERS.length - 1)) * 2.2;
  return { x: 1.6 + Math.cos(angle) * 3.4, z: Math.sin(angle) * 3.4 };
}

function VoteArena({ flyers, greedy }: { flyers: Flyer[]; greedy: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ flyers, greedy, reduced });
  live.current = { flyers, greedy, reduced };

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
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(4, 10, 6);
      scene.add(key);
      scene.add(new THREE.GridHelper(16, 16, 0x243044, 0x1a2433));

      const source = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 24, 16),
        new THREE.MeshStandardMaterial({ color: 0x5aa9ff, emissive: 0x1d4ed8, emissiveIntensity: 0.7 }),
      );
      source.position.set(-5.2, 1.6, 0);
      scene.add(source);

      const pillars = ANSWERS.map((_, index) => {
        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 1, 6),
          new THREE.MeshStandardMaterial({ color: COLORS[index], roughness: 0.4 }),
        );
        const place = pillarPosition(index);
        mesh.position.set(place.x, 0.08, place.z);
        scene.add(mesh);
        return mesh;
      });

      const particles = Array.from({ length: 40 }, () => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        mesh.visible = false;
        scene.add(mesh);
        const positions = new Float32Array(18 * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
        line.visible = false;
        scene.add(line);
        return { mesh, line, positions, progress: 0, wait: 0 };
      });

      const greedyPositions = new Float32Array(24 * 3);
      const greedyGeometry = new THREE.BufferGeometry();
      greedyGeometry.setAttribute("position", new THREE.BufferAttribute(greedyPositions, 3));
      const greedyLine = new THREE.Line(
        greedyGeometry,
        new THREE.LineDashedMaterial({ color: 0xfb923c, dashSize: 0.18, gapSize: 0.12 }),
      );
      scene.add(greedyLine);
      const greedyEnd = pillarPosition(2);
      for (let step = 0; step <= 23; step += 1) {
        const t = step / 23;
        const u = 1 - t;
        greedyPositions[step * 3] = u * u * -5.2 + 2 * u * t * -1.5 + t * t * greedyEnd.x;
        greedyPositions[step * 3 + 1] = u * u * 1.6 + 2 * u * t * 4.2 + t * t * 0.2;
        greedyPositions[step * 3 + 2] = u * u * 0 + 2 * u * t * 0 + t * t * greedyEnd.z;
      }
      greedyGeometry.attributes.position.needsUpdate = true;
      greedyLine.computeLineDistances();

      const labelEls = ANSWERS.map((answer) => {
        const el = document.createElement("div");
        el.textContent = answer;
        el.style.cssText = "position:absolute;transform:translate(-50%,-120%);color:#e2e8f0;font:600 12px sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000";
        labelLayer.appendChild(el);
        return el;
      });
      const greedyLabel = document.createElement("div");
      greedyLabel.textContent = "greedy: one path → $14";
      greedyLabel.style.cssText = "position:absolute;transform:translate(-50%,-50%);color:#fb923c;font:600 12px sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000";
      labelLayer.appendChild(greedyLabel);
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

      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 440;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.45;
      let pitch = 0.42;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.18, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);

      let signature = "";
      const shown = ANSWERS.map(() => 0);
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const current = live.current;
        const nextSignature = current.flyers.map((flyer) => flyer.answer).join(",") + current.flyers.length;
        if (nextSignature !== signature) {
          signature = nextSignature;
          particles.forEach((particle, index) => {
            const flyer = current.flyers[index];
            particle.mesh.visible = Boolean(flyer);
            particle.line.visible = Boolean(flyer);
            particle.progress = current.reduced ? 1 : 0;
            particle.wait = flyer ? flyer.delay : 0;
            if (flyer) (particle.mesh.material as import("three").MeshBasicMaterial).color.setHex(COLORS[flyer.answer]);
          });
          shown.fill(0);
        }
        const arrived = ANSWERS.map(() => 0);
        current.flyers.forEach((flyer, index) => {
          const particle = particles[index];
          if (!current.reduced && particle.wait > 0) {
            particle.wait -= 1;
            particle.mesh.position.set(-5.2, 1.6, 0);
            return;
          }
          particle.progress = current.reduced ? 1 : Math.min(1, particle.progress + 0.02);
          const end = pillarPosition(flyer.answer);
          const mid = { x: (-5.2 + end.x) / 2, y: flyer.lift + 1.5, z: end.z / 2 + flyer.wobble * 2.2 };
          const placeAt = (t: number) => {
            const u = 1 - t;
            return {
              x: u * u * -5.2 + 2 * u * t * mid.x + t * t * end.x,
              y: u * u * 1.6 + 2 * u * t * mid.y + t * t * 0.25,
              z: u * u * 0 + 2 * u * t * mid.z + t * t * end.z,
            };
          };
          const head = placeAt(particle.progress);
          particle.mesh.position.set(head.x, head.y, head.z);
          particle.mesh.visible = particle.progress < 1;
          const material = particle.line.material as import("three").LineBasicMaterial;
          material.color.setHex(COLORS[flyer.answer]);
          for (let step = 0; step < 18; step += 1) {
            const spot = placeAt((step / 17) * particle.progress);
            particle.positions[step * 3] = spot.x;
            particle.positions[step * 3 + 1] = spot.y;
            particle.positions[step * 3 + 2] = spot.z;
          }
          particle.line.geometry.attributes.position.needsUpdate = true;
          if (particle.progress >= 1) arrived[flyer.answer] += 1;
        });
        const done = current.flyers.every((_, index) => particles[index].progress >= 1);
        let best = 0;
        arrived.forEach((count, index) => {
          if (count > arrived[best]) best = index;
        });
        const total = Math.max(1, current.flyers.length);
        pillars.forEach((mesh, index) => {
          shown[index] += ((done ? arrived[index] : shown[index]) - shown[index]) * (current.reduced ? 1 : 0.14);
          if (!done && !current.reduced) shown[index] = arrived[index];
          const height = 0.18 + (arrived[index] / total) * 5.2;
          mesh.scale.y = Math.max(0.08, height);
          mesh.position.y = mesh.scale.y / 2;
          const win = done && index === best && arrived[index] > 0;
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.emissive.setHex(win ? 0xfacc15 : 0x000000);
          material.emissiveIntensity = win ? 0.45 : 0;
          const spot = pillarPosition(index);
          labelEls[index].textContent = win ? `${ANSWERS[index]} · ${arrived[index]} majority` : `${ANSWERS[index]} · ${arrived[index]}`;
          labelEls[index].style.color = win ? "#facc15" : "#e2e8f0";
          project(spot.x, height + 0.45, spot.z, labelEls[index]);
        });
        greedyLine.visible = current.greedy;
        greedyLabel.style.visibility = current.greedy ? "visible" : "hidden";
        if (current.greedy) project(-1.5, 3.5, 0, greedyLabel);
        if (!drag && !current.reduced) yaw += 0.002;
        const aspect = Math.max(camera.aspect, 0.45);
        const radius = Math.max(15.5, 8.4 / (Math.tan((42 * Math.PI) / 360) * aspect));
        const horizontal = Math.cos(pitch);
        camera.position.set(Math.sin(yaw) * radius * horizontal, 1.8 + Math.sin(pitch) * radius * 0.65, Math.cos(yaw) * radius * horizontal);
        camera.lookAt(0.2, 1.4, 0);
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        labelEls.forEach((el) => el.remove());
        greedyLabel.remove();
        pillars.forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        particles.forEach((particle) => {
          particle.mesh.geometry.dispose();
          (particle.mesh.material as { dispose: () => void }).dispose();
          particle.line.geometry.dispose();
          (particle.line.material as { dispose: () => void }).dispose();
        });
        source.geometry.dispose();
        (source.material as { dispose: () => void }).dispose();
        greedyLine.geometry.dispose();
        (greedyLine.material as { dispose: () => void }).dispose();
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
        aria-label="Toy vote arena. Paths fly from the model into seven answer pillars. The tallest pillar is the majority vote."
        style={{ width: "100%", height: 440, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#0b1020" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", top: 10, left: 12, color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, pointerEvents: "none" }}>
        Toy example · Janet&apos;s ducks from Figure 1 · green $18 is correct · drag to orbit
      </div>
    </div>
  );
}

function QuestionField({ step, spread }: { step: number; spread: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ step, spread, reduced });
  live.current = { step, spread, reduced };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0b1020);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const mesh = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        new THREE.MeshStandardMaterial({ roughness: 0.45 }),
        QUESTION_COUNT,
      );
      const dummy = new THREE.Object3D();
      const columns = 20;
      for (let index = 0; index < QUESTION_COUNT; index += 1) {
        dummy.position.set((index % columns) - 9.5, 0, Math.floor(index / columns) - 2.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, new THREE.Color(0xf87171));
      }
      scene.add(mesh);
      const color = new THREE.Color();
      const shown = QUESTION_DIFFICULTY.map(() => 0);
      let targets = QUESTION_DIFFICULTY.map(() => 0);
      let key = "";
      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 280;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const paths = FIELD_PATHS[live.current.step];
        const nextKey = `${paths}|${live.current.spread}`;
        if (nextKey !== key) {
          key = nextKey;
          targets = QUESTION_DIFFICULTY.map((_, index) => majorityRight(index, paths, live.current.spread));
        }
        for (let index = 0; index < QUESTION_COUNT; index += 1) {
          shown[index] += (targets[index] - shown[index]) * (live.current.reduced ? 1 : 0.08);
          color.setRGB(0.97 * (1 - shown[index]) + 0.29 * shown[index], 0.44 * (1 - shown[index]) + 0.87 * shown[index], 0.44 * (1 - shown[index]) + 0.5 * shown[index]);
          mesh.setColorAt(index, color);
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        const aspect = Math.max(camera.aspect, 0.5);
        const distance = Math.max(11, 8.2 / (Math.tan((42 * Math.PI) / 360) * aspect));
        camera.position.set(0, distance * 0.72, distance * 0.55);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        mesh.geometry.dispose();
        (mesh.material as { dispose: () => void }).dispose();
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Toy field of 120 questions. Green means the majority vote is right. Red means it is wrong."
      style={{ width: "100%", height: 280, display: "block", borderRadius: 12, background: "#0b1020" }}
    />
  );
}

function AccuracyCurve({ points }: { points: { label: string; value: number }[] }) {
  const width = 680;
  const height = 220;
  const pad = 36;
  const xOf = (index: number) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const yOf = (value: number) => height - pad - (value / 100) * (height - pad * 2);
  const path = points.map((point, index) => `${index ? "L" : "M"}${xOf(index)},${yOf(point.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Toy accuracy of the majority vote as the number of paths grows." style={{ width: "100%", display: "block", background: "#0b1020", borderRadius: 12 }}>
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={pad} x2={width - pad} y1={yOf(tick)} y2={yOf(tick)} stroke="#1e293b" />
          <text x={pad - 8} y={yOf(tick) + 4} fill="#94a3b8" fontSize="11" textAnchor="end">
            {tick}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#4ade80" strokeWidth="2.5" />
      {points.map((point, index) => (
        <g key={point.label}>
          <circle cx={xOf(index)} cy={yOf(point.value)} r="4" fill="#4ade80" />
          <text x={xOf(index)} y={height - 12} fill="#cbd5e1" fontSize="11" textAnchor="middle">
            {point.label}
          </text>
          <text x={xOf(index)} y={yOf(point.value) - 10} fill="#86efac" fontSize="12" textAnchor="middle">
            {point.value}%
          </text>
        </g>
      ))}
    </svg>
  );
}

const MODELS = ["UL2 20B", "LaMDA 137B", "PaLM 540B", "GPT-3 code-davinci-001", "GPT-3 code-davinci-002"];
const ARITHMETIC = {
  tasks: ["AddSub", "MultiArith", "ASDiv", "AQuA", "SVAMP", "GSM8K"],
  cot: [
    [18.2, 10.7, 16.9, 23.6, 12.6, 4.1],
    [52.9, 51.8, 49.0, 17.7, 38.9, 17.1],
    [91.9, 94.7, 74.0, 35.8, 79.0, 56.5],
    [57.2, 59.5, 52.7, 18.9, 39.8, 14.6],
    [89.4, 96.2, 80.1, 39.8, 75.8, 60.1],
  ],
  sc: [
    [24.8, 15.0, 21.5, 26.9, 19.4, 7.3],
    [63.5, 75.7, 58.2, 26.8, 53.3, 27.7],
    [93.7, 99.3, 81.9, 48.3, 86.6, 74.4],
    [67.8, 82.7, 61.9, 25.6, 54.5, 23.4],
    [91.6, 100.0, 87.8, 52.0, 86.8, 78.0],
  ],
};
const COMMON = {
  tasks: ["CSQA", "StrategyQA", "ARC-e", "ARC-c", "Letters (4)", "Coin flip (4)"],
  cot: [
    [51.4, 53.3, 61.6, 42.9, 0.0, 50.4],
    [57.9, 65.4, 75.3, 55.1, 8.2, 72.4],
    [79.0, 75.3, 95.3, 85.2, 65.8, 88.2],
    [46.6, 56.7, 63.1, 43.1, 7.8, 71.4],
    [79.0, 73.4, 94.0, 83.6, 70.4, 99.0],
  ],
  sc: [
    [55.7, 54.9, 69.8, 49.5, 0.0, 50.5],
    [63.1, 67.8, 79.3, 59.8, 8.2, 73.5],
    [80.7, 81.6, 96.4, 88.7, 70.8, 91.2],
    [54.9, 61.7, 72.1, 53.7, 10.0, 75.9],
    [81.5, 79.8, 96.0, 87.5, 73.4, 99.5],
  ],
};

function ResultsRace({ group, model, tick }: { group: "arith" | "common"; model: number; tick: number }) {
  const reduced = useReducedMotion();
  const [grow, setGrow] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      setGrow(1);
      return;
    }
    setGrow(0);
    const id = window.setTimeout(() => setGrow(1), 60);
    return () => window.clearTimeout(id);
  }, [group, model, tick, reduced]);
  const data = group === "arith" ? ARITHMETIC : COMMON;
  return (
    <svg width="100%" viewBox="0 0 760 340" role="img" aria-label="Chain of thought versus self-consistency. Orange is one greedy answer. Green is the majority vote over 40 paths." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      {[0, 25, 50, 75, 100].map((tickMark) => (
        <g key={tickMark}>
          <line x1={150 + tickMark * 5.4} x2={150 + tickMark * 5.4} y1={12} y2={312} stroke="#1e293b" />
          <text x={150 + tickMark * 5.4} y={328} fill="#475569" fontSize="11" textAnchor="middle">
            {tickMark}
          </text>
        </g>
      ))}
      {data.tasks.map((task, index) => {
        const y = 16 + index * 48;
        const cot = data.cot[model][index];
        const sc = data.sc[model][index];
        const gain = (Math.round((sc - cot) * 10) / 10).toFixed(1);
        return (
          <g key={task}>
            <text x={142} y={y + 22} fill="#e2e8f0" fontSize="13" textAnchor="end">
              {task}
            </text>
            <rect x={150} y={y} height={16} rx={4} fill="#fb923c" width={grow ? cot * 5.4 : 0}>
              {reduced ? null : <animate attributeName="width" from="0" to={cot * 5.4} dur={`${0.7 + index * 0.12}s`} fill="freeze" />}
            </rect>
            <rect x={150} y={y + 20} height={16} rx={4} fill="#4ade80" width={grow ? sc * 5.4 : 0}>
              {reduced ? null : <animate attributeName="width" from="0" to={sc * 5.4} dur={`${0.95 + index * 0.12}s`} fill="freeze" />}
            </rect>
            <text x={156 + cot * 5.4} y={y + 13} fill="#fdba74" fontSize="11">
              {cot.toFixed(1)}
            </text>
            <text x={156 + sc * 5.4} y={y + 33} fill="#86efac" fontSize="11">
              {sc.toFixed(1)} (+{gain})
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video src={`/videos/15-self-consistency/${file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "What does self-consistency change compared with plain chain-of-thought prompting?",
    options: [
      "It fine-tunes the model on its own answers",
      "Instead of one greedy answer, it samples many reasoning paths and takes the most common final answer",
      "It adds a second model that checks the reasoning",
    ],
    answer: 1,
    why: "Same model, same chain-of-thought prompt, no training and no extra model. Only the decoding changes: sample several chains and take a majority vote over their final answers.",
  },
  {
    q: "Why does a majority vote over sampled paths tend to land on the right answer?",
    options: [
      "Because wrong reasoning paths tend to scatter over many different answers, while correct paths agree on one",
      "Because the model is always right more than half the time",
      "Because longer chains are always correct",
    ],
    answer: 0,
    why: "There are many ways to reason to the correct answer, but mistakes lead to different wrong answers. The right answer can win the vote even when fewer than half of the paths reach it.",
  },
  {
    q: "On PaLM 540B (GSM8K), how did a plain majority vote compare with weighting each path by the model's own probability?",
    options: ["Much worse", "About the same as the best weighted version (74.4% vs 74.1%)", "Majority vote was not tested"],
    answer: 1,
    why: "Table 1: the unweighted vote got 74.4%, and the length-normalized weighted sum got 74.1%. The model rates its paths as about equally likely, so simple counting is enough.",
  },
  {
    q: "What is the main cost of self-consistency?",
    options: ["You need human labels", "You run the model many times per question, so it costs more compute", "It only works on tiny models"],
    answer: 1,
    why: "Forty paths means about forty generations. Most of the gain arrives by 5 to 10 paths, which is why the authors suggest starting there.",
  },
  {
    q: "What does it tell you when the sampled paths disagree a lot (low consistency)?",
    options: ["Nothing", "The model is probably less sure, and accuracy tends to be lower", "The answer is definitely right"],
    answer: 1,
    why: "Consistency, the share of paths agreeing with the winning answer, is highly correlated with accuracy on GSM8K. Low agreement is a useful uncertainty signal.",
  },
];

export default function App() {
  const reduced = useReducedMotion();
  const [pathCount, setPathCount] = useState("10");
  const [accuracy, setAccuracy] = useState("0.45");
  const [spread, setSpread] = useState("scatter");
  const [run, setRun] = useState(0);
  const [greedy, setGreedy] = useState(true);
  const [fieldStep, setFieldStep] = useState(0);
  const [fieldSpread, setFieldSpread] = useState("scatter");
  const [group, setGroup] = useState<"arith" | "common">("arith");
  const [model, setModel] = useState("2");
  const [tick, setTick] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const timers = useRef<number[]>([]);

  const count = Number.parseInt(pathCount, 10);
  const pathAccuracy = Number.parseFloat(accuracy);
  const flyers = useMemo(() => makeFlyers(count, pathAccuracy, spread, run), [count, pathAccuracy, spread, run]);
  const tally = countsOf(flyers);
  const consistency = Math.round((tally.counts[tally.best] / count) * 100);
  const curve = FIELD_PATHS.map((paths) => ({
    label: `${paths} path${paths === 1 ? "" : "s"}`,
    value: Math.round((QUESTION_DIFFICULTY.reduce((sum, _, index) => sum + majorityRight(index, paths, fieldSpread), 0) / QUESTION_COUNT) * 1000) / 10,
  }));

  const playField = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (reduced) {
      setFieldStep(FIELD_PATHS.length - 1);
      return;
    }
    setFieldStep(0);
    FIELD_PATHS.forEach((_, index) => {
      if (index > 0) timers.current.push(window.setTimeout(() => setFieldStep(index), index * 1300));
    });
  };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  const resample = () => setRun((value) => value + 1);

  return (
    <Page
      title="Self-consistency: sample many chains, then trust the answer they share"
      summary="Paper #15 · Wang, Wei, Schuurmans, Le, Chi, Narang, Chowdhery, Zhou, Google Research (Brain Team), ICLR 2023 · arXiv 2203.11171"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        Do not take the first chain of thought. Sample many reasoning paths from the same prompt, and pick the final answer that most of them agree on.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          Chain-of-thought prompting (paper #14) got large models to write their working. The model still wrote one chain, picking the single most likely next token. One early slip and the answer is wrong. GPT-3 (paper #8) had already shown that a prompt can set the style; this paper changes only how the answer is read out.
        </Text>
        <Text>
          Self-consistency asks the same question many times, with a little randomness, so the chains differ. It then ignores the chains and counts the final answers. Correct paths tend to land on the same answer. Wrong paths scatter. No training and no extra model: PaLM 540B moved from 56.5% to 74.4% on GSM8K, and a plain vote matched the best probability weighting.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: the vote arena" caption="Toy simulation. Janet's ducks, and the answers $18, $26 and $14, are from Figure 1. The chance that a path is right is a made-up setting. Drag to orbit.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={PATH_COUNTS.map((value) => ({ value: String(value), label: `${value} path${value === 1 ? "" : "s"}` }))}
            value={pathCount}
            onChange={(value) => {
              setPathCount(value);
              resample();
            }}
          />
          <Button label="Sample again" variant="primary" onClick={resample} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={[
              { value: "0.3", label: "Each path right 30%" },
              { value: "0.45", label: "45%" },
              { value: "0.6", label: "60%" },
            ]}
            value={accuracy}
            onChange={(value) => {
              setAccuracy(value);
              resample();
            }}
          />
          <Segmented
            options={[
              { value: "scatter", label: "Mistakes scatter" },
              { value: "clump", label: "Mistakes clump together" },
            ]}
            value={spread}
            onChange={(value) => {
              setSpread(value);
              resample();
            }}
          />
          <Toggle label="Show the greedy path" value={greedy} onChange={setGreedy} />
        </div>
        <VoteArena flyers={flyers} greedy={greedy} />
        <Metrics
          metrics={[
            {
              value: ANSWERS[tally.best],
              label: "Majority answer",
              detail: tally.best === 0 ? "correct ($18)" : "wrong (the right answer is $18)",
              tone: tally.best === 0 ? "success" : "danger",
            },
            { value: `${tally.counts[0]} / ${count}`, label: "Paths that reached $18", detail: `${Math.round((tally.counts[0] / count) * 100)}% of paths` },
            { value: `${consistency}%`, label: "Consistency", detail: "share of paths agreeing with the winner" },
          ]}
        />
        <Text>
          At 45% with 20 or 40 paths, fewer than half the paths are right, and $18 can still win because the wrong paths split across $26, $14, $22 and the rest. Switch to clumped mistakes and the same wrong answer piles up, so voting stops helping. Low consistency is the warning the paper found: agreement tracks accuracy.
        </Text>
      </Section>

      <Section heading="Demo 2: a field of 120 questions" caption="Toy simulation. Each dot is a made-up question with its own difficulty. Green means the majority vote is right. One path is the greedy case.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={FIELD_PATHS.map((paths, index) => ({ value: String(index), label: `${paths} path${paths === 1 ? "" : "s"}` }))}
            value={String(fieldStep)}
            onChange={(value) => setFieldStep(Number.parseInt(value, 10))}
          />
          <Button label="Play: add more paths" variant="primary" onClick={playField} />
          <Segmented
            options={[
              { value: "scatter", label: "Mistakes scatter" },
              { value: "clump", label: "Mistakes clump" },
            ]}
            value={fieldSpread}
            onChange={setFieldSpread}
          />
        </div>
        <QuestionField step={fieldStep} spread={fieldSpread} />
        <div style={{ height: 10 }} />
        <AccuracyCurve points={curve} />
        <p className="viz-note">
          Toy accuracy with mistakes that {fieldSpread}: {curve.map((point) => `${point.label} ${point.value}%`).join(" · ")}.
        </p>
        <Text>
          The curve rises quickly and then flattens, the shape in the paper&apos;s Figure 2. Most of the gain is in the first 5 to 10 paths. When mistakes clump on one wrong answer, extra paths do not help.
        </Text>
      </Section>

      <Section heading="Demo 3: the paper's results" caption="Tables 2 and 3. Orange is one greedy chain of thought. Green is self-consistency with 40 sampled paths.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={[
              { value: "arith", label: "Math word problems" },
              { value: "common", label: "Commonsense + symbolic" },
            ]}
            value={group}
            onChange={(value) => {
              setGroup(value as "arith" | "common");
              setTick((countValue) => countValue + 1);
            }}
          />
          <Button label="Race again" onClick={() => setTick((countValue) => countValue + 1)} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <Segmented
            options={MODELS.map((name, index) => ({ value: String(index), label: name }))}
            value={model}
            onChange={(value) => {
              setModel(value);
              setTick((countValue) => countValue + 1);
            }}
          />
        </div>
        <ResultsRace group={group} model={Number.parseInt(model, 10)} tick={tick} />
        <Text>
          Self-consistency helps every model on nearly every task, with the largest gains on hard multi-step sets such as GSM8K and AQuA. It cannot rescue a task the model cannot do: UL2 20B scores 0% on 4-word last-letter puzzles either way.
        </Text>
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Prompt with chain-of-thought examples", detail: "The same hand-written examples as the chain-of-thought paper: eight for most math sets. No training." },
            { title: "Sample many reasoning paths", detail: "Turn on randomness. PaLM uses temperature 0.7 and top-40; UL2 and LaMDA use 0.5 and top-40; GPT-3 uses 0.7 with no top-k. The main results use 40 paths." },
            { title: "Keep only the final answers", detail: "Parse the answer at the end of each chain. The paper calls dropping the path itself marginalizing it out." },
            { title: "Take the majority", detail: "The most frequent answer wins. The share of paths that agree is also a confidence score." },
          ]}
        />
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "+17.9", label: "GSM8K gain, in points", detail: "PaLM 540B 56.5 → 74.4; code-davinci-002 60.1 → 78.0", tone: "success" },
            { value: "+12.2", label: "AQuA gain, in points", detail: "code-davinci-002 39.8 → 52.0", tone: "success" },
            { value: "40", label: "Sampled paths in the main results", detail: "5 to 10 paths gets most of the gain" },
            { value: "0", label: "Extra training or extra models" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["It helps every model they tried", "UL2 20B, LaMDA 137B, PaLM 540B and two GPT-3 Codex engines improve on arithmetic, commonsense and symbolic tasks (Tables 2 and 3)"],
            ["Larger models gain more", "About +3 to +6 points for UL2 20B, and +9 to +23 for LaMDA 137B and GPT-3"],
            ["A plain vote is enough", "PaLM 540B GSM8K (Table 1): unweighted vote 74.4%, normalized weighted sum 74.1%, unnormalized weighted sum 59.9%, normalized weighted average 22.1%"],
            ["It beats shuffling the prompt", "LaMDA 137B GSM8K (Table 7): 40 paths 27.7%, versus 40 prompt orders 19.2%, 3 prompt sets 18.6%, and greedy chain of thought 17.1%"],
            ["Diversity matters", "Beam search and sample-and-rank, which keep similar outputs, help much less (Table 6 and Figure 3)"],
            ["Imperfect prompts still gain", "LaMDA 137B GSM8K with wrong numbers in the example chains: greedy 14.9% → self-consistency 23.4%. Equation-only prompts: 5.0% → 6.5% (Table 8)"],
            ["It works with zero-shot chain of thought", "PaLM 540B GSM8K, “Let's think step by step”: 43.0% → 69.2% (Table 8)"],
            ["Agreement is a confidence signal", "The share of paths that match the final answer is highly correlated with accuracy on GSM8K (Figure 5)"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          Generating many answers costs more compute. The answers have to be something you can count, such as a number or a choice, so open-ended writing needs a different notion of agreement. Individual paths can still be wrong even when the vote is right.
        </Callout>
      </Section>

      <QuizSync slug="15-self-consistency" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
          In your own words: why can the most common answer across many sampled reasoning paths be right even when fewer than half of the paths are right, and when would voting stop helping?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Self-Consistency Improves Chain of Thought Reasoning (abstract)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/abs/2203.11171" },
            { title: "Self-Consistency (PDF)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/pdf/2203.11171" },
            { title: "Chain-of-thought prompting, the method this samples from", site: "Papers a Day", date: "2022", href: "/papers/14-chain-of-thought" },
            { title: "GPT-3, few-shot prompting and sampling", site: "Papers a Day", date: "2020", href: "/papers/08-gpt3" },
          ]}
        />
      </Section>
    </Page>
  );
}
