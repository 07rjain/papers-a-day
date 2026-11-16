"use client";

import {
  Page,
  Section,
  Text,
  Callout,
  Segmented,
  Button,
  Table,
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

// The room and the test grid are toy simulations. The three written examples and every claimed score are from the paper.

const VIDEOS = [
  {
    file: "ReflexionLoop.mp4",
    title: "The Reflexion loop",
    caption:
      "Figure 2: an Actor acts, an Evaluator says pass or fail, Self-Reflection turns that verdict into a lesson, and the lesson goes into a small memory. The lessons in the clip are illustrative. No weights are trained.",
  },
  {
    file: "MugAndLamp.mp4",
    title: "A real failure, a real lesson",
    caption:
      "Figure 5: told to examine the mug with the desklamp, the agent grabs the mug first and cannot use the lamp. The reflection says to find the lamp first. Trial 2 succeeds.",
  },
  {
    file: "ResultsAndAblations.mp4",
    title: "What the paper measured",
    caption:
      "HumanEval pass@1 91.0% versus GPT-4's 80.1%. ALFWorld 130 of 134. In Rust, dropping the reflection or the self-written tests removes the gain (Table 3).",
  },
];

const SPOTS = ["drawer 1", "drawer 2", "drawer 3", "shelf 1", "shelf 2", "cabinet 1", "desk 1", "desk 2", "sidetable 1", "garbagecan 1"];
const BUDGET = 4;
const MAX_TRIALS = 10;
const RADIUS = 4.2;

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

function shuffle(items: number[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

type Trial = { path: number[]; success: boolean; lesson: string };
type Episode = { lampAt: number; mugAt: number; trials: Trial[] };

function runEpisode(seed: number, mode: string, omega: number): Episode {
  const random = rng(seed);
  const lampAt = Math.floor(random() * SPOTS.length);
  let mugAt = Math.floor(random() * SPOTS.length);
  if (random() < 0.6) while (mugAt === lampAt) mugAt = Math.floor(random() * SPOTS.length);
  const memory: { empties: number[]; lamp: number; mug: number }[] = [];
  const trials: Trial[] = [];
  for (let trial = 0; trial < MAX_TRIALS; trial += 1) {
    let plan: number[];
    if (mode === "retry") plan = shuffle(SPOTS.map((_, index) => index), random);
    else {
      const window = memory.slice(-omega);
      const known: number[] = [];
      const empty: Record<number, boolean> = {};
      window.forEach((lesson) => {
        if (lesson.lamp >= 0 && !known.includes(lesson.lamp)) known.push(lesson.lamp);
        if (lesson.mug >= 0 && !known.includes(lesson.mug)) known.push(lesson.mug);
        lesson.empties.forEach((place) => {
          empty[place] = true;
        });
      });
      const rest = shuffle(SPOTS.map((_, index) => index).filter((index) => !known.includes(index) && !empty[index]), random);
      const stale = shuffle(SPOTS.map((_, index) => index).filter((index) => !known.includes(index) && empty[index]), random);
      plan = [...known, ...rest, ...stale];
    }
    const path = plan.slice(0, BUDGET);
    const foundLamp = path.includes(lampAt);
    const foundMug = path.includes(mugAt);
    const success = foundLamp && foundMug;
    const empties = path.filter((place) => place !== lampAt && place !== mugAt);
    const bits: string[] = [];
    if (foundLamp) bits.push(`the desklamp is on ${SPOTS[lampAt]}`);
    if (foundMug) bits.push(`the mug is in/on ${SPOTS[mugAt]}`);
    if (empties.length) bits.push(`${empties.map((place) => SPOTS[place]).join(", ")} had nothing useful`);
    const lesson = success ? "" : `Trial ${trial + 1} failed. ${bits.join("; ")}. Next time: go straight to what was found and skip the empty places.`;
    trials.push({ path, success, lesson });
    if (success) break;
    memory.push({ empties, lamp: foundLamp ? lampAt : -1, mug: foundMug ? mugAt : -1 });
  }
  return { lampAt, mugAt, trials };
}

function spotPosition(index: number, height: number) {
  const angle = (index / SPOTS.length) * Math.PI * 2;
  return { x: Math.cos(angle) * RADIUS, y: height, z: Math.sin(angle) * RADIUS };
}

function RoomScene({ episode, mode, omega, playKey }: { episode: Episode; mode: string; omega: number; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const memoryRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ episode, mode, omega, playKey, reduced, progress: 0 });
  live.current.episode = episode;
  live.current.mode = mode;
  live.current.omega = omega;
  live.current.reduced = reduced;

  useEffect(() => {
    live.current.playKey = playKey;
    live.current.progress = reduced ? 999 : 0;
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
      scene.background = new THREE.Color(0x060a14);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const light = new THREE.DirectionalLight(0xffffff, 0.9);
      light.position.set(4, 10, 6);
      scene.add(light);
      scene.add(new THREE.GridHelper(12, 12, 0x243044, 0x1a2433));
      const boxes = SPOTS.map((_, index) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.72, 0.72),
          new THREE.MeshStandardMaterial({ color: 0x334155 }),
        );
        const place = spotPosition(index, 0.36);
        mesh.position.set(place.x, place.y, place.z);
        scene.add(mesh);
        return mesh;
      });
      const labels = SPOTS.map((name) => {
        const el = document.createElement("div");
        el.textContent = name;
        el.style.cssText = "position:absolute;transform:translate(-50%,8px);color:#e2e8f0;font:12px sans-serif;text-shadow:0 1px 2px #000;white-space:nowrap";
        labelLayer.appendChild(el);
        return el;
      });
      const agent = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x93c5fd, emissiveIntensity: 0.45 }),
      );
      scene.add(agent);
      const historyLines: import("three").Line[] = [];
      const currentLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x5aa9ff }),
      );
      scene.add(currentLine);
      const projector = new THREE.Vector3();
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
      let yaw = 0.55;
      let pitch = 0.48;
      let drag: { x: number; y: number } | null = null;
      let builtKey = "";
      let builtTrial = -1;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.15, Math.min(1.1, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);

      const dropHistory = () => {
        historyLines.splice(0).forEach((line) => {
          scene.remove(line);
          line.geometry.dispose();
          (line.material as { dispose: () => void }).dispose();
        });
      };

      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const current = live.current;
        if (builtKey !== current.playKey) {
          builtKey = current.playKey;
          builtTrial = -1;
          dropHistory();
        }
        const span = BUDGET + 1.6;
        const total = current.episode.trials.length * span;
        if (current.reduced) current.progress = total;
        else current.progress = Math.min(total, current.progress + 0.04);
        const progress = current.progress;
        const trialIndex = Math.min(current.episode.trials.length - 1, Math.floor(progress / span));
        const local = current.reduced ? BUDGET + 1 : progress - trialIndex * span;
        const seen = Math.min(BUDGET, Math.floor(local));
        if (builtTrial !== trialIndex) {
          builtTrial = trialIndex;
          dropHistory();
          for (let pastIndex = 0; pastIndex < trialIndex; pastIndex += 1) {
            const past = current.episode.trials[pastIndex];
            const height = (trialIndex - pastIndex) * 0.55 + 0.2;
            const points = [new THREE.Vector3(0, height, 0)];
            past.path.forEach((place) => {
              const spot = spotPosition(place, height);
              points.push(new THREE.Vector3(spot.x, spot.y, spot.z));
            });
            const line = new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(points),
              new THREE.LineBasicMaterial({ color: past.success ? 0x4ade80 : 0x94a3b8, transparent: true, opacity: 0.4 }),
            );
            scene.add(line);
            historyLines.push(line);
          }
        }
        boxes.forEach((mesh, index) => {
          const visitedAt = current.episode.trials[trialIndex].path.indexOf(index);
          const visited = visitedAt >= 0 && visitedAt < seen;
          const useful = index === current.episode.lampAt || index === current.episode.mugAt;
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.color.setHex(!visited ? 0x334155 : useful ? 0xfacc15 : 0xf87171);
          material.emissive.setHex(visited && useful ? 0xfacc15 : 0x000000);
          material.emissiveIntensity = visited && useful ? 0.4 : 0;
          labels[index].textContent = visited && useful ? `${SPOTS[index]} · found` : SPOTS[index];
        });
        const path = current.episode.trials[trialIndex].path;
        const traveled = Math.min(path.length, Math.max(0, local));
        const points = [new THREE.Vector3(0, 0.9, 0)];
        for (let step = 0; step < Math.floor(traveled); step += 1) {
          const spot = spotPosition(path[step], 0.9);
          points.push(new THREE.Vector3(spot.x, spot.y, spot.z));
        }
        const whole = Math.floor(traveled);
        const fraction = traveled - whole;
        const from = whole === 0 ? { x: 0, z: 0 } : spotPosition(path[Math.min(path.length - 1, whole - 1)], 0.9);
        const nextPlace = path[Math.min(path.length - 1, whole)] ?? path[path.length - 1];
        const to = spotPosition(nextPlace, 0.9);
        const agentX = from.x + (to.x - from.x) * (whole >= path.length ? 1 : fraction);
        const agentZ = from.z + (to.z - from.z) * (whole >= path.length ? 1 : fraction);
        if (fraction > 0 && whole < path.length) points.push(new THREE.Vector3(agentX, 0.9, agentZ));
        agent.position.set(agentX, 0.9, agentZ);
        currentLine.geometry.dispose();
        currentLine.geometry = new THREE.BufferGeometry().setFromPoints(points.length > 1 ? points : [points[0], points[0]]);
        (currentLine.material as import("three").LineBasicMaterial).color.setHex(current.mode === "retry" ? 0x94a3b8 : 0x5aa9ff);
        if (!drag && !current.reduced) yaw += 0.0022;
        const aspect = Math.max(camera.aspect, 0.45);
        const distance = Math.max(12.5, 7.4 / (Math.tan((42 * Math.PI) / 360) * aspect));
        camera.position.set(Math.sin(yaw) * distance, 4.4 + Math.sin(pitch) * 3.2, Math.cos(yaw) * distance);
        camera.lookAt(0, 1.1, 0);
        labels.forEach((el, index) => {
          projector.copy(boxes[index].position).project(camera);
          const visible = projector.z < 1;
          el.style.display = visible ? "block" : "none";
          el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
          el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
        });
        const trial = current.episode.trials[trialIndex];
        const finished = local >= BUDGET + 0.2;
        if (statusRef.current) {
          statusRef.current.textContent = finished
            ? `Trial ${trialIndex + 1}${trial.success ? " · found the desklamp and the mug" : " · ran out of visits"}`
            : `Trial ${trialIndex + 1} · visit ${Math.min(BUDGET, seen + 1)} of ${BUDGET}`;
        }
        if (memoryRef.current) {
          if (current.mode === "retry") {
            memoryRef.current.textContent = "Retry only: each try starts from scratch. Older paths stay in the tower, and nothing is written down.";
          } else {
            const lessons = current.episode.trials
              .slice(0, trialIndex)
              .map((item) => item.lesson)
              .filter(Boolean)
              .slice(-current.omega);
            memoryRef.current.textContent = lessons.length
              ? `Memory, last ${current.omega}: ${lessons.join(" ")}`
              : "Memory is empty on the first try.";
          }
        }
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        labels.forEach((el) => el.remove());
        dropHistory();
        boxes.forEach((mesh) => {
          mesh.geometry.dispose();
          (mesh.material as { dispose: () => void }).dispose();
        });
        agent.geometry.dispose();
        (agent.material as { dispose: () => void }).dispose();
        currentLine.geometry.dispose();
        (currentLine.material as { dispose: () => void }).dispose();
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
        aria-label="Toy room. Ten containers sit on a ring. The agent looks for a desklamp and a mug. Older failed trials stack upward."
        style={{ width: "100%", height: 460, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#060a14" }}
      />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      <p ref={statusRef} className="viz-note" style={{ position: "absolute", left: 12, top: 8, margin: 0, color: "#e2e8f0" }}>
        Trial 1
      </p>
      <p ref={memoryRef} className="viz-note">
        {mode === "retry" ? "Retry only." : `Memory window Ω = ${omega}.`}
      </p>
    </div>
  );
}

