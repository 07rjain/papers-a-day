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
  Equation,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import { QuizSync } from "@/components/study/progress";
import { useReducedMotion } from "@/components/viz/shell";

// Demo 1 runs the real DPO gradient on a toy model: one prompt, six made-up answers, eight made-up pairs.
// Demo 2 plots the exact loss. The race and the claims table use numbers from the paper.

const VIDEOS = [
  {
    file: "TwoPipelines.mp4",
    title: "Same goal, two routes",
    caption:
      "RLHF trains a separate reward model, then runs reinforcement learning (PPO) that keeps sampling and scoring. DPO goes straight from the same preference pairs to the aligned model with one loss.",
  },
  {
    file: "ImplicitReward.mp4",
    title: "The language model is secretly a reward model",
    caption:
      "DPO's reward for an answer is β × log(new model's probability ÷ reference model's probability). Training raises the chosen answer and lowers the rejected one, relative to the frozen reference. Toy numbers.",
  },
  {
    file: "LossAndWeight.mp4",
    title: "The loss is gentle on easy pairs",
    caption:
      "The loss is −log σ(reward gap). When the model ranks a pair wrongly the push is big; when it already ranks it right, the push fades toward zero.",
  },
];

const ANSWERS = [
  { id: "A", name: "helpful, clear" },
  { id: "B", name: "helpful, wordy" },
  { id: "C", name: "polite, vague" },
  { id: "D", name: "off-topic" },
  { id: "E", name: "rude" },
  { id: "F", name: "made-up facts" },
];
const THETA0 = [0.2, 0.6, 0.9, 0.3, 0.1, 0.5];
const PAIRS: [number, number][] = [
  [0, 2],
  [0, 5],
  [1, 3],
  [1, 4],
  [0, 1],
  [2, 5],
  [2, 4],
  [1, 5],
];
const COLS = [0x4ade80, 0x86efac, 0x60a5fa, 0x94a3b8, 0xf87171, 0xf472b6];
const BAR_H = 8;

const softmax = (theta: number[]) => {
  const max = Math.max(...theta);
  const exps = theta.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
};
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

function pairMargin(theta: number[], beta: number, chosen: number, rejected: number) {
  return beta * (theta[chosen] - THETA0[chosen] - (theta[rejected] - THETA0[rejected]));
}

function policyStats(theta: number[], beta: number) {
  const policy = softmax(theta);
  const reference = softmax(THETA0);
  let loss = 0;
  let correct = 0;
  for (const [chosen, rejected] of PAIRS) {
    const margin = pairMargin(theta, beta, chosen, rejected);
    loss += -Math.log(sigmoid(margin));
    if (margin > 0) correct += 1;
  }
  const kl = policy.reduce((total, probability, index) => total + probability * Math.log(probability / reference[index]), 0);
  return { policy, reference, loss: loss / PAIRS.length, correct: correct / PAIRS.length, kl };
}

function dpoStep(theta: number[], beta: number, learningRate: number) {
  const gradient = theta.map(() => 0);
  for (const [chosen, rejected] of PAIRS) {
    const weight = sigmoid(-pairMargin(theta, beta, chosen, rejected));
    gradient[chosen] += weight;
    gradient[rejected] -= weight;
  }
  return theta.map((value, index) => value + (learningRate * gradient[index]) / PAIRS.length);
}

