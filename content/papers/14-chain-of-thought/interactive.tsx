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
  Input,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// Demo 1 and demo 3 use the paper's numbers (Tables 2, 4, 5 and 6).
// Demo 2 walks through examples from the paper. The slip in step 2 is a made-up illustration.

const VIDEOS = [
  {
    file: "StandardVsCoT.mp4",
    title: "Same question, two ways to answer",
    caption:
      "Figure 1: with answer-only examples the model blurts 27. With examples that show their working, it writes the steps and gets 9. Nothing was retrained.",
  },
  {
    file: "EmergentScale.mp4",
    title: "It only switches on in big models",
    caption:
      "PaLM on GSM8K (Table 2): chain of thought does nothing at 8B, helps at 62B, and at 540B jumps from 17.9% to 56.9%, past the previous best of 55%.",
  },
  {
    file: "Ablation.mp4",
    title: "Is it really the reasoning?",
    caption:
      "LaMDA 137B on GSM8K (Table 6): an equation alone, filler dots, or reasoning after the answer stay near the 6.5% baseline. Only steps in words, before the answer, reach 14.3%.",
  },
];

const SIZES = ["8B", "62B", "540B"];
const BENCH = [
  { name: "GSM8K", short: "GSM8K", kind: "math word problems", std: [4.9, 9.6, 17.9], cot: [4.1, 29.9, 56.9] },
  { name: "SVAMP", short: "SVAMP", kind: "math word problems", std: [15.1, 48.2, 69.4], cot: [16.8, 46.7, 79.0] },
  { name: "MAWPS", short: "MAWPS", kind: "math word problems", std: [26.2, 61.8, 79.2], cot: [30.5, 80.3, 93.3] },
  { name: "StrategyQA", short: "Strategy", kind: "commonsense", std: [55.6, 58.4, 68.6], cot: [53.5, 63.4, 77.8] },
  { name: "Sports", short: "Sports", kind: "commonsense", std: [55.1, 72.1, 80.5], cot: [75.2, 93.6, 95.4] },
  { name: "Last letters", short: "Letters", kind: "symbolic, 2-word names", std: [2.6, 6.8, 7.6], cot: [18.8, 85.0, 99.4] },
  { name: "Coin flip, 4 people", short: "Coins", kind: "symbolic, longer than the examples", std: [50.9, 38.3, 54.8], cot: [51.8, 72.4, 90.2] },
];
const BAR_COLORS = [0x59a8ff, 0x73ccff, 0x8c99ff, 0xfa923d, 0xf472b6, 0x4ade80, 0xfacc15];
const HEIGHT_SCALE = 0.075;

const ABLATION_SETS = ["GSM8K", "SVAMP", "ASDiv", "MAWPS"];
const ABLATION = [
  { name: "Standard prompting", desc: "just the answer", color: 0x94a3b8, values: [6.5, 29.5, 40.1, 43.2] },
  { name: "Equation only", desc: "an equation, then the answer", color: 0x5aa9ff, values: [5.4, 35.1, 45.9, 50.1] },
  { name: "Variable compute only", desc: "dots as long as the equation", color: 0xfb923c, values: [6.4, 28.0, 39.4, 41.3] },
  { name: "Reasoning after answer", desc: "answer first, explanation after", color: 0xf472b6, values: [6.1, 30.7, 38.6, 43.6] },
  { name: "Chain of thought", desc: "steps in words, then the answer", color: 0x4ade80, values: [14.3, 36.7, 46.6, 57.9] },
];

type Chain = { question: string; steps: string[]; answer: string; leap: string };