const LOOP_ROLES = [
  { name: "Actor", color: 0x5aa9ff },
  { name: "Evaluator", color: 0xfacc15 },
  { name: "Self-reflection", color: 0xf472b6 },
  { name: "Memory", color: 0x4ade80 },
];

function LoopScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
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
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
      camera.position.set(0, 4.2, 7.2);
      camera.lookAt(0, 0.4, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const light = new THREE.DirectionalLight(0xffffff, 0.7);
      light.position.set(3, 6, 4);
      scene.add(light);
      const nodes = LOOP_ROLES.map((role, index) => {
        const angle = (index / LOOP_ROLES.length) * Math.PI * 2 - Math.PI / 2;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 20, 14),
          new THREE.MeshStandardMaterial({ color: role.color, emissive: role.color, emissiveIntensity: 0.25 }),
        );
        mesh.position.set(Math.cos(angle) * 2.4, 0.5, Math.sin(angle) * 2.4);
        scene.add(mesh);
        const next = LOOP_ROLES[(index + 1) % LOOP_ROLES.length];
        const nextAngle = ((index + 1) / LOOP_ROLES.length) * Math.PI * 2 - Math.PI / 2;
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(Math.cos(angle) * 2.4, 0.5, Math.sin(angle) * 2.4),
            new THREE.Vector3(Math.cos(nextAngle) * 2.4, 0.5, Math.sin(nextAngle) * 2.4),
          ]),
          new THREE.LineBasicMaterial({ color: next ? 0x334155 : 0x334155 }),
        );
        scene.add(line);
        return mesh;
      });
      const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(pulse);
      const labels = LOOP_ROLES.map((role) => {
        const el = document.createElement("div");
        el.textContent = role.name;
        el.style.cssText = "position:absolute;transform:translate(-50%,-160%);color:#e2e8f0;font:600 13px sans-serif;text-shadow:0 1px 2px #000";
        labelLayer.appendChild(el);
        return el;
      });
      const projector = new THREE.Vector3();
      const resize = () => {
        const width = canvas.clientWidth || 700;
        const height = canvas.clientHeight || 320;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let turn = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        if (!reducedRef.current) turn += 0.008;
        const index = Math.floor(turn) % 4;
        const fraction = turn - Math.floor(turn);
        const from = nodes[index].position;
        const to = nodes[(index + 1) % 4].position;
        pulse.position.lerpVectors(from, to, fraction);
        nodes.forEach((mesh, nodeIndex) => {
          (mesh.material as import("three").MeshStandardMaterial).emissiveIntensity = nodeIndex === index ? 0.7 : 0.15;
        });
        labels.forEach((el, nodeIndex) => {
          projector.copy(nodes[nodeIndex].position).project(camera);
          el.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
          el.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
        });
        renderer.render(scene, camera);
      };
      loop();
      cleanup = () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
        labels.forEach((el) => el.remove());
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
      <canvas ref={canvasRef} aria-label="The Reflexion loop: Actor, Evaluator, Self-reflection, and Memory." style={{ width: "100%", height: 320, display: "block", borderRadius: 12, background: "#0b1020" }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    </div>
  );
}