function PolicyScene({ theta, pulse }: { theta: number[]; pulse: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const thetaRef = useRef(theta);
  const pulseRef = useRef(pulse);
  const reducedRef = useRef(reduced);
  thetaRef.current = theta;
  pulseRef.current = pulse;
  reducedRef.current = reduced;

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
      scene.add(new THREE.AmbientLight(0xffffff, 0.62));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(6, 10, 4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
      fill.position.set(-6, 4, -3);
      scene.add(fill);

      const grid = new THREE.GridHelper(14, 14, 0x243044, 0x1a2433);
      scene.add(grid);

      const reference = softmax(THETA0);
      const shown = reference.slice();
      const solids: { mesh: import("three").Mesh; index: number }[] = [];
      const ghosts: import("three").Mesh[] = [];
      ANSWERS.forEach((_, index) => {
        const x = -5 + index * 2;
        const ghostHeight = Math.max(0.08, reference[index] * BAR_H);
        const ghost = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 1, 0.55),
          new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            transparent: true,
            opacity: 0.28,
            roughness: 0.8,
            depthWrite: false,
          }),
        );
        ghost.scale.y = ghostHeight;
        ghost.position.set(x - 0.48, ghostHeight / 2, 0.72);
        scene.add(ghost);
        ghosts.push(ghost);

        const solid = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 1, 0.78),
          new THREE.MeshStandardMaterial({ color: COLS[index], roughness: 0.38, metalness: 0.08 }),
        );
        solid.scale.y = ghostHeight;
        solid.position.set(x + 0.28, ghostHeight / 2, -0.05);
        scene.add(solid);
        solids.push({ mesh: solid, index });
      });

      const curves = PAIRS.map(() => {
        const positions = new Float32Array(33 * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.45 });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
        );
        scene.add(dot);
        return { positions, geometry, material, dot };
      });

      const letterEls = ANSWERS.map((answer) => {
        const el = document.createElement("div");
        el.textContent = answer.id;
        el.style.cssText =
          "position:absolute;transform:translate(-50%,-50%);color:#e2e8f0;font:600 13px sans-serif;text-shadow:0 1px 2px #000";
        labelLayer.appendChild(el);
        return el;
      });
      const percentEls = ANSWERS.map(() => {
        const el = document.createElement("div");
        el.style.cssText =
          "position:absolute;transform:translate(-50%,-120%);color:#fff;font:600 12px sans-serif;text-shadow:0 1px 2px #000";
        labelLayer.appendChild(el);
        return el;
      });

      const resize = () => {
        const width = canvas.clientWidth || 700;
        const height = canvas.clientHeight || 440;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      let yaw = 0.62;
      let pitch = 0.48;
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

      const project = (x: number, y: number, z: number, el: HTMLDivElement) => {
        const point = new THREE.Vector3(x, y, z).project(camera);
        if (point.z > 1) {
          el.style.visibility = "hidden";
          return;
        }
        el.style.visibility = "visible";
        el.style.left = `${(point.x * 0.5 + 0.5) * canvas.clientWidth}px`;
        el.style.top = `${(-point.y * 0.5 + 0.5) * canvas.clientHeight}px`;
      };

      let flash = 0;
      let seenPulse = pulseRef.current;
      let lastKey = "";
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const reducedNow = reducedRef.current;
        if (pulseRef.current !== seenPulse) {
          seenPulse = pulseRef.current;
          flash = 1;
        }
        const goal = softmax(thetaRef.current);
        const key = `${thetaRef.current.join(",")}|${seenPulse}|${yaw.toFixed(3)}|${pitch.toFixed(3)}`;
        const decorate = !reducedNow || drag !== null;
        if (!decorate && key === lastKey && flash === 0) return;
        lastKey = key;
        for (let index = 0; index < shown.length; index += 1) {
          shown[index] += (goal[index] - shown[index]) * (reducedNow ? 1 : 0.14);
        }
        if (!reducedNow) flash *= 0.94;
        else flash = 0;
        solids.forEach(({ mesh, index }) => {
          const height = Math.max(0.08, shown[index] * BAR_H);
          mesh.scale.y = height;
          mesh.position.y = height / 2;
        });
        const opacity = reducedNow ? 0.7 : 0.28 + 0.7 * flash;
        curves.forEach((curve, index) => {
          const [chosen, rejected] = PAIRS[index];
          const startX = -5 + chosen * 2 + 0.28;
          const endX = -5 + rejected * 2 + 0.28;
          const startY = Math.max(0.2, shown[chosen] * BAR_H);
          const endY = Math.max(0.2, shown[rejected] * BAR_H);
          const midX = (startX + endX) / 2;
          const midY = Math.max(startY, endY) + 1.15 + (index % 3) * 0.28;
          const midZ = 1.15;
          for (let step = 0; step <= 32; step += 1) {
            const t = step / 32;
            const u = 1 - t;
            curve.positions[step * 3] = u * u * startX + 2 * u * t * midX + t * t * endX;
            curve.positions[step * 3 + 1] = u * u * startY + 2 * u * t * midY + t * t * endY;
            curve.positions[step * 3 + 2] = u * u * -0.05 + 2 * u * t * midZ + t * t * -0.05;
          }
          curve.geometry.attributes.position.needsUpdate = true;
          curve.geometry.computeBoundingSphere();
          curve.material.opacity = opacity;
          const travel = reducedNow ? 0.5 : (performance.now() / 1400 + index / PAIRS.length) % 1;
          const tu = 1 - travel;
          curve.dot.position.set(
            tu * tu * startX + 2 * tu * travel * midX + travel * travel * endX,
            tu * tu * startY + 2 * tu * travel * midY + travel * travel * endY,
            tu * tu * -0.05 + 2 * tu * travel * midZ + travel * travel * -0.05,
          );
        });
        if (!drag && !reducedNow) yaw += 0.0025;
        const aspect = Math.max(camera.aspect, 0.35);
        const radius = Math.max(16.5, 7.6 / (Math.tan((42 * Math.PI) / 360) * aspect));
        const horizontal = Math.cos(pitch);
        camera.position.set(Math.sin(yaw) * radius * horizontal, Math.sin(pitch) * radius, Math.cos(yaw) * radius * horizontal);
        camera.lookAt(0, 1.7, 0.2);
        ANSWERS.forEach((_, index) => {
          const x = -5 + index * 2;
          project(x + 0.28, 0.02, 1.35, letterEls[index]);
          project(x + 0.28, shown[index] * BAR_H + 0.28, -0.05, percentEls[index]);
          percentEls[index].textContent = `${Math.round(shown[index] * 100)}%`;
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
        letterEls.forEach((el) => el.remove());
        percentEls.forEach((el) => el.remove());
        solids.forEach(({ mesh }) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        ghosts.forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        curves.forEach((curve) => {
          curve.geometry.dispose();
          curve.material.dispose();
          curve.dot.geometry.dispose();
          (curve.dot.material as { dispose: () => void }).dispose();
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
        aria-label="Toy DPO training scene. Solid columns are the model being trained. Ghost columns are the frozen reference. Yellow arcs are preference pairs."
        style={{ width: "100%", height: 440, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#0b1020" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <div style={{ position: "absolute", top: 10, left: 12, right: 12, color: "#cbd5e1", fontSize: 12, lineHeight: 1.45, pointerEvents: "none" }}>
        <div>Prompt (toy): &quot;How do I reset my password?&quot;</div>
        <div>
          <span style={{ color: "#94a3b8" }}>Ghost columns</span> = frozen reference · <span style={{ color: "#4ade80" }}>solid columns</span> = model being trained ·{" "}
          <span style={{ color: "#facc15" }}>yellow arcs</span> = 8 preference pairs · drag to orbit
        </div>
      </div>
    </div>
  );
}

function LossExplorer({ gap, setGap }: { gap: number; setGap: (next: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const gapRef = useRef(gap);
  const setGapRef = useRef(setGap);
  const reducedRef = useRef(reduced);
  gapRef.current = gap;
  setGapRef.current = setGap;
  reducedRef.current = reduced;
  const beginRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let disposed = false;
    let raf = 0;
    let shown = gapRef.current;
    const X0 = 60;
    const X1 = 780;
    const Y0 = 280;
    const Y1 = 30;
    const gx = (margin: number) => X0 + ((margin + 6) / 12) * (X1 - X0);
    const gy = (value: number) => Y0 - (value / 6.5) * (Y0 - Y1);
    const lossOf = (margin: number) => (margin > 0 ? Math.log1p(Math.exp(-margin)) : -margin + Math.log1p(Math.exp(margin)));

    const draw = (margin: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(248,113,113,0.08)";
      context.fillRect(X0, Y1, gx(0) - X0, Y0 - Y1);
      context.fillStyle = "rgba(74,222,128,0.08)";
      context.fillRect(gx(0), Y1, X1 - gx(0), Y0 - Y1);
      context.strokeStyle = "#475569";
      context.beginPath();
      context.moveTo(X0, Y0);
      context.lineTo(X1, Y0);
      context.moveTo(gx(0), Y0);
      context.lineTo(gx(0), Y1);
      context.stroke();
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "center";
      for (let tick = -6; tick <= 6; tick += 2) context.fillText(String(tick), gx(tick), Y0 + 16);
      context.fillText("reward gap = β·log-ratio(chosen) − β·log-ratio(rejected)", (X0 + X1) / 2, Y0 + 34);
      context.fillText("ranks the pair WRONG", (X0 + gx(0)) / 2, Y1 + 16);
      context.fillText("ranks the pair RIGHT", (gx(0) + X1) / 2, Y1 + 16);
      const strokeCurve = (fn: (margin: number) => number, color: string, dash: number[]) => {
        context.strokeStyle = color;
        context.lineWidth = 2.5;
        context.setLineDash(dash);
        context.beginPath();
        for (let sample = -6; sample <= 6.001; sample += 0.05) {
          const x = gx(sample);
          const y = gy(fn(sample));
          if (sample === -6) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
        context.setLineDash([]);
        context.lineWidth = 1;
      };
      strokeCurve(lossOf, "#facc15", []);
      strokeCurve((margin) => 5 * sigmoid(-margin), "#f472b6", []);
      strokeCurve(() => 5, "rgba(148,163,184,0.65)", [6, 6]);
      const loss = lossOf(margin);
      const push = sigmoid(-margin);
      context.strokeStyle = "rgba(255,255,255,0.35)";
      context.beginPath();
      context.moveTo(gx(margin), Y0);
      context.lineTo(gx(margin), Y1 + 24);
      context.stroke();
      for (const [value, color] of [
        [loss, "#facc15"],
        [5 * push, "#f472b6"],
      ] as [number, string][]) {
        context.fillStyle = color;
        context.beginPath();
        context.arc(gx(margin), gy(value), 6, 0, Math.PI * 2);
        context.fill();
      }
      context.textAlign = "right";
      context.font = "600 13px sans-serif";
      context.fillStyle = "#facc15";
      context.fillText(`loss −log σ(gap) = ${loss.toFixed(2)}`, X1 - 16, 112);
      context.fillStyle = "#f472b6";
      context.fillText(`push size σ(−gap) = ${push.toFixed(2)}`, X1 - 16, 132);
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.fillText("dashed: a naive loss that pushes every pair equally", X1 - 16, 152);
    };

    const begin = () => {
      cancelAnimationFrame(raf);
      const step = () => {
        if (disposed) return;
        const target = gapRef.current;
        shown += (target - shown) * (reducedRef.current ? 1 : 0.2);
        draw(shown);
        if (Math.abs(target - shown) > 0.02) raf = requestAnimationFrame(step);
      };
      step();
    };
    beginRef.current = begin;

    let dragging = false;
    const setFrom = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const next = Math.round(Math.max(-6, Math.min(6, ((x - X0) / (X1 - X0)) * 12 - 6)) * 10) / 10;
      setGapRef.current(next);
    };
    const down = (event: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      setFrom(event);
    };
    const move = (event: PointerEvent) => {
      if (dragging) setFrom(event);
    };
    const up = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    begin();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
  }, []);

  useEffect(() => {
    beginRef.current();
  }, [gap, reduced]);

  const loss = gap > 0 ? Math.log1p(Math.exp(-gap)) : -gap + Math.log1p(Math.exp(gap));
  const push = sigmoid(-gap);
  return (
    <div>
      <canvas
        ref={canvasRef}
        width={820}
        height={330}
        aria-label="DPO loss and push size against the reward gap. Drag sideways to move the gap."
        style={{ width: "100%", display: "block", borderRadius: 12, background: "#0b1020", cursor: "ew-resize", touchAction: "none" }}
      />
      <p className="viz-note">
        Reward gap {gap.toFixed(1)}. Loss −log σ(gap) = {loss.toFixed(2)}. Push size σ(−gap) = {push.toFixed(2)}.{" "}
        {gap < 0 ? "The model ranks this pair the wrong way, so the push is strong." : "The model ranks this pair the right way, so the push fades."}
      </p>
    </div>
  );
}

const RESULTS = [
  {
    group: "TL;DR summaries, GPT-4 win rate vs human-written (temp 0, Fig. 2)",
    rows: [
      { name: "DPO", value: 61, color: "#4ade80" },
      { name: "PPO (RLHF)", value: 57, color: "#fb923c" },
    ],
  },
  {
    group: "CNN/DailyMail news, win rate vs the reference summary (temp 0, Table 1)",
    rows: [
      { name: "DPO", value: 36, color: "#4ade80" },
      { name: "PPO (RLHF)", value: 26, color: "#fb923c" },
    ],
  },
  {
    group: "Human raters: DPO (temp 0.25) preferred over PPO (temp 0), Table 2",
    rows: [{ name: "DPO wins", value: 58, color: "#4ade80" }],
  },
];

function ResultsRace() {
  const reduced = useReducedMotion();
  let y = 14;
  return (
    <svg width="100%" viewBox="0 0 740 292" role="img" aria-label="DPO versus PPO: 61 percent versus 57 percent on TL;DR, 36 versus 26 on CNN/DailyMail, and humans preferred DPO 58 percent of the time." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      {RESULTS.map((group, groupIndex) => {
        const titleY = y;
        y += 28;
        const rows = group.rows.map((row) => {
          const rowY = y;
          y += 34;
          const width = (row.value / 100) * 480;
          return (
            <g key={row.name}>
              <text x={128} y={rowY + 16} textAnchor="end" fill="#e2e8f0" fontSize="13">
                {row.name}
              </text>
              <rect x={140} y={rowY} height={22} rx={6} fill={row.color} fillOpacity={0.9} width={reduced ? width : 0}>
                {reduced ? null : (
                  <animate attributeName="width" values={`0;${width};${width};0`} keyTimes="0;0.35;0.92;1" dur="6s" begin={`${groupIndex * 0.4}s`} repeatCount="indefinite" />
                )}
              </rect>
              <text x={150 + width} y={rowY + 16} fill="#fff" fontSize="13">
                {row.value}%
              </text>
            </g>
          );
        });
        y += 12;
        return (
          <g key={group.group}>
            <text x={16} y={titleY} fill="#cbd5e1" fontSize="13">
              {group.group}
            </text>
            {rows}
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
      <video
        src={`/videos/13-dpo/${file}`}
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
    q: "What does DPO remove from the RLHF recipe?",
    options: ["The human preference data", "The separate reward model and the reinforcement-learning loop", "The pre-trained starting model"],
    answer: 1,
    why: "DPO still learns from the same chosen-versus-rejected pairs and still starts from a supervised model. What it drops is training a standalone reward model and running PPO, which samples from the model during training.",
  },
  {
    q: "In DPO, where does the reward for an answer come from?",
    options: [
      "A second neural network trained on human scores",
      "β × log(new model's probability of the answer ÷ the frozen reference model's probability)",
      "The answer's length",
    ],
    answer: 1,
    why: "The math of the KL-limited RLHF objective says the best policy and the reward are linked, so the reward can be read off the policy's own probabilities relative to the reference.",
  },
  {
    q: "What does the β (beta) setting control?",
    options: ["How far the trained model is allowed to drift from the reference model", "The learning rate only", "How many answers are sampled per prompt"],
    answer: 0,
    why: "β is the same knob as the KL penalty in InstructGPT: it ties the new model to the reference. A small β lets the columns move far from the ghost columns; a large β keeps them close.",
  },
  {
    q: "Which training pairs get the biggest update in DPO?",
    options: ["Every pair gets the same push", "Pairs the model currently ranks the wrong way round", "Pairs the model already ranks correctly with a big gap"],
    answer: 1,
    why: "The gradient is weighted by σ(−gap), which is near 1 when the implicit reward prefers the rejected answer and near 0 when the pair is already well separated. A version without this weighting can make the language model degenerate.",
  },
  {
    q: "On Reddit TL;DR summarization, how did DPO compare with PPO-based RLHF?",
    options: ["Much worse, but cheaper", "About 61% win rate vs human-written summaries, beating PPO's best of about 57%", "Exactly the same"],
    answer: 1,
    why: "GPT-4 judged DPO summaries better than the human reference about 61% of the time at temperature 0, versus 57% for PPO at its best temperature. Human raters preferred DPO over PPO 58% of the time.",
  },
];

export default function App() {
  const [betaValue, setBetaValue] = useState("0.5");
  const beta = Number(betaValue);
  const [theta, setTheta] = useState<number[]>(THETA0.slice());
  const [steps, setSteps] = useState(0);
  const [auto, setAuto] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [gap, setGap] = useState(-2);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const stats = policyStats(theta, beta);
  const thetaRef = useRef(theta);
  const betaRef = useRef(beta);
  thetaRef.current = theta;
  betaRef.current = beta;

  const train = (count: number) => {
    let next = thetaRef.current;
    for (let step = 0; step < count; step += 1) next = dpoStep(next, betaRef.current, 0.5);
    thetaRef.current = next;
    setTheta(next);
    setSteps((value) => value + count);
    setPulse((value) => value + 1);
  };

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => train(10), 250);
    return () => window.clearInterval(id);
  }, [auto]);

  const reset = () => {
    setAuto(false);
    const fresh = THETA0.slice();
    thetaRef.current = fresh;
    setTheta(fresh);
    setSteps(0);
  };

  return (
    <Page title="DPO: align a language model from preferences, without reinforcement learning" summary="Paper #13 · Rafailov, Sharma, Mitchell et al., Stanford, NeurIPS 2023 · arXiv 2305.18290" width="wide">
      <Callout tone="info" lead="The big idea in one line.">
        The RLHF objective has a closed form: the best model is the reference model re-weighted by the reward. Read the reward back off the model, and a classification loss on preference pairs replaces the reward model and the RL loop.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          InstructGPT (paper #10) used RLHF. People compare pairs of answers, a separate reward model learns to score answers the way they would, and PPO then pushes the language model toward high scores, with a KL penalty so it does not drift too far from the supervised starting point. It works, but it needs extra models, samples from the language model during training, and can be unstable.
        </Text>
        <Text>
          For that same goal, the best policy is the reference policy times exp(reward / β), divided by a normalizer Z(x). Invert that and the reward is β log(π / π_ref) plus a term that depends only on the prompt. Plug this into the Bradley-Terry model of preferences and Z(x) cancels, because both answers share the prompt. What remains is one loss on the chosen and rejected answers. In the paper&apos;s tests, up to a 6B model, this matched or beat PPO-based RLHF.
        </Text>
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: train a tiny model with DPO" caption="Toy example: one prompt, six made-up answers, eight made-up preference pairs. The update is the real DPO gradient. Drag the scene to orbit.">
        <Text>
          Each solid column is how likely the model is to give that answer. The ghost column beside it is the frozen reference. Yellow arcs run from the chosen answer to the rejected one. Train, then change β and train again. A small β lets the columns run far from the ghosts. A large β keeps them close. At the start every pair is a tie, so the loss is log 2 ≈ 0.693.
        </Text>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0" }}>
          <Segmented options={["0.1", "0.5", "1", "3"].map((value) => ({ value, label: `β = ${value}` }))} value={betaValue} onChange={setBetaValue} />
          <Button label="Train" variant="primary" onClick={() => train(10)} />
          <Button label={auto ? "Pause" : "Auto-train"} onClick={() => setAuto((value) => !value)} />
          <Button label="Reset" onClick={reset} />
        </div>
        <PolicyScene theta={theta} pulse={pulse} />
        <p className="viz-note">
          {ANSWERS.map((answer) => `${answer.id}: ${answer.name}`).join(" · ")}. Each Train press runs 10 gradient steps. No answers are sampled, and no separate reward model scores them.
        </p>
        <Metrics
          metrics={[
            { value: String(steps), label: "Training steps so far" },
            { value: stats.loss.toFixed(3), label: "Average DPO loss over the 8 pairs (starts at log 2 ≈ 0.693)" },
            { value: `${Math.round(stats.correct * 100)}%`, label: "Pairs the implicit reward ranks correctly", tone: stats.correct === 1 ? "success" : undefined },
            { value: stats.kl.toFixed(3), label: "Drift from the reference, KL(π ‖ π_ref)" },
          ]}
        />
      </Section>

      <Section heading="Demo 2: the loss, by hand" caption="Exact DPO loss. Drag across the chart. The curves are the formula, not a fit to data.">
        <Text>
          For one pair the reward gap is how much the model has boosted the chosen answer minus how much it has boosted the rejected one, both measured against the reference and scaled by β. When the gap is negative the model has the pair backwards, the loss is high, and the push σ(−gap) is near 1. When the gap is comfortably positive, the push fades, so pairs that are already ranked correctly stop being driven further.
        </Text>
        <div style={{ margin: "8px 0" }}>
          <Segmented options={["-4", "-2", "0", "2", "4"].map((value) => ({ value, label: `gap ${value}` }))} value={String(Math.round(gap))} onChange={(value) => setGap(Number(value))} />
        </div>
        <LossExplorer gap={gap} setGap={setGap} />
      </Section>

      <Section heading="Demo 3: how it compared with PPO" caption="Numbers from the paper. GPT-4 is the judge except in the human row.">
        <ResultsRace />
        <p className="viz-note">
          TL;DR: DPO about 61% vs PPO&apos;s best about 57%, both at temperature 0. CNN/DailyMail, out of the training domain: 36% vs 26% at temperature 0 (31% vs 23% at 0.25). Humans preferred DPO over PPO 58% of the time.
        </p>
      </Section>

      <Section heading="How it works">
        <Steps
          steps={[
            { title: "Start from a supervised model", detail: "Fine-tune a pretrained model on good examples. Keep a frozen copy: the reference model π_ref." },
            { title: "Collect preference pairs", detail: "For a prompt x, people say which of two answers they prefer: chosen y_w and rejected y_l. This is the same kind of data RLHF uses." },
            { title: "Read the implicit reward", detail: "For each answer, r̂(x, y) = β log(π_θ(y|x) / π_ref(y|x)). It is how much more likely the model being trained makes that answer than the reference does." },
            { title: "Minimize one classification loss", detail: "L = −log σ(r̂(x, y_w) − r̂(x, y_l)), averaged over pairs. Ordinary gradient descent. The weight σ(−gap) is largest when the pair is currently ranked the wrong way." },
          ]}
        />
        <Equation>
          <span>
            L_DPO = −E[ log σ( β log(π_θ(y_w|x) / π_ref(y_w|x)) − β log(π_θ(y_l|x) / π_ref(y_l|x)) ) ]
          </span>
        </Equation>
        <Text>
          RLHF maximizes reward minus β times the KL distance from the reference. The optimal policy for that goal is π_ref(y|x) · exp(r(x, y) / β) / Z(x). Solving for the reward and substituting into the Bradley-Terry preference model cancels Z(x), because both answers share the prompt. The loss only needs the two models&apos; probabilities.
        </Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "≈61%", label: "TL;DR win rate vs human summaries (PPO best: 57%)", tone: "success" },
            { value: "58%", label: "Human raters preferred DPO over PPO" },
            { value: "0", label: "Reward models or RL steps in the training loop" },
            { value: "6B", label: "Largest model tested (GPT-J)" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Better reward per unit of drift", "Controlled sentiment on IMDb (GPT-2-large, true reward known): DPO had the best reward-versus-KL frontier, ahead of PPO even when PPO could see the true reward (Fig. 2, left)"],
            ["Summaries", "Reddit TL;DR with GPT-J 6B: DPO about 61% win rate vs human-written summaries at temperature 0; PPO 57% at its best temperature. DPO was more robust as temperature rose"],
            ["Dialogue", "Anthropic Helpful and Harmless, Pythia-2.8B: DPO was the only efficient method to improve on the dataset's chosen answers, similar to the expensive Best-of-128 baseline"],
            ["A new domain", "Models trained on TL;DR, tested on CNN/DailyMail: DPO 36% vs PPO 26% at temperature 0, and 31% vs 23% at 0.25 (Table 1)"],
            ["GPT-4 as a judge", "GPT-4 agreed with humans about as often as humans agreed with each other (Table 2)"],
            ["The weighting matters", "A version without the σ(−gap) weighting made the language model degenerate (Appendix Table 3)"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          The models tested go only up to 6B parameters. How DPO compares with an explicit reward model out of distribution, and how reward over-optimization shows up, still needed more study (they note a slight late dip in one dialogue plot). GPT-4 win rates also moved when the judging prompt changed.
        </Callout>
      </Section>

      <QuizSync slug="13-dpo" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
        <Text>In your own words: how can DPO learn from human preferences without ever training a separate reward model, and what job does β do?</Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Direct Preference Optimization (abstract)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/abs/2305.18290" },
            { title: "Direct Preference Optimization (PDF)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/pdf/2305.18290" },
            { title: "InstructGPT, the RLHF recipe DPO simplifies", site: "Papers a Day", date: "2022", href: "/papers/10-instructgpt" },
            { title: "LoRA, a cheap fine-tune that can sit under preference training", site: "Papers a Day", date: "2021", href: "/papers/12-lora" },
          ]}
        />
      </Section>
    </Page>
  );
}