function makeChain(problem: string, start: number, used: number, bought: number, slip: boolean): Chain {
  if (problem === "tennis") {
    const cans = 2 * 3 + (slip ? 1 : 0);
    return {
      question: "Roger has 5 tennis balls. He buys 2 more cans of tennis balls. Each can has 3 tennis balls. How many tennis balls does he have now?",
      steps: ["Roger started with 5 balls.", `2 cans of 3 tennis balls each is ${cans} tennis balls.`, `5 + ${cans} = ${5 + cans}.`],
      answer: String(5 + cans),
      leap: "?",
    };
  }
  if (problem === "coin") {
    const after = slip ? "heads" : "tails";
    return {
      question: "A coin is heads up. Phoebe flips the coin. Osvaldo does not flip the coin. Is the coin still heads up?",
      steps: ["The coin starts heads up.", `Phoebe flips it, so now it is ${after} up.`, `Osvaldo does not flip it, so it stays ${after} up.`],
      answer: after === "heads" ? "yes" : "no",
      leap: "?",
    };
  }
  const left = start - used + (slip ? 1 : 0);
  return {
    question: `The cafeteria had ${start} apples. If they used ${used} to make lunch and bought ${bought} more, how many apples do they have?`,
    steps: [
      `The cafeteria had ${start} apples originally.`,
      `They used ${used} to make lunch. So they had ${start} − ${used} = ${left}.`,
      `They bought ${bought} more apples, so they have ${left} + ${bought} = ${left + bought}.`,
    ],
    answer: String(left + bought),
    leap: start === 23 && used === 20 && bought === 6 ? "27" : "?",
  };
}

function labelStyle(color: string) {
  return `position:absolute;transform:translate(-50%,-50%);color:${color};font:600 12px sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000`;
}