const EXAMPLES = [
  {
    name: "ALFWorld: mug and desklamp",
    task: "Task: examine the mug with the desklamp.",
    source: "Figure 5, abridged",
    steps: [
      { text: "think: find and take a mug, then find and use a desklamp.", bad: true },
      { text: "go to drawer 1 … open drawer 6. Nothing useful." },
      { text: "go to desk 1. You see a creditcard, a desklamp, a laptop, and a mug." },
      { text: "take mug 1 from desk 1.", bad: true },
      { text: "use desklamp 1. Nothing happens." },
    ],
    reflection:
      "The task says to examine the mug with the desklamp. I should have looked for the desklamp first. It was on desk 1. Next trial, go to desk 1, find the lamp, then the mug, and examine the mug with the lamp.",
    next: ["go to desk 1", "take mug 1 from desk 1", "use desklamp 1. You turn on the desklamp.", "Status: success"],
  },
  {
    name: "HotpotQA + ReAct: 'Allo 'Allo!",
    task: "Grown-Ups starred the actor best known for which role on \"'Allo 'Allo!\"?",
    source: "Figure 7, abridged",
    steps: [
      { text: "Search[Grown-Ups]. The cast includes Sam Kelly." },
      { text: "Search[\"'Allo 'Allo!\"]. Could not find it. Similar names include Gorden Kaye.", bad: true },
      { text: "Search[Gorden Kaye]. Best known for René Artois.", bad: true },
      { text: "Finish[Rene Artois]. Incorrect." },
    ],
    reflection:
      "I searched the show title and got no page, then followed the wrong similar name. I should have searched the actor from Grown-Ups, Sam Kelly, to find the role he is known for on the show.",
    next: ["Search[Grown-Ups]. Sam Kelly is in the cast.", "Search[Sam Kelly]. Captain Hans Geering in 'Allo 'Allo!", "Finish[Captain Hans Geering]. Correct."],
  },
  {
    name: "HotpotQA + CoT: two authors",
    task: "What profession do John Lanchester and Alan Dean Foster have in common?",
    source: "Appendix D.2",
    steps: [
      { text: "John Lanchester is a novelist, journalist, and critic." },
      { text: "Alan Dean Foster is a novelist and screenwriter." },
      { text: "So they share novelist and screenwriter.", bad: true },
      { text: "Finish[novelist and screenwriter]. Incorrect." },
    ],
    reflection:
      "I assumed the two lists matched. Next time, compare the professions one by one. The overlap is novelist, not screenwriter.",
    next: ["Lanchester: novelist and journalist. Foster: novelist and screenwriter.", "The profession in common is novelist.", "Finish[novelist]. Correct."],
  },
];

function SignalDemo() {
  const reduced = useReducedMotion();
  const [exampleName, setExampleName] = useState(EXAMPLES[0].name);
  const [signal, setSignal] = useState("reward");
  const [typed, setTyped] = useState(0);
  const example = EXAMPLES.find((item) => item.name === exampleName) || EXAMPLES[0];
  useEffect(() => {
    if (signal !== "reflect" || reduced) {
      setTyped(example.reflection.length);
      return;
    }
    setTyped(0);
    const id = window.setInterval(() => {
      setTyped((count) => (count >= example.reflection.length ? count : count + 4));
    }, 16);
    return () => window.clearInterval(id);
  }, [exampleName, signal, reduced, example.reflection.length]);
  const showNext = signal === "reflect" && typed >= example.reflection.length;
  return (
    <Section heading="Demo 2: a number versus a lesson" caption="These failed attempts and reflections are from the paper (Figure 5, Figure 7, and Appendix D.2), shortened. A classic reward is one number. Reflexion adds a sentence.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Select label="Example" options={EXAMPLES.map((item) => item.name)} value={exampleName} onChange={setExampleName} />
        <Segmented
          options={[
            { value: "reward", label: "Signal: reward = 0" },
            { value: "reflect", label: "Signal: self-reflection" },
          ]}
          value={signal}
          onChange={setSignal}
        />
      </div>
      <div style={{ background: "#0b1020", borderRadius: 12, padding: 16, color: "#e2e8f0" }}>
        <p style={{ fontFamily: "ui-monospace, monospace", color: "#93c5fd" }}>
          {example.task} <span style={{ color: "#64748b" }}>· {example.source}</span>
        </p>
        <p style={{ fontFamily: "ui-monospace, monospace", color: "#94a3b8" }}>Trial 1</p>
        {example.steps.map((step) => (
          <div key={step.text} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, padding: "2px 8px", borderLeft: `3px solid ${signal === "reflect" && step.bad ? "#f87171" : "#334155"}`, background: signal === "reflect" && step.bad ? "rgba(248,113,113,0.12)" : "transparent", marginBottom: 2 }}>
            &gt; {step.text}
          </div>
        ))}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: signal === "reward" ? "rgba(148,163,184,0.12)" : "rgba(244,114,182,0.14)", border: `1px solid ${signal === "reward" ? "#475569" : "#f472b6"}` }}>
          {signal === "reward" ? (
            <div>
              <div style={{ fontSize: 34, fontWeight: 600, color: "#f87171" }}>reward = 0</div>
              <p style={{ color: "#94a3b8", margin: "6px 0 0" }}>That is the whole signal. Which step caused the failure is left unsaid.</p>
            </div>
          ) : (
            <p style={{ fontFamily: "ui-monospace, monospace", color: "#fbcfe8", margin: 0 }}>
              <b>Reflection: </b>
              {example.reflection.slice(0, typed)}
            </p>
          )}
        </div>
        {showNext ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontFamily: "ui-monospace, monospace", color: "#4ade80" }}>Trial 2, with the reflection in the prompt</p>
            {example.next.map((line) => (
              <div key={line} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, padding: "2px 8px", borderLeft: "3px solid #4ade80" }}>
                &gt; {line}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <Text>The highlighted steps are the ones the reflection blames. No weights change between the trials. The only new text is the lesson. The authors call that lesson a semantic gradient: a direction to improve, written in words.</Text>
    </Section>
  );
}