function ScaleCity({ mode, selected, reveal }: { mode: string; selected: number; reveal: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ mode, selected, reveal, reduced });
  live.current = { mode, selected, reveal, reduced };

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
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(8, 14, 6);
      scene.add(key);
      scene.add(new THREE.GridHelper(18, 18, 0x243044, 0x1a2433));

      const shownStd = BENCH.map(() => [0, 0, 0]);
      const shownCot = BENCH.map(() => [0, 0, 0]);
      const bars: { mesh: import("three").Mesh; kind: "std" | "cot"; bench: number; size: number }[] = [];
      BENCH.forEach((_, bench) => {
        const x = -6 + bench * 2;
        for (let size = 0; size < 3; size += 1) {
          const z = -2.2 + size * 2.2;
          const ghost = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 1, 0.55),
            new THREE.MeshStandardMaterial({ color: 0xfb923c, transparent: true, opacity: 0.72, roughness: 0.45 }),
          );
          ghost.position.set(x - 0.34, 0.04, z);
          scene.add(ghost);
          bars.push({ mesh: ghost, kind: "std", bench, size });
          const solid = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 1, 0.55),
            new THREE.MeshStandardMaterial({ color: BAR_COLORS[bench], roughness: 0.38, metalness: 0.05 }),
          );
          solid.position.set(x + 0.34, 0.04, z);
          scene.add(solid);
          bars.push({ mesh: solid, kind: "cot", bench, size });
        }
      });

      const nameEls = BENCH.map((bench) => {
        const el = document.createElement("div");
        el.textContent = bench.short;
        el.style.cssText = labelStyle("#cbd5e1");
        labelLayer.appendChild(el);
        return el;
      });
      const sizeEls = SIZES.map((size) => {
        const el = document.createElement("div");
        el.textContent = `PaLM ${size}`;
        el.style.cssText = labelStyle("#e2e8f0");
        labelLayer.appendChild(el);
        return el;
      });
      const valueEls = [0, 1, 2].map(() => {
        const el = document.createElement("div");
        el.style.cssText = labelStyle("#facc15");
        labelLayer.appendChild(el);
        return el;
      });
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
        const height = canvas.clientHeight || 460;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      let yaw = 0.72;
      let pitch = 0.46;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.22, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const { mode: currentMode, selected: currentSelected, reveal: currentReveal, reduced: currentReduced } = live.current;
        const ease = currentReduced ? 1 : 0.08;
        BENCH.forEach((bench, benchIndex) => {
          for (let size = 0; size < 3; size += 1) {
            const targetStd = size < currentReveal ? bench.std[size] : 0;
            const targetCot = size < currentReveal ? bench.cot[size] : 0;
            shownStd[benchIndex][size] += (targetStd - shownStd[benchIndex][size]) * ease;
            shownCot[benchIndex][size] += (targetCot - shownCot[benchIndex][size]) * ease;
          }
        });
        bars.forEach(({ mesh, kind, bench, size }) => {
          const value = kind === "std" ? shownStd[bench][size] : shownCot[bench][size];
          const height = Math.max(0.04, value * HEIGHT_SCALE);
          mesh.scale.y = height;
          mesh.position.y = height / 2;
          const show = kind === "std" ? currentMode !== "cot" : currentMode !== "std";
          mesh.visible = show;
          const material = mesh.material as import("three").MeshStandardMaterial;
          const dim = currentSelected === bench ? 1 : 0.34;
          material.opacity = (kind === "std" ? 0.78 : 0.96) * dim;
          material.transparent = true;
          material.emissive.setHex(currentSelected === bench && kind === "cot" ? BAR_COLORS[bench] : 0x000000);
          material.emissiveIntensity = currentSelected === bench && kind === "cot" ? 0.18 : 0;
        });
        if (!drag && !currentReduced) yaw += 0.0022;
        const aspect = Math.max(camera.aspect, 0.45);
        const radius = Math.max(18, 9.2 / (Math.tan((40 * Math.PI) / 360) * aspect));
        const horizontal = Math.cos(pitch);
        camera.position.set(Math.sin(yaw) * radius * horizontal, 2.4 + Math.sin(pitch) * radius * 0.72, Math.cos(yaw) * radius * horizontal);
        camera.lookAt(0, 2.2, 0);
        BENCH.forEach((bench, index) => {
          nameEls[index].style.color = index === currentSelected ? "#facc15" : "#cbd5e1";
          project(-6 + index * 2, 0.2, 3.55, nameEls[index]);
        });
        SIZES.forEach((_, size) => {
          sizeEls[size].style.color = size < currentReveal ? "#e2e8f0" : "#475569";
          project(6.7, 0.35, -2.2 + size * 2.2, sizeEls[size]);
        });
        const chosen = BENCH[currentSelected];
        valueEls.forEach((el, size) => {
          if (size >= currentReveal) {
            el.style.visibility = "hidden";
            return;
          }
          const height = Math.max(chosen.std[size], chosen.cot[size]) * HEIGHT_SCALE;
          el.textContent = `${chosen.std[size]} → ${chosen.cot[size]}`;
          project(-6 + currentSelected * 2, height + 0.55, -2.2 + size * 2.2, el);
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
        canvas.removeEventListener("pointercancel", up);
        [...nameEls, ...sizeEls, ...valueEls].forEach((el) => el.remove());
        bars.forEach(({ mesh }) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
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
        aria-label="PaLM results for seven benchmarks. Orange columns are standard prompting. Colored columns are chain of thought. Drag to orbit."
        style={{ width: "100%", height: 460, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#0b1020" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", top: 10, left: 12, color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, pointerEvents: "none" }}>
        <span style={{ color: "#fb923c" }}>Orange</span> = standard prompting · <span style={{ color: "#4ade80" }}>color</span> = chain of thought · drag to orbit
      </div>
    </div>
  );
}

function Staircase({ chain, cot, play, slip }: { chain: Chain; cot: boolean; play: number; slip: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ chain, cot, slip, play, reduced, started: performance.now() });
  live.current = { ...live.current, chain, cot, slip, play, reduced };

  useEffect(() => {
    live.current.started = performance.now();
  }, [play, cot, slip, chain.answer]);

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
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1);
      key.position.set(6, 10, 8);
      scene.add(key);
      const grid = new THREE.GridHelper(16, 16, 0x243044, 0x1a2433);
      scene.add(grid);

      const make = (color: number, width: number) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, 1, 1.35),
          new THREE.MeshStandardMaterial({ color, roughness: 0.42 }),
        );
        scene.add(mesh);
        return mesh;
      };
      const pad = make(0x334155, 1.7);
      const steps = [0, 1, 2].map((index) => make([0x5aa9ff, 0x4ade80, 0xa78bfa][index], 1.45));
      const goal = make(0xfacc15, 1.55);
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x14532d, emissiveIntensity: 0.6 }),
      );
      scene.add(ball);
      const heights = [0.4, 1.35, 2.45, 3.55, 4.7];
      const xs = [0, 2.5, 5, 7.5, 10];
      const place = (mesh: import("three").Mesh, index: number) => {
        const height = heights[index];
        mesh.scale.y = height;
        mesh.position.set(xs[index], height / 2, 0);
      };
      place(pad, 0);
      steps.forEach((mesh, index) => place(mesh, index + 1));
      place(goal, 4);

      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 360;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.35;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
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
        const now = live.current;
        const elapsed = (performance.now() - now.started) / 1000;
        const stepColors = [0x5aa9ff, now.slip && now.cot ? 0xf87171 : 0x4ade80, 0xa78bfa];
        steps.forEach((mesh, index) => {
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.color.setHex(stepColors[index]);
        });
        const per = 1.3;
        let along = now.reduced ? 4 : now.cot ? Math.min(4, elapsed / per) : Math.min(1, elapsed / 1.6);
        if (!now.cot && !now.reduced) along = Math.min(1, elapsed / 1.6);
        const from = now.cot || now.reduced ? Math.min(3, Math.floor(along)) : 0;
        const to = now.cot || now.reduced ? Math.min(4, from + 1) : 4;
        const fraction = now.cot || now.reduced ? along - Math.floor(along) : along;
        const hop = now.cot ? 0.85 : 2.4;
        const y0 = heights[from] + 0.32;
        const y1 = heights[to] + 0.32;
        ball.position.set(
          xs[from] + (xs[to] - xs[from]) * fraction,
          y0 + (y1 - y0) * fraction + Math.sin(Math.PI * fraction) * hop,
          0,
        );
        (ball.material as import("three").MeshStandardMaterial).color.setHex(now.cot ? 0x4ade80 : 0xfb923c);
        if (!drag && !now.reduced) yaw += 0.0015;
        const aspect = Math.max(camera.aspect, 0.55);
        const radius = Math.max(16, 8.4 / (Math.tan((38 * Math.PI) / 360) * aspect));
        camera.position.set(5 + Math.sin(yaw) * radius * 0.55, 6.2, Math.cos(yaw) * radius * 0.72);
        camera.lookAt(5, 2.1, 0);
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        [pad, ...steps, goal, ball].forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
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
    <canvas
      ref={canvasRef}
      aria-label="A staircase of reasoning steps. In chain-of-thought mode a ball climbs each step. In answer-only mode it leaps to the answer."
      style={{ width: "100%", height: 360, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#0b1020" }}
    />
  );
}

function ChainText({ chain, cot, play }: { chain: Chain; cot: boolean; play: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? 99 : 0);
  useEffect(() => {
    if (reduced) {
      setShown(99);
      return;
    }
    setShown(0);
    let count = 0;
    const id = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count > chain.steps.length + 1) window.clearInterval(id);
    }, 1300);
    return () => window.clearInterval(id);
  }, [play, cot, reduced, chain.answer, chain.steps]);
  const fade = (step: number) => ({ opacity: shown > step ? 1 : 0.12, transition: reduced ? "none" : "opacity .5s" });
  return (
    <div style={{ background: "#0b1020", color: "#e2e8f0", borderRadius: 12, padding: 14, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ color: "#94a3b8" }}>Q: {chain.question}</div>
      {cot ? (
        <div>
          <span style={{ color: "#94a3b8" }}>A: </span>
          {chain.steps.map((step, index) => (
            <span key={step} style={{ ...fade(index), color: "#4ade80" }}>
              {step}{" "}
            </span>
          ))}
          <span style={{ ...fade(chain.steps.length), color: "#facc15", fontWeight: 700 }}>The answer is {chain.answer}.</span>
        </div>
      ) : (
        <div>
          <span style={{ color: "#94a3b8" }}>A: </span>
          <span style={{ ...fade(0), color: "#fb923c", fontWeight: 700 }}>The answer is {chain.leap}.</span>
          <div style={{ color: "#94a3b8", marginTop: 6 }}>
            {chain.leap === "27"
              ? "That 27 is the real output the paper shows for answer-only prompting on this problem (Figure 1). The right answer is 9."
              : "With answer-only examples, the model has to produce the final answer straight away."}
          </div>
        </div>
      )}
    </div>
  );
}