type Cell = { state: "ok" | "fp" | "wrong"; at: number };

function simulateCode(falsePositive: number, mode: string, seed: number): Cell[] {
  const random = rng(seed);
  const falseNegative = 0.1;
  const cells: Cell[] = [];
  for (let index = 0; index < 100; index += 1) {
    let skill = 1 - random() ** 1.6;
    const maxTrials = mode === "single" ? 1 : 5;
    for (let trial = 0; trial < maxTrials; trial += 1) {
      const correct = random() < skill;
      const pass = correct ? random() > falseNegative : random() < falsePositive;
      if (mode === "single") {
        cells.push({ state: correct ? "ok" : "wrong", at: 0 });
        break;
      }
      if (pass || trial === maxTrials - 1) {
        cells.push({ state: correct ? "ok" : pass ? "fp" : "wrong", at: trial });
        break;
      }
      if (mode === "reflexion") skill += 0.5 * (1 - skill);
    }
  }
  return cells;
}

function CodeGrid({ cells, playKey }: { cells: Cell[]; playKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ cells, reduced, progress: 0 });
  live.current.cells = cells;
  live.current.reduced = reduced;
  useEffect(() => {
    live.current.progress = reduced ? 6 : 0;
  }, [playKey, reduced]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    const draw = () => {
      if (dead) return;
      if (!live.current.reduced) live.current.progress = Math.min(5.5, live.current.progress + 0.02);
      const progress = live.current.progress;
      context.fillStyle = "#0b1020";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const columns = 20;
      const size = Math.min((canvas.width - 40) / columns, (canvas.height - 40) / 5);
      live.current.cells.forEach((cell, index) => {
        const x = 20 + (index % columns) * size;
        const y = 24 + Math.floor(index / columns) * size;
        const settled = progress > cell.at + 1;
        context.fillStyle = !settled ? "#78350f" : cell.state === "ok" ? "#4ade80" : cell.state === "fp" ? "#f472b6" : "#f87171";
        context.beginPath();
        context.roundRect(x + 3, y + 3, size - 6, size - 6, 4);
        context.fill();
      });
      if (progress < 5.5) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [playKey]);
  return <canvas ref={canvasRef} width={940} height={260} aria-label="Toy coding grid. Green is correct, pink is a false positive, red is wrong." style={{ width: "100%", borderRadius: 12, display: "block", background: "#0b1020" }} />;
}