function AblationRace({ setIndex, tick }: { setIndex: number; tick: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ setIndex, tick, reduced, started: performance.now() });
  live.current = { ...live.current, setIndex, tick, reduced };

  useEffect(() => {
    live.current.started = performance.now();
  }, [setIndex, tick]);

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
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(4, 8, 6);
      scene.add(key);
      scene.add(new THREE.GridHelper(14, 14, 0x243044, 0x1a2433));
      const meshes = ABLATION.map((row) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 1, 1.15),
          new THREE.MeshStandardMaterial({ color: row.color, roughness: 0.4 }),
        );
        scene.add(mesh);
        return mesh;
      });
      const baselineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5.2, 0.2, 1.05), new THREE.Vector3(5.2, 0.2, 1.05)]);
      const baseline = new THREE.Line(
        baselineGeo,
        new THREE.LineDashedMaterial({ color: 0x94a3b8, dashSize: 0.22, gapSize: 0.14 }),
      );
      baseline.computeLineDistances();
      scene.add(baseline);
      const percentEls = ABLATION.map(() => {
        const el = document.createElement("div");
        el.style.cssText = labelStyle("#e2e8f0");
        labelLayer.appendChild(el);
        return el;
      });
      const shortNames = ["Standard", "Equation", "Dots", "After", "CoT"];
      const nameEls = shortNames.map((name) => {
        const el = document.createElement("div");
        el.textContent = name;
        el.style.cssText = labelStyle("#cbd5e1");
        labelLayer.appendChild(el);
        return el;
      });
      const point = new THREE.Vector3();
      const project = (x: number, y: number, z: number, el: HTMLDivElement) => {
        point.set(x, y, z).project(camera);
        el.style.left = `${(point.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-point.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };
      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 340;
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
        const elapsed = (performance.now() - live.current.started) / 1000;
        const grow = live.current.reduced ? 1 : Math.min(1, elapsed / 1.15);
        const eased = grow < 0.5 ? 2 * grow * grow : 1 - ((-2 * grow + 2) ** 2) / 2;
        const values = ABLATION.map((row) => row.values[live.current.setIndex]);
        const scale = 0.08;
        meshes.forEach((mesh, index) => {
          const height = Math.max(0.08, values[index] * scale * eased);
          mesh.scale.y = height;
          mesh.position.set(-4 + index * 2, height / 2, 0);
          percentEls[index].textContent = `${values[index]}%`;
          project(-4 + index * 2, height + 0.45, 0, percentEls[index]);
          project(-4 + index * 2, 0.02, 1.9, nameEls[index]);
        });
        const base = values[0] * scale;
        const positions = baseline.geometry.getAttribute("position");
        positions.setY(0, base);
        positions.setY(1, base);
        positions.needsUpdate = true;
        baseline.computeLineDistances();
        const aspect = Math.max(camera.aspect, 0.5);
        const radius = Math.max(13.5, 7.2 / (Math.tan((36 * Math.PI) / 360) * aspect));
        camera.position.set(0, 5.4, radius);
        camera.lookAt(0, 1.6, 0);
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        [...percentEls, ...nameEls].forEach((el) => el.remove());
        meshes.forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        baseline.geometry.dispose();
        (baseline.material as { dispose: () => void }).dispose();
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
        aria-label="Ablation bars for LaMDA 137B. The dashed line is standard prompting."
        style={{ width: "100%", height: 340, display: "block", borderRadius: 12, background: "#0b1020" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
    </div>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video
        src={`/videos/14-chain-of-thought/${file}`}
        preload="none"
        controls
        muted
        loop
        playsInline
        style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }}
      />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "What actually changes when you use chain-of-thought prompting?",
    options: [
      "The model is fine-tuned on math problems",
      "The few examples in the prompt show their working step by step, so the model writes steps before its answer",
      "The model gets a calculator",
    ],
    answer: 1,
    why: "No weights change. It is plain few-shot prompting, as in GPT-3, except each example answer is a short chain of reasoning ending in the answer. The model copies that style.",
  },
  {
    q: "What happened when small models (around 8B parameters or less) used chain of thought?",
    options: ["Big gains, just like large models", "Little or no gain, sometimes worse: they wrote fluent but illogical steps", "They refused to answer"],
    answer: 1,
    why: "The paper calls this an emergent ability of scale. Gains appear around 100B parameters. PaLM 8B went from 4.9% to 4.1% on GSM8K, while PaLM 540B went from 17.9% to 56.9%.",
  },
  {
    q: "In the ablation, the model wrote the reasoning after the answer. What happened?",
    options: ["It worked as well as chain of thought", "It stayed about the same as plain answers, so the steps must come before the answer to help", "It became perfect"],
    answer: 1,
    why: "LaMDA 137B on GSM8K scored 6.1% with reasoning after the answer, against 6.5% for standard prompting and 14.3% for chain of thought. The steps help because the model uses them to reach the answer.",
  },
  {
    q: "Why didn't just writing dots (more tokens, more compute) help?",
    options: ["Dots are too short", "The extra computation by itself isn't the secret; the useful part is expressing the intermediate steps in language", "Dots confuse the tokenizer"],
    answer: 1,
    why: "The variable-compute prompt gave the model as many dots as the equation has characters. It scored 6.4%, the same as the baseline, so the content of the steps matters.",
  },
  {
    q: "On GSM8K math word problems, what did PaLM 540B with eight chain-of-thought examples reach?",
    options: ["About 18%, same as standard prompting", "56.9%, beating the previous best (fine-tuned GPT-3 with a verifier, 55%)", "100%"],
    answer: 1,
    why: "Table 2 and Figure 2: 17.9% to 56.9%. The earlier record came from fine-tuning GPT-3 175B and adding a verifier. Chain of thought used eight examples and no fine-tuning.",
  },
];

export default function App() {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState("both");
  const [selected, setSelected] = useState("0");
  const [reveal, setReveal] = useState(3);
  const [problem, setProblem] = useState("cafe");
  const [cot, setCot] = useState(true);
  const [slip, setSlip] = useState(false);
  const [play, setPlay] = useState(0);
  const [apples, setApples] = useState("23");
  const [used, setUsed] = useState("20");
  const [bought, setBought] = useState("6");
  const [ablationSet, setAblationSet] = useState("GSM8K");
  const [ablationTick, setAblationTick] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const timers = useRef<number[]>([]);

  const scaleUp = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (reduced) {
      setReveal(3);
      return;
    }
    setReveal(0);
    [1, 2, 3].forEach((step) => {
      timers.current.push(window.setTimeout(() => setReveal(step), step * 1100));
    });
  };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const numberOf = (value: string, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : Math.max(0, Math.min(999, parsed));
  };
  const chain = makeChain(problem, numberOf(apples, 23), numberOf(used, 20), numberOf(bought, 6), slip);
  const selectedIndex = Number.parseInt(selected, 10);
  const bench = BENCH[selectedIndex];
  const replay = () => setPlay((value) => value + 1);

  return (
    <Page
      title="Chain-of-thought prompting: show the working, and a big model writes its own"
      summary="Paper #14 · Wei, Wang, Schuurmans et al., Google Research (Brain Team), NeurIPS 2022 · arXiv 2201.11903"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        If the examples in the prompt show their reasoning step by step, a large enough language model writes steps of its own and gets much better at math, commonsense, and symbolic problems. No fine-tuning.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          GPT-3 (paper #8) showed that a few examples in the prompt are enough for many tasks. Multi-step problems, such as math word problems, stayed hard, and Scaling Laws (paper #9) would have you expect a bigger model to help only smoothly. Here, answer-only examples barely improved with scale. The model had to jump straight to the final number.
        </Text>
        <Text>
          The change is to write the working in those eight examples, the way a student would: &quot;23 − 20 = 3, then 3 + 6 = 9.&quot; The model copies that style. Each step it writes becomes text it can read for the next token, so no single step has to solve the whole problem. The gain shows up around 100 billion parameters. PaLM 540B moved from 17.9% to 56.9% on GSM8K, past a fine-tuned GPT-3 with a verifier at 55%.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section
        heading="Demo 1: a city of the paper's results"
        caption="PaLM solve rates from Tables 2, 4 and 5. Orange columns are standard prompting. Colored columns are chain of thought. Drag to orbit."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={[
              { value: "both", label: "Both" },
              { value: "std", label: "Standard only" },
              { value: "cot", label: "Chain of thought only" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Button label="Play: grow the model" variant="primary" onClick={scaleUp} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <Segmented options={BENCH.map((item, index) => ({ value: String(index), label: item.name }))} value={selected} onChange={setSelected} />
        </div>
        <ScaleCity mode={mode} selected={selectedIndex} reveal={reveal} />
        <Metrics
          metrics={SIZES.map((size, index) => ({
            value: `${bench.std[index]}% → ${bench.cot[index]}%`,
            label: `PaLM ${size} on ${bench.name}`,
            detail: bench.kind,
            tone: bench.cot[index] - bench.std[index] > 5 ? "success" : bench.cot[index] < bench.std[index] ? "danger" : undefined,
          }))}
        />
        <Text>
          GSM8K and last-letter concatenation stay flat at 8B, then the chain-of-thought columns shoot up at 540B. That is the emergent shape. Coin flip with four people is longer than any example in the prompt, and only chain of thought handles it: 54.8% versus 90.2% at 540B.
        </Text>
      </Section>

      <Section
        heading="Demo 2: climb the reasoning staircase"
        caption="The problems and the chains are the paper's examples. The slip in step 2 is a made-up illustration of one wrong step."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Segmented
            options={[
              { value: "cafe", label: "Cafeteria apples" },
              { value: "tennis", label: "Tennis balls" },
              { value: "coin", label: "Coin flip" },
            ]}
            value={problem}
            onChange={(value) => {
              setProblem(value);
              replay();
            }}
          />
          <Toggle
            label="Show the working"
            value={cot}
            onChange={(value) => {
              setCot(value);
              replay();
            }}
          />
          <Toggle
            label="Make a slip in step 2"
            value={slip}
            onChange={(value) => {
              setSlip(value);
              replay();
            }}
          />
          <Button label="Replay" onClick={replay} />
        </div>
        {problem === "cafe" ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Input label="Apples at start" type="number" value={apples} onChange={(value) => { setApples(value); replay(); }} />
            <Input label="Used for lunch" type="number" value={used} onChange={(value) => { setUsed(value); replay(); }} />
            <Input label="Bought" type="number" value={bought} onChange={(value) => { setBought(value); replay(); }} />
          </div>
        ) : null}
        <Staircase chain={chain} cot={cot} play={play} slip={slip} />
        <div style={{ height: 10 }} />
        <ChainText chain={chain} cot={cot} play={play} />
        <Text>
          {cot
            ? slip
              ? "One wrong step carries through to a wrong final answer. Of 50 incorrect GSM8K chains from LaMDA 137B, 46% were almost right: a calculator slip, a symbol mix-up, or one missing step."
              : "Each step is small, and it is written down where the next step can use it. You can also read the chain and see where it went wrong."
            : "Answer-only prompting is one leap. On multi-step problems that is where the models stumbled, and a bigger model hardly helped."}
        </Text>
      </Section>

      <Section heading="Demo 3: is it really the reasoning?" caption="Table 6, LaMDA 137B, solve rate. The dashed line is standard prompting. These are the paper's numbers.">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <Segmented
            options={ABLATION_SETS}
            value={ablationSet}
            onChange={(value) => {
              setAblationSet(value);
              setAblationTick((count) => count + 1);
            }}
          />
          <Button label="Race again" onClick={() => setAblationTick((count) => count + 1)} />
        </div>
        <AblationRace setIndex={ABLATION_SETS.indexOf(ablationSet)} tick={ablationTick} />
        <p className="viz-note">
          {ABLATION.map((row) => `${row.name}: ${row.values[ABLATION_SETS.indexOf(ablationSet)]}% (${row.desc})`).join(" · ")}
        </p>
        <Text>
          An equation helps on the easier one- and two-step sets, not on GSM8K. Dots of the same length do nothing. Reasoning written after the answer does nothing. The steps have to be in words, and they have to come first.
        </Text>
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Start from a large pretrained model", detail: "The paper tests LaMDA up to 137B, GPT-3 up to 175B, PaLM up to 540B, plus UL2 20B and Codex. No fine-tuning." },
            { title: "Write eight examples that show their working", detail: "Each exemplar is a question, a chain of thought, and an answer, written by hand. The same eight are used for the math benchmarks except AQuA, which uses four." },
            { title: "Ask the new question after the examples", detail: "Greedy decoding continues the pattern: the model writes its own chain, then “The answer is …”." },
            { title: "Read the final answer off the chain", detail: "The chain is also a window into the path. It is not guaranteed to be correct, or to be the path the model really used." },
          ]}
        />
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "17.9% → 56.9%", label: "PaLM 540B on GSM8K", detail: "standard → chain of thought", tone: "success" },
            { value: "55%", label: "Previous best on GSM8K", detail: "fine-tuned GPT-3 175B plus a verifier" },
            { value: "~100B", label: "Where the gains start", detail: "an emergent ability of scale" },
            { value: "8", label: "Examples in the prompt", detail: "for most math benchmarks" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Math word problems", "PaLM 540B with chain of thought set a new state of the art on GSM8K, SVAMP (69.4 → 79.0) and MAWPS (79.2 → 93.3), and came within 2% on AQuA and ASDiv (Table 2)"],
            ["Harder problems gain more", "GSM8K more than doubled for the largest GPT-3 and PaLM models. The easiest one-step MAWPS subset barely changed, or got slightly worse"],
            ["Commonsense", "PaLM 540B: CommonsenseQA 78.1 → 79.9, StrategyQA 68.6 → 77.8, dates 49.0 → 65.3, sports 80.5 → 95.4 against an unaided enthusiast at 84%, SayCan 80.8 → 91.7 (Table 4)"],
            ["Longer than the examples", "Last-letter concatenation, 4-word names: 0.0 → 63.0. Coin flip with 4 people: 54.8 → 90.2. The examples only used 2 (Table 5)"],
            ["Small models do not benefit", "Below about 100B parameters, models wrote fluent but illogical chains and often scored worse than standard prompting"],
            ["Right answers, mostly right chains", "Of 50 correct LaMDA 137B GSM8K answers, every chain was logically and mathematically right except two that were coincidental"],
            ["Robust to the wording", "Different annotators, styles, and exemplar sets all beat standard prompting"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          Copying human working does not show that the network is reasoning. Hand-written chains are cheap for eight examples and could be costly as fine-tuning data. A chain can be wrong even when the answer is right, and the other way around. The gain only appears in very large models, so it is expensive to serve.
        </Callout>
      </Section>

      <QuizSync slug="14-chain-of-thought" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>In your own words: why does showing worked examples help a big model solve multi-step problems, and why do the steps have to come before the answer?</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Chain-of-Thought Prompting (abstract)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/abs/2201.11903" },
            { title: "Chain-of-Thought Prompting (PDF)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/pdf/2201.11903" },
            { title: "GPT-3, the few-shot prompting this builds on", site: "Papers a Day", date: "2020", href: "/papers/08-gpt3" },
            { title: "Scaling Laws, and why some skills appear only in large models", site: "Papers a Day", date: "2020", href: "/papers/09-scaling-laws" },
          ]}
        />
      </Section>
    </Page>
  );
}