function averageCorrect(falsePositive: number, mode: string) {
  let total = 0;
  for (let seed = 0; seed < 20; seed += 1) total += simulateCode(falsePositive, mode, 500 + seed).filter((cell) => cell.state === "ok").length;
  return total / 20;
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video src={`/videos/18-reflexion/${file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#0b1020", display: "block" }} />
      <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{caption}</p>
    </figure>
  );
}

const RESULT_BARS = [
  { label: "HumanEval Python, previous best", value: 65.8 },
  { label: "HumanEval Python, GPT-4", value: 80.1 },
  { label: "HumanEval Python, Reflexion", value: 91.0 },
  { label: "HumanEval Rust, 50 hardest, GPT-4", value: 60.0 },
  { label: "HumanEval Rust, 50 hardest, Reflexion", value: 68.0 },
  { label: "LeetCode Hard Python, GPT-4", value: 7.5 },
  { label: "LeetCode Hard Python, Reflexion", value: 15.0 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  {
    q: "Between one trial and the next, what does a Reflexion agent change?",
    options: ["Its neural-network weights, via gradient descent", "A short text memory of lessons it wrote about its own failures", "The task, to make it easier", "Nothing. It just samples again"],
    answer: 1,
    why: "There is no fine-tuning. Self-reflection writes a lesson, the last one to three lessons stay in memory, and the actor reads them in the next prompt.",
  },
  {
    q: "Why is a written reflection more useful than a reward of 0?",
    options: ["It is shorter", "It says which step went wrong and what to do instead", "Numeric rewards cannot be used with language models", "It makes the model bigger"],
    answer: 1,
    why: "A single 0 does not say whether step 2 or step 12 caused the failure. \"Look for the desklamp first\" points at the mistake and the fix.",
  },
  {
    q: "What are the three model roles in Reflexion?",
    options: ["Encoder, decoder, and critic", "Actor, Evaluator, and Self-Reflection", "Generator, discriminator, and judge", "Teacher, student, and grader"],
    answer: 1,
    why: "The actor attempts the task. The evaluator scores it. Self-reflection turns that score into a lesson.",
  },
  {
    q: "On HumanEval Python, what pass@1 did Reflexion reach, versus GPT-4 alone?",
    options: ["91.0% versus 80.1%", "74% versus 4%", "56.9% versus 17.9%", "100% versus 50%"],
    answer: 0,
    why: "Table 1: 91.0 versus 80.1. The other pairs are from earlier papers in this series.",
  },
  {
    q: "Why did Reflexion do slightly worse than GPT-4 on MBPP Python?",
    options: ["MBPP is only in Rust", "Its own tests passed wrong code 16.3% of the time, so it stopped and submitted bugs", "It ran out of memory", "It refused the problems"],
    answer: 1,
    why: "Table 2: false positives were 1.4% on HumanEval Python and 16.3% on MBPP Python. A false positive ends the loop before a reflection can help. The score was 77.1% versus GPT-4's 80.1%.",
  },
  {
    q: "In the Rust ablation, what happened without the self-reflection step, with tests still on?",
    options: ["Accuracy rose to 90%", "No gain over the base model: 60% versus 60%, while the full method reached 68%", "The run crashed", "It matched the full method"],
    answer: 1,
    why: "Table 3: tests found errors, but without a written diagnosis the fixes did not address them. Reflection without tests fell to 52%, because the agent could not tell when the code was already right.",
  },
];

export default function App() {
  const [mode, setMode] = useState("reflexion");
  const [omega, setOmega] = useState("3");
  const [seed, setSeed] = useState(3);
  const [falsePositive, setFalsePositive] = useState("1.4%");
  const [codeMode, setCodeMode] = useState("reflexion");
  const [codeSeed, setCodeSeed] = useState(11);
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const windowSize = Number.parseInt(omega, 10);
  const episode = useMemo(() => runEpisode(seed, mode, windowSize), [seed, mode, windowSize]);
  const roomStats = useMemo(() => {
    const summarize = (agent: string, limit: number) => {
      let solved = 0;
      let tries = 0;
      for (let index = 0; index < 300; index += 1) {
        const result = runEpisode(1000 + index, agent, limit);
        if (result.trials[result.trials.length - 1].success) {
          solved += 1;
          tries += result.trials.length;
        }
      }
      return { solved, average: solved ? tries / solved : 0 };
    };
    return { retry: summarize("retry", 1), one: summarize("reflexion", 1), three: summarize("reflexion", 3) };
  }, []);
  const rate = Number.parseFloat(falsePositive) / 100;
  const cells = useMemo(() => simulateCode(rate, codeMode, codeSeed), [rate, codeMode, codeSeed]);
  const averages = useMemo(
    () => ["single", "blind", "reflexion"].map((agent) => Math.round(averageCorrect(rate, agent))),
    [rate],
  );

  return (
    <Page
      title="Reflexion: write down the mistake, then try again"
      summary="Paper #18 · Shinn, Cassano, Berman, Gopinath, Narasimhan, Yao · Northeastern, MIT, and Princeton · NeurIPS 2023 · arXiv 2303.11366"
      width="wide"
    >
      <Callout tone="info" lead="The big idea in one line.">
        When an agent fails, have it write a short lesson about what went wrong, and put the last few lessons in the prompt for the next try. The weights stay frozen.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          ReAct (paper #16) lets a model think and act. Tree of Thoughts (paper #17) lets it explore several options inside one attempt. Chain of thought (paper #14) is the other common actor. None of those, by themselves, keep a lesson after the attempt is over. A later try starts blank. Classic reinforcement learning, as in InstructGPT (paper #10), would update weights. A reward of 0 still does not say which step failed.
        </Text>
        <Text>
          Reflexion uses three roles. The actor attempts the task. The evaluator scores the trajectory: exact match, a simple rule, another language model, or unit tests the model wrote. Self-reflection reads the trajectory, the score, and the existing notes, then writes a lesson. The memory keeps the last Ω lessons, usually one to three. The loop stops when the evaluator passes or the trial limit is hit. No fine-tuning.
        </Text>
      </Section>

      <Section heading="The four roles" caption="Actor, Evaluator, Self-Reflection, and Memory. No weights are trained.">
        <LoopScene />
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: a toy room, try after try" caption="Toy household task, in the spirit of ALFWorld. Find the desklamp and the mug, with only four visits per try. Older trials stack upward. The rooms and the search rule are made up.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
          <Segmented
            options={[
              { value: "retry", label: "Retry only" },
              { value: "reflexion", label: "Reflexion" },
            ]}
            value={mode}
            onChange={setMode}
          />
          {mode === "reflexion" ? (
            <Segmented
              options={[
                { value: "1", label: "Memory Ω = 1" },
                { value: "3", label: "Ω = 3" },
              ]}
              value={omega}
              onChange={setOmega}
            />
          ) : null}
          <Button label="New room" variant="primary" onClick={() => setSeed((value) => value + 1)} />
        </div>
        <RoomScene episode={episode} mode={mode} omega={windowSize} playKey={`${seed}-${mode}-${omega}`} />
        <Metrics
          metrics={[
            { value: `${roomStats.retry.solved}/300`, label: "Retry only, rooms solved in 10 tries", detail: `average ${roomStats.retry.average.toFixed(2)} tries when solved` },
            { value: `${roomStats.one.solved}/300`, label: "Reflexion, Ω = 1", detail: `average ${roomStats.one.average.toFixed(2)} tries` },
            { value: `${roomStats.three.solved}/300`, label: "Reflexion, Ω = 3", detail: `average ${roomStats.three.average.toFixed(2)} tries` },
          ]}
        />
        <Text>
          These 300 rooms, seeds 1000 to 1299, are this toy, not ALFWorld. The paper&apos;s ReAct-plus-Reflexion agent solved 130 of 134 ALFWorld tasks. ReAct alone plateaued and kept a 22% rate of thinking it held an object it did not.
        </Text>
      </Section>

      <SignalDemo />

      <Section heading="Demo 3: self-written tests, and the false-positive trap" caption="Toy coding problems. Green is truly correct, pink means the agent's own tests passed wrong code, red is wrong. The 1.4% and 16.3% rates are the paper's measured false-positive rates for HumanEval and MBPP Python. The problems themselves are made up.">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
          <Select label="How often bad code passes its own tests" options={["1.4%", "16.3%", "35%"]} value={falsePositive} onChange={setFalsePositive} />
          <Segmented
            options={[
              { value: "single", label: "Single" },
              { value: "blind", label: "Blind retry" },
              { value: "reflexion", label: "Reflexion" },
            ]}
            value={codeMode}
            onChange={setCodeMode}
          />
          <Button label="Replay" variant="primary" onClick={() => setCodeSeed((value) => value + 1)} />
        </div>
        <CodeGrid cells={cells} playKey={`${falsePositive}-${codeMode}-${codeSeed}`} />
        <svg width="100%" viewBox="0 0 640 120" role="img" aria-label="Toy accuracy for a single try, a blind retry, and Reflexion." style={{ display: "block", background: "#0b1020", borderRadius: 12, marginTop: 8 }}>
          {["Single", "Blind retry", "Reflexion"].map((label, index) => (
            <g key={label}>
              <text x={110} y={28 + index * 34} fill="#e2e8f0" fontSize="13" textAnchor="end">
                {label}
              </text>
              <rect x={124} y={12 + index * 34} height={18} rx={4} fill={index === 2 ? "#4ade80" : "#94a3b8"} width={(averages[index] / 100) * 430} />
              <text x={132 + (averages[index] / 100) * 430} y={26 + index * 34} fill="#ffffff" fontSize="12">
                {averages[index]}%
              </text>
            </g>
          ))}
        </svg>
        <p className="viz-note">
          Toy average over 20 seeds, starting at seed 500: single {averages[0]}%, blind retry {averages[1]}%, Reflexion {averages[2]}%. At 1.4% that is about 61 / 87 / 99. At 16.3% it is about 61 / 81 / 92. At 35% it is about 61 / 74 / 84.
        </p>
        <Text>
          A pink square ends the loop: the tests passed, so there is no reflection and no second chance. That is why Reflexion reached 91.0% on HumanEval Python and slipped from 80.1% to 77.1% on MBPP Python. In Rust, tests without a reflection stayed at the 60% base, while the full method reached 68% (Table 3).
        </Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "91.0%", label: "HumanEval Python pass@1", detail: "GPT-4 alone 80.1%. Previous best 65.8% (Table 1)", tone: "success" },
            { value: "130 / 134", label: "ALFWorld tasks solved", detail: "ReAct plus Reflexion. About 22 points over ReAct across 12 trials", tone: "success" },
            { value: "+20 pts", label: "HotpotQA, 100 questions", detail: "Over baselines that retry without a written reflection" },
            { value: "77.1%", label: "MBPP Python", detail: "Below GPT-4's 80.1%, because self-tests were unreliable", tone: "warning" },
          ]}
        />
        <svg width="100%" viewBox="0 0 760 280" role="img" aria-label="Pass rates from Table 1." style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
          {RESULT_BARS.map((bar, index) => {
            const y = 14 + index * 37;
            return (
              <g key={bar.label}>
                <text x={330} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">
                  {bar.label}
                </text>
                <rect x={342} y={y} height={18} rx={4} fill={index === 2 || index === 4 || index === 6 ? "#4ade80" : "#94a3b8"} width={(bar.value / 100) * 340} />
                <text x={350 + (bar.value / 100) * 340} y={y + 14} fill="#ffffff" fontSize="12">
                  {bar.value.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Retrying alone does not learn", "On HotpotQA, ReAct-only, chain-of-thought-only, and chain-of-thought with ground-truth context never solved a later trial after failing the first, at temperature 0.7"],
            ["A lesson beats remembering the last trace", "On HotpotQA with ground-truth context, keeping the failed trajectory helps, and a written reflection adds another 8 points (Figure 4c). Reflexion also improves that setup by 14 points from a 39% error rate"],
            ["Both tests and reflection matter", "HumanEval Rust, 50 hardest, Table 3: base 0.60, reflection without new tests 0.52, tests without reflection 0.60, full Reflexion 0.68"],
            ["Self-tests can be wrong", "Table 2: wrong solutions that still passed the agent's tests were about 1.4% on HumanEval Python and 16.3% on MBPP Python"],
            ["A harder coding set, after the training cutoff", "LeetCode Hard Python, Table 1: GPT-4 7.5% to Reflexion 15.0%. MBPP Rust 70.9% to 75.4%"],
            ["WebShop did not improve", "Appendix B.1: after four trials the reflections were not helpful. The task needed more varied exploration than the lessons suggested"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors note.">
          The method trusts the evaluator and the self-diagnosis. It can settle into a local minimum. Memory is a sliding window. Self-written tests struggle with randomness, side effects, and concurrency. There is no formal guarantee that the next trial is better.
        </Callout>
      </Section>

      <QuizSync slug="18-reflexion" picks={picks} answers={QUIZ.map((item) => item.answer)} />
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
          In your own words: how does a Reflexion agent get better from one try to the next without any training, and why would a written lesson help more than just being told that the try failed?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Reflexion: Language Agents with Verbal Reinforcement Learning (abstract)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/abs/2303.11366" },
            { title: "Reflexion (PDF)", site: "arxiv.org", date: "2023", href: "https://arxiv.org/pdf/2303.11366" },
            { title: "Official code", site: "github.com", date: "2023", href: "https://github.com/noahshinn/reflexion" },
            { title: "Tree of Thoughts", site: "Papers a Day", date: "2023", href: "/papers/17-tree-of-thoughts" },
            { title: "ReAct, a common actor for this method", site: "Papers a Day", date: "2023", href: "/papers/16-react" },
            { title: "Chain-of-thought prompting", site: "Papers a Day", date: "2022", href: "/papers/14-chain-of-thought" },
          ]}
        />
      </Section>
    </Page>
  );
}
