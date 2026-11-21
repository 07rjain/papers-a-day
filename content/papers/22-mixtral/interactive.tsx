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

// Router logits and token-to-expert colours are toy, imitating Figure 8. Architecture, 47B/13B, and Table 5 are from the paper.
// The per-expert split (about 5.64B each, about 1.6B shared) is arithmetic from Table 1. It reproduces the paper's 47B and 13B.

const VIDEOS = [
  {
    file: "RouterTopK.mp4",
    title: "One layer: router, top two, weighted sum",
    caption:
      "The Transformer's single feed-forward block is replaced by eight copies. A small linear router scores all eight for the current token, keeps the top two, turns those two scores into gates, and the output is the weighted sum of those two experts. The other six are never run. The logits in the clip are illustrative. The formula is Section 2.1.",
  },
  {
    file: "SparseVsDense.mp4",
    title: "Stored versus used: 47B in memory, 13B per token",
    caption:
      "Only the feed-forward blocks are copied eight times. Attention, embeddings, and the router are shared, so the total is 47B rather than 56B, and one token touches about 13B parameters. The per-part split is arithmetic from Table 1. The benchmark bars are Table 2 against Llama 2 70B.",
  },
  {
    file: "ExpertRouting.mp4",
    title: "Do experts specialise by topic? Mostly not",
    caption:
      "Section 5: expert usage looks similar for ArXiv, PubMed, PhilPapers, and GitHub. Routing tracks syntax instead. Consecutive tokens share a first-choice expert 27.9% of the time at layer 15 on ArXiv, against 12.5% for a random pick. Domain bars and token colours in the clip are illustrative. The Table 5 percentages are real.",
  },
];

const EXPERT_COLORS = ["#5aa9ff", "#4ade80", "#fb923c", "#f472b6", "#facc15", "#a78bfa", "#22d3ee", "#f87171"];
type Token = { text: string; kind: string };
const SAMPLES: Record<string, Token[]> = {
  python: [
    { text: "def", kind: "kw" }, { text: " area", kind: "name" }, { text: "(", kind: "punct" }, { text: "self", kind: "self" }, { text: ",", kind: "punct" }, { text: " r", kind: "name" }, { text: "):", kind: "punct" },
    { text: "↵", kind: "indent" }, { text: "return", kind: "kw" }, { text: " self", kind: "self" }, { text: ".", kind: "punct" }, { text: "pi", kind: "name" }, { text: " *", kind: "op" }, { text: " r", kind: "name" }, { text: " **", kind: "op" }, { text: " 2", kind: "num" },
  ],
  math: [
    { text: "Question", kind: "question" }, { text: ":", kind: "punct" }, { text: " Solve", kind: "word" }, { text: " 3", kind: "num" }, { text: "x", kind: "name" }, { text: " +", kind: "op" }, { text: " 5", kind: "num" }, { text: " =", kind: "op" }, { text: " 20", kind: "num" },
    { text: " for", kind: "word" }, { text: " x", kind: "name" }, { text: ".", kind: "punct" }, { text: " Answer", kind: "question" }, { text: ":", kind: "punct" }, { text: " 5", kind: "num" },
  ],
  english: [
    { text: "Question", kind: "question" }, { text: ":", kind: "punct" }, { text: " Why", kind: "word" }, { text: " do", kind: "word" }, { text: " leaves", kind: "word" }, { text: " change", kind: "word" }, { text: " colour", kind: "word" }, { text: " in", kind: "word" },
    { text: " autumn", kind: "word" }, { text: "?", kind: "punct" }, { text: " Answer", kind: "question" }, { text: ":", kind: "punct" }, { text: " Chlorophyll", kind: "word" }, { text: " breaks", kind: "word" }, { text: " down", kind: "word" }, { text: ".", kind: "punct" },
  ],
};
const KIND_EXPERT: Record<string, [number, number][]> = {
  kw: [[1, 5], [1, 3], [1, 2]],
  name: [[2, 0], [2, 6], [6, 2]],
  punct: [[0, 3], [0, 2], [0, 4]],
  self: [[6, 1], [6, 1], [6, 3]],
  indent: [[4, 7], [4, 7], [4, 7]],
  op: [[3, 7], [2, 3], [3, 0]],
  num: [[7, 3], [7, 2], [7, 5]],
  question: [[5, 1], [5, 1], [5, 2]],
  word: [[3, 2], [2, 3], [3, 6]],
};

function routeToken(token: Token, layer: number, index: number): [number, number, number] {
  const layerIndex = layer === 0 ? 0 : layer === 15 ? 1 : 2;
  const pair = KIND_EXPERT[token.kind] || [[index % 8, (index + 3) % 8], [index % 8, (index + 3) % 8], [index % 8, (index + 3) % 8]];
  let [first, second] = pair[layerIndex];
  if (layer === 0 && (token.kind === "word" || token.kind === "name") && index % 3 === 1) {
    const swap = first;
    first = second;
    second = swap;
  }
  const gate = 0.55 + ((index * 37 + layerIndex * 11) % 30) / 100;
  return [first, second, gate];
}

function towerPosition(index: number) {
  return { x: -3.7 + index * 1.06, y: 0, z: 1.6 + 0.35 * ((index - 3.5) / 3.5) ** 2 };
}

function ease(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function MoeScene({ tokens, layer, speed, paused }: { tokens: Token[]; layer: number; speed: number; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const tapeRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const reduced = useReducedMotion();
  const live = useRef({ tokens, layer, speed, paused, reduced, clock: 0 });
  live.current.tokens = tokens;
  live.current.layer = layer;
  live.current.speed = speed;
  live.current.paused = paused;
  live.current.reduced = reduced;
  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelsRef.current;
    const tape = tapeRef.current;
    if (!canvas || !labelLayer || !tape) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => {};
    import("three").then((THREE) => {
      if (dead) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05080f);
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const light = new THREE.DirectionalLight(0xffffff, 0.85);
      light.position.set(3, 10, 4);
      scene.add(light);
      scene.add(new THREE.GridHelper(14, 14, 0x243044, 0x1a2433));
      const towers = EXPERT_COLORS.map((hex, index) => {
        const place = towerPosition(index);
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 2.5, 0.72),
          new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.08, roughness: 0.45 }),
        );
        mesh.position.set(place.x, 1.25, place.z);
        scene.add(mesh);
        return mesh;
      });
      const router = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16), new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0xa78bfa, emissiveIntensity: 0.55 }));
      router.position.set(0, 1.5, 4.2);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5aa9ff }));
      const secondSpark = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      secondSpark.visible = false;
      const output = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
      output.position.set(0, 3.2, -1);
      output.visible = false;
      scene.add(router, spark, secondSpark, output);
      const beams = EXPERT_COLORS.map((hex) => {
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.5, 4.2), new THREE.Vector3()]),
          new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.12 }),
        );
        scene.add(line);
        return line;
      });
      const labels = EXPERT_COLORS.map(() => {
        const el = document.createElement("div");
        el.style.cssText = "position:absolute;transform:translate(-50%,-140%);color:#f8fafc;font:700 13px sans-serif;text-shadow:0 1px 3px #000;text-align:center;white-space:nowrap;";
        labelLayer.appendChild(el);
        return el;
      });
      const projector = new THREE.Vector3();
      const resize = () => {
        const width = canvas.clientWidth || 760;
        const height = canvas.clientHeight || 500;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      let yaw = 0.35;
      let pitch = 0.42;
      let drag: { x: number; y: number } | null = null;
      const down = (event: PointerEvent) => {
        drag = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture(event.pointerId);
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        yaw -= (event.clientX - drag.x) * 0.008;
        pitch = Math.max(0.12, Math.min(1.05, pitch + (event.clientY - drag.y) * 0.005));
        drag = { x: event.clientX, y: event.clientY };
      };
      const up = () => {
        drag = null;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      const glow = new Array(8).fill(0);
      let lastIndex = -1;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (dead) return;
        const current = live.current;
        const perToken = 1.6;
        if (current.reduced) current.clock = 0.55 * perToken;
        else if (!current.paused) current.clock += current.speed / 60;
        const count = Math.max(1, current.tokens.length);
        const index = Math.floor(current.clock / perToken) % count;
        const phase = (current.clock / perToken) % 1;
        const token = current.tokens[index];
        const [first, second, gate] = routeToken(token, current.layer, index);
        if (index !== lastIndex) lastIndex = index;
        glow.forEach((_, expert) => {
          glow[expert] *= 0.93;
        });
        if (phase > 0.45 || current.reduced) {
          glow[first] = Math.max(glow[first], gate);
          glow[second] = Math.max(glow[second], 1 - gate);
        }
        towers.forEach((mesh, expert) => {
          const material = mesh.material as import("three").MeshStandardMaterial;
          material.emissiveIntensity = 0.05 + glow[expert] * 0.9;
          const place = towerPosition(expert);
          const attribute = beams[expert].geometry.attributes.position as import("three").BufferAttribute;
          attribute.setXYZ(1, place.x, 1.3, place.z);
          attribute.needsUpdate = true;
          const chosen = expert === first || expert === second;
          (beams[expert].material as import("three").LineBasicMaterial).opacity = chosen && (phase > 0.3 || current.reduced) ? 0.85 : 0.08;
          projector.set(place.x, 2.7, place.z).project(camera);
          const label = labels[expert];
          label.style.display = projector.z < 1 ? "block" : "none";
          label.style.left = `${(projector.x * 0.5 + 0.5) * canvas.clientWidth}px`;
          label.style.top = `${(-projector.y * 0.5 + 0.5) * canvas.clientHeight}px`;
          const gateText = chosen && glow[expert] > 0.08 ? `<br>${(expert === first ? gate : 1 - gate).toFixed(2)}` : "";
          label.innerHTML = `E${expert}${gateText}`;
          label.style.color = chosen ? EXPERT_COLORS[expert] : "#e2e8f0";
        });
        const start = new THREE.Vector3(0, 1.5, 6.4);
        const routerPoint = new THREE.Vector3(0, 1.5, 4.2);
        const firstTop = new THREE.Vector3(towerPosition(first).x, 1.3, towerPosition(first).z);
        const secondTop = new THREE.Vector3(towerPosition(second).x, 1.3, towerPosition(second).z);
        const out = new THREE.Vector3(0, 3.2, -1);
        const mix = (a: import("three").Vector3, b: import("three").Vector3, t: number) => a.clone().lerp(b, ease(t));
        spark.visible = true;
        secondSpark.visible = false;
        output.visible = false;
        if (phase < 0.3 && !current.reduced) {
          spark.position.copy(mix(start, routerPoint, phase / 0.3));
          (spark.material as import("three").MeshBasicMaterial).color.set("#5aa9ff");
        }
        else if (phase < 0.7 && !current.reduced) {
          const t = (phase - 0.3) / 0.4;
          spark.position.copy(mix(routerPoint, firstTop, t));
          secondSpark.visible = true;
          secondSpark.position.copy(mix(routerPoint, secondTop, t));
          (spark.material as import("three").MeshBasicMaterial).color.set(EXPERT_COLORS[first]);
          (secondSpark.material as import("three").MeshBasicMaterial).color.set(EXPERT_COLORS[second]);
        } else if (!current.reduced) {
          const t = (phase - 0.7) / 0.3;
          spark.position.copy(mix(firstTop, out, t));
          secondSpark.visible = true;
          secondSpark.position.copy(mix(secondTop, out, t));
          output.visible = t > 0.85;
        } else {
          spark.position.copy(firstTop);
          secondSpark.visible = true;
          secondSpark.position.copy(secondTop);
          output.visible = true;
          (spark.material as import("three").MeshBasicMaterial).color.set(EXPERT_COLORS[first]);
          (secondSpark.material as import("three").MeshBasicMaterial).color.set(EXPERT_COLORS[second]);
        }
        if (!drag && !current.reduced && !current.paused) yaw = 0.35 + Math.sin(current.clock * 0.35) * 0.28;
        const distance = Math.max(12, 10.5 / Math.max(camera.aspect, 0.7));
        camera.position.set(Math.sin(yaw) * distance, 3.4 + Math.sin(pitch) * 2.2, Math.cos(yaw) * distance * 0.85);
        camera.lookAt(-0.2, 1.2, 1.4);
        if (statusRef.current) {
          const shown = token.text.replace(/^ /, "·");
          statusRef.current.textContent = `Layer ${current.layer} · token "${shown}" → E${first} (${gate.toFixed(2)}) + E${second} (${(1 - gate).toFixed(2)}). Six experts stay idle.`;
        }
        tape.innerHTML = current.tokens
          .map((item, tokenIndex) => {
            const expert = routeToken(item, current.layer, tokenIndex)[0];
            const currentToken = tokenIndex === index;
            const label = item.text.replace(/^ /, "·");
            return `<span style="background:${EXPERT_COLORS[expert]};opacity:${currentToken ? 1 : 0.45};color:${currentToken ? "#05080f" : "#e2e8f0"};padding:3px 6px;border-radius:4px;font-family:ui-monospace,monospace">${label}</span>`;
          })
          .join("");
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
        renderer.dispose();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, []);
  return (
    <div>
      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} aria-label="Eight expert towers and a router. A token flies in, splits to the top two experts, and their outputs merge." style={{ width: "100%", height: 520, display: "block", borderRadius: 12, cursor: "grab", touchAction: "none", background: "#05080f" }} />
        <div ref={labelsRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
      </div>
      <p ref={statusRef} className="viz-note">A token enters the router. Exactly two towers light up.</p>
      <div ref={tapeRef} style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }} />
    </div>
  );
}

function MoeDemo() {
  const [sample, setSample] = useState("python");
  const [layer, setLayer] = useState("15");
  const [speed, setSpeed] = useState("1");
  const [paused, setPaused] = useState(false);
  return (
    <Section heading="Demo 1: tokens through a mixture-of-experts layer" caption="Each token enters the router, which lights exactly two of the eight expert towers. Their outputs blend into one vector. Every token, at every layer, can pick a different pair. The routing here imitates the syntax pattern in Figure 8. The mechanism, top two of eight, is the paper's.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
        <Segmented options={[{ value: "python", label: "Python" }, { value: "math", label: "Math" }, { value: "english", label: "English" }]} value={sample} onChange={setSample} />
        <Segmented options={[{ value: "0", label: "Layer 0" }, { value: "15", label: "Layer 15" }, { value: "31", label: "Layer 31" }]} value={layer} onChange={setLayer} />
        <Segmented options={[{ value: "0.5", label: "Slow" }, { value: "1", label: "Normal" }, { value: "2", label: "Fast" }]} value={speed} onChange={setSpeed} />
        <Button label={paused ? "Play" : "Pause"} variant="primary" onClick={() => setPaused((value) => !value)} />
      </div>
      <MoeScene tokens={SAMPLES[sample]} layer={Number.parseInt(layer, 10)} speed={Number.parseFloat(speed)} paused={paused} />
      <Text>In the Python sample both copies of self light the same tower, and so does the punctuation. That is the kind of pattern Section 5 reports: experts line up with token shape, not with a subject such as biology or maths.</Text>
    </Section>
  );
}

const PER_EXPERT = 5.64;
const SHARED = 1.6;
const PRESETS: Record<string, number[]> = {
  clear: [0.2, -0.6, 3.1, 0.4, -1.2, 0.8, 2.6, -0.3],
  close: [1.1, 1.0, 1.2, 0.9, 1.05, 0.95, 1.15, 0.85],
  one: [-0.5, 0.1, 4.0, -0.2, -1.0, 0.3, 0.6, -0.8],
};

function gatesFor(logits: number[], k: number) {
  const order = logits.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
  const keep = new Set(order.slice(0, k).map((item) => item.index));
  const peak = Math.max(...logits);
  const exponents = logits.map((value, index) => (keep.has(index) ? Math.exp(value - peak) : 0));
  const total = exponents.reduce((sum, value) => sum + value, 0);
  return { keep, gates: exponents.map((value) => value / total) };
}

function TopKScene({ logits, k }: { logits: number[]; k: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const state = useRef({ logits, k, reduced });
  state.current = { logits, k, reduced };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let dead = false;
    let raf = 0;
    const shownLogits = new Array(8).fill(0);
    const shownGates = new Array(8).fill(0);
    const draw = () => {
      if (dead) return;
      const current = state.current;
      const { keep, gates } = gatesFor(current.logits, current.k);
      const rate = current.reduced ? 1 : 0.14;
      for (let index = 0; index < 8; index += 1) {
        shownLogits[index] += (current.logits[index] - shownLogits[index]) * rate;
        shownGates[index] += (gates[index] - shownGates[index]) * rate;
      }
      context.fillStyle = "#070b16";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const column = (canvas.width - 80) / 8;
      const mid = canvas.height * 0.38;
      const base = canvas.height - 42;
      context.strokeStyle = "rgba(148,163,184,0.35)";
      context.beginPath();
      context.moveTo(40, mid);
      context.lineTo(canvas.width - 30, mid);
      context.moveTo(40, base);
      context.lineTo(canvas.width - 30, base);
      context.stroke();
      context.fillStyle = "#94a3b8";
      context.font = "12px sans-serif";
      context.textAlign = "left";
      context.fillText("Router logits, toy values", 16, 20);
      context.fillText(`Gates: softmax over the top ${current.k} only. The rest are set to zero.`, 16, mid + 28);
      for (let index = 0; index < 8; index += 1) {
        const x = 56 + index * column;
        const on = keep.has(index);
        const height = shownLogits[index] * 26;
        context.fillStyle = on ? EXPERT_COLORS[index] : `${EXPERT_COLORS[index]}55`;
        context.fillRect(x, height > 0 ? mid - height : mid, column * 0.5, Math.abs(height));
        context.fillStyle = on ? "#e2e8f0" : "#94a3b8";
        context.textAlign = "center";
        context.fillText(current.logits[index].toFixed(1), x + column * 0.25, height > 0 ? mid - height - 6 : mid - height + 16);
        const gateHeight = shownGates[index] * (base - mid - 70);
        context.fillStyle = EXPERT_COLORS[index];
        context.globalAlpha = on ? 1 : 0.35;
        context.fillRect(x, base - gateHeight, column * 0.5, gateHeight);
        context.globalAlpha = 1;
        context.fillStyle = on ? "#ffffff" : "#94a3b8";
        context.font = on ? "bold 13px sans-serif" : "12px sans-serif";
        context.fillText(on ? gates[index].toFixed(2) : "0", x + column * 0.25, base - gateHeight - 6);
        context.fillStyle = EXPERT_COLORS[index];
        context.font = "bold 12px sans-serif";
        context.fillText(`E${index}`, x + column * 0.25, base + 18);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={canvasRef} width={980} height={380} aria-label="Eight router logits and the softmax gates of the experts that survive top-k." style={{ width: "100%", borderRadius: 12, display: "block", background: "#070b16" }} />;
}

function TopKDemo() {
  const [preset, setPreset] = useState("clear");
  const [logits, setLogits] = useState(PRESETS.clear);
  const [k, setK] = useState(2);
  const active = SHARED + k * PER_EXPERT;
  const total = SHARED + 8 * PER_EXPERT;
  const choose = (name: string) => {
    setPreset(name);
    if (name === "random") setLogits(Array.from({ length: 8 }, () => Math.round((Math.random() * 5 - 1.5) * 10) / 10));
    else setLogits(PRESETS[name]);
  };
  return (
    <Section heading="Demo 2: logits, top-k, and how many parameters run" caption="K is the compute dial. Stored parameters stay near 47B. The parameters each token uses grow with K. Mixtral uses K = 2. The logits are toy. The parameter split is arithmetic from Table 1 and lands on the paper's 47B and 13B.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <Segmented options={[{ value: "clear", label: "Two clear winners" }, { value: "close", label: "Near tie" }, { value: "one", label: "One dominant" }, { value: "random", label: "Random" }]} value={preset} onChange={choose} />
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          k = <b>{k}</b>
          <input aria-label="Number of experts that run" type="range" min={1} max={8} step={1} value={k} onChange={(event) => setK(Number.parseInt(event.target.value, 10))} />
        </label>
        <Button label="Mixtral setting, k = 2" variant={k === 2 ? "primary" : "quiet"} onClick={() => setK(2)} />
      </div>
      <TopKScene logits={logits} k={k} />
      <Metrics metrics={[
        { value: `${active.toFixed(1)}B`, label: `Active parameters per token, k = ${k}`, detail: "Shared about 1.6B plus k times about 5.64B. The paper rounds k = 2 to 13B.", tone: k === 2 ? "success" : undefined },
        { value: `${total.toFixed(1)}B`, label: "Parameters stored", detail: "The paper rounds this to 47B. All of them sit in memory." },
        { value: `${Math.round((active / total) * 100)}%`, label: "Share of the model each token touches" },
        { value: `${(70 / active).toFixed(1)}×`, label: "Fewer active parameters than Llama 2 70B", detail: "The paper says 5× fewer at k = 2", tone: k === 2 ? "success" : undefined },
      ]} />
      <Text>With k = 1 the router must discard a near tie. With k = 2 both experts run, blended by their gates. At k = 8 every expert runs, the model is dense, and there is no saving. Capacity, what is stored, and compute, what one token uses, are no longer the same number.</Text>
    </Section>
  );
}

const TABLE5: { source: string; first: [number, number, number]; both: [number, number, number] }[] = [
  { source: "ArXiv", first: [14.0, 27.9, 22.7], both: [46.5, 62.3, 52.9] },
  { source: "DM Mathematics", first: [14.1, 28.4, 19.7], both: [44.9, 67.0, 44.5] },
  { source: "Github", first: [14.9, 28.1, 19.7], both: [49.9, 66.9, 49.2] },
  { source: "Gutenberg", first: [13.9, 26.1, 26.3], both: [49.5, 63.1, 52.2] },
  { source: "PhilPapers", first: [13.6, 25.3, 22.1], both: [46.9, 61.9, 51.3] },
  { source: "PubMed Abstracts", first: [14.2, 24.6, 22.0], both: [48.6, 61.6, 51.8] },
  { source: "StackExchange", first: [13.6, 27.2, 23.6], both: [48.2, 64.6, 53.6] },
  { source: "Wikipedia", first: [14.4, 23.6, 25.3], both: [49.8, 62.1, 51.8] },
];

function RoutingDemo() {
  const [layer, setLayer] = useState("15");
  const [mode, setMode] = useState("first");
  const [hover, setHover] = useState<number | null>(null);
  const layerNumber = Number.parseInt(layer, 10);
  const layerIndex = layerNumber === 0 ? 0 : layerNumber === 15 ? 1 : 2;
  const ceiling = mode === "first" ? 35 : 75;
  const reference = mode === "first" ? 12.5 : 46;
  const rows = useMemo(() => TABLE5.map((row) => ({ source: row.source, value: mode === "first" ? row.first[layerIndex] : row.both[layerIndex] })), [mode, layerIndex]);
  return (
    <Section heading="Demo 3: what the experts actually specialise in" caption="The coloured strips are a toy recreation of Figure 8, not its exact colours. Select an expert to dim the others. The chart underneath is the real Table 5: how often token i and token i+1 share an expert.">
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <Segmented options={[{ value: "0", label: "Layer 0" }, { value: "15", label: "Layer 15" }, { value: "31", label: "Layer 31" }]} value={layer} onChange={setLayer} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {EXPERT_COLORS.map((color, index) => (
            <button key={color} type="button" onClick={() => setHover(hover === index ? null : index)} style={{ background: color, opacity: hover === null || hover === index ? 1 : 0.3, border: "none", borderRadius: 6, padding: "4px 10px", fontWeight: 600, color: "#05080f", cursor: "pointer" }}>
              E{index}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: "#070b16", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {Object.entries(SAMPLES).map(([name, tokens]) => {
          const firsts = tokens.map((token, index) => routeToken(token, layerNumber, index)[0]);
          const repeats = firsts.slice(1).filter((expert, index) => expert === firsts[index]).length;
          const title = name === "python" ? "Python" : name === "math" ? "Math" : "English";
          return (
            <div key={name}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>{title} · toy first-choice repeats: {repeats}/{tokens.length - 1}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, fontFamily: "ui-monospace, monospace" }}>
                {tokens.map((token, index) => (
                  <span key={`${token.text}-${index}`} style={{ background: EXPERT_COLORS[firsts[index]], opacity: hover === null || hover === firsts[index] ? 1 : 0.18, color: "#05080f", padding: "3px 5px", borderRadius: 4 }}>
                    {token.text.replace(/^ /, "\u00a0")}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ margin: "14px 0 8px" }}>
        <Segmented options={[{ value: "first", label: "Same first choice" }, { value: "both", label: "Same expert as first or second choice" }]} value={mode} onChange={setMode} />
      </div>
      <svg width="100%" viewBox="0 0 760 300" role="img" aria-label="Table 5, how often consecutive tokens share an expert." style={{ display: "block", background: "#070b16", borderRadius: 12 }}>
        <line x1={210} y1={16} x2={210} y2={268} stroke="#334155" />
        <line x1={210 + (reference / ceiling) * 460} y1={12} x2={210 + (reference / ceiling) * 460} y2={268} stroke="#facc15" strokeDasharray="4 4" />
        <text x={214 + (reference / ceiling) * 460} y={24} fill="#facc15" fontSize="12">{mode === "first" ? "random 12.5%" : "random about 46%"}</text>
        {rows.map((row, index) => {
          const y = 36 + index * 32;
          const width = (row.value / ceiling) * 460;
          return (
            <g key={row.source}>
              <text x={198} y={y + 14} fill="#e2e8f0" fontSize="13" textAnchor="end">{row.source}</text>
              <rect x={210} y={y} height={16} rx={3} fill="#a78bfa" width={width} />
              <text x={218 + width} y={y + 13} fill="#ffffff" fontSize="12">{row.value.toFixed(1)}%</text>
            </g>
          );
        })}
      </svg>
      <Text>Layer 0 sits near the random line, about 14% against 12.5%. At layers 15 and 31 consecutive tokens share an expert much more often, in every domain in the table. ArXiv, PubMed, and PhilPapers also get almost the same mix of experts. The experts are not a maths expert and a biology expert. They split the work by token shape and position.</Text>
    </Section>
  );
}

const BENCHMARKS: { name: string; llama: string; mixtral: string; mixtralWins: boolean }[] = [
  { name: "MMLU", llama: "69.9%", mixtral: "70.6%", mixtralWins: true },
  { name: "HellaSwag", llama: "85.4%", mixtral: "84.4%", mixtralWins: false },
  { name: "WinoGrande", llama: "80.4%", mixtral: "77.2%", mixtralWins: false },
  { name: "ARC-Challenge", llama: "56.5%", mixtral: "59.7%", mixtralWins: true },
  { name: "Natural Questions", llama: "25.4%", mixtral: "30.6%", mixtralWins: true },
  { name: "HumanEval", llama: "29.3%", mixtral: "40.2%", mixtralWins: true },
  { name: "MBPP", llama: "49.8%", mixtral: "60.7%", mixtralWins: true },
  { name: "MATH", llama: "13.8%", mixtral: "28.4%", mixtralWins: true },
  { name: "GSM8K", llama: "69.6%", mixtral: "74.4%", mixtralWins: true },
];

const ARENA = [
  { label: "Mixtral Instruct", value: 1121 },
  { label: "Claude 2.1", value: 1117 },
  { label: "GPT-3.5-Turbo, best", value: 1117 },
  { label: "Gemini Pro", value: 1111 },
  { label: "Llama 2 70B chat", value: 1077 },
];

type QuizItem = { q: string; options: string[]; answer: number; why: string };
const QUIZ: QuizItem[] = [
  { q: "Which part of the Transformer block becomes a mixture of experts?", options: ["The attention layer", "The feed-forward sub-block", "The embedding table", "The positional encoding"], answer: 1, why: "Section 2.1 replaces the feed-forward sub-block. Each expert is a SwiGLU feed-forward network. Attention stays shared. Mixtral replaces every feed-forward block. GShard replaced every other one." },
  { q: "For one token at one layer, how many experts run?", options: ["All eight, weighted", "Exactly two, chosen by the router", "One", "Anywhere from one to eight"], answer: 1, why: "Table 1 sets K to 2. The router keeps the two highest scores, a softmax turns them into gates, and the output is the weighted sum of those two experts. The other six are skipped." },
  { q: "Why is the total 47B parameters, not 8 times 7B?", options: ["The experts are compressed", "Only the feed-forward blocks are copied. Attention and embeddings are shared.", "Some layers are dropped", "The paper rounds down"], answer: 1, why: "From Table 1, one expert's feed-forward weights across 32 layers are about 5.6B, so eight experts are about 45B, plus about 1.6B shared, about 47B. One token uses the shared part plus two experts, about 13B." },
  { q: "What does 13B active parameters save?", options: ["Memory, not compute", "Compute per token. All 47B still have to sit in memory.", "Memory and compute equally", "Neither"], answer: 1, why: "Active parameters set the compute for one token. Memory follows the stored count, 47B, which is still below 70B. Routing adds overhead, and the setup suits batched work." },
  { q: "How did Mixtral compare with Llama 2 70B?", options: ["Worse on every benchmark", "It matched or beat Llama 2 on most benchmarks, with large gains on math and code, using about five times fewer active parameters", "Better only on reading comprehension", "Exactly equal everywhere"], answer: 1, why: "Table 2: MMLU 70.6 versus 69.9, GSM8K 74.4 versus 69.6, HumanEval 40.2 versus 29.3, MATH 28.4 versus 13.8. It was slightly behind on reading comprehension, and on HellaSwag and WinoGrande in that table." },
  { q: "What did the routing analysis find?", options: ["Each expert specialises in one topic, such as biology or maths", "No obvious topic specialisation. Routing tracks syntax, and consecutive tokens often share an expert.", "The router picks experts at random", "Only two experts are ever used in the whole model"], answer: 1, why: "Section 5 and Table 5. ArXiv, PubMed, and PhilPapers get similar expert mixes. At layer 15, consecutive tokens share a first-choice expert 23.6% to 28.4% of the time, against 12.5% for a random choice." },
];

export default function MixtralPage() {
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  return (
    <Page title="Mixtral: eight experts, two of them working" summary="Paper #22 · Jiang, Sablayrolles, Roux, Mensch, and colleagues · Mistral AI · January 2024 · arXiv 2401.04088" width="wide">
      <Callout tone="info" lead="The big idea in one line.">Replace each feed-forward block with eight copies and a router that sends every token to only two of them. The model stores 47 billion parameters and uses about 13 billion per token.</Callout>
      <Section heading="The plain-English version">
        <Text>The Transformer (paper #5) has two parts in every block. Attention lets tokens look at each other. Then a feed-forward network processes each token alone, and that is where most of the parameters sit. In a dense model every token pays for all of them. Scaling Laws (paper #9) and Chinchilla (paper #11) say a bigger model is better, and in a dense model bigger also means every token costs more.</Text>
        <Steps steps={[
          { title: "Attention, unchanged", detail: "The token is updated by the same attention block as Mistral 7B: 32 heads, 8 key-value heads, and a 32,000-token context." },
          { title: "The router scores eight experts", detail: "A 4096 by 8 matrix turns the token into eight scores." },
          { title: "Keep the top two", detail: "The other six scores are dropped, so those experts are never computed for this token." },
          { title: "Blend the two outputs", detail: "A softmax over the two survivors gives gates that sum to 1. The layer output is the weighted sum of the two expert outputs." },
          { title: "A new pair at every layer", detail: "Each of the 32 layers can pick a different pair, so across a sentence all 47 billion stored parameters can be used." },
        ]} />
      </Section>
      <Section heading="Watch: the idea, animated">
        {VIDEOS.map((video) => (
          <figure key={video.file} style={{ margin: "0 0 16px" }}>
            <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{video.title}</figcaption>
            <video src={`/videos/22-mixtral/${video.file}`} preload="none" controls muted loop playsInline style={{ width: "100%", borderRadius: 12, background: "#05080f", display: "block" }} />
            <p style={{ fontSize: 13, opacity: 0.75, margin: "4px 0 0" }}>{video.caption}</p>
          </figure>
        ))}
      </Section>
      <MoeDemo />
      <TopKDemo />
      <RoutingDemo />
      <Section heading="What the paper actually claimed">
        <Metrics metrics={[
          { value: "8 / 2", label: "Experts per layer, and experts used per token", detail: "Table 1" },
          { value: "47B", label: "Parameters stored", detail: "What has to fit in memory" },
          { value: "13B", label: "Active parameters per token", detail: "About 5× fewer than Llama 2 70B", tone: "success" },
          { value: "32k", label: "Context length", detail: "Passkey retrieval is 100% at every length and position (Figure 4)", tone: "success" },
        ]} />
        <Table columns={["Benchmark, Table 2", "Llama 2 70B", "Mixtral, 13B active"]} rows={BENCHMARKS.map((row) => [row.name, row.mixtralWins ? row.llama : { text: row.llama, tone: "success" as const }, row.mixtralWins ? { text: row.mixtral, tone: "success" as const } : row.mixtral])} />
        <Table columns={["Table 3", "Llama 2 70B", "GPT-3.5", "Mixtral"]} rows={[
          ["MMLU", "69.9%", "70.0%", { text: "70.6%", tone: "success" }],
          ["MBPP", "49.8%", "52.2%", { text: "60.7%", tone: "success" }],
          ["GSM-8K, 5-shot", "53.6%", "57.1%", { text: "58.4%", tone: "success" }],
          ["MT-Bench, instruct models", "6.86", { text: "8.32", tone: "success" }, "8.30"],
        ]} />
        <svg width="100%" viewBox="0 0 760 220" role="img" aria-label="LMSys Arena Elo from Figure 6, 22 December 2023." style={{ display: "block", background: "#070b16", borderRadius: 12 }}>
          {ARENA.map((row, index) => {
            const y = 18 + index * 38;
            const width = ((row.value - 1050) / 90) * 420;
            return (
              <g key={row.label}>
                <text x={230} y={y + 16} fill="#e2e8f0" fontSize="13" textAnchor="end">{row.label}</text>
                <rect x={242} y={y} height={18} rx={4} fill={index === 0 ? "#4ade80" : "#94a3b8"} width={Math.max(8, width)} />
                <text x={250 + Math.max(8, width)} y={y + 14} fill="#ffffff" fontSize="12">{row.value}</text>
              </g>
            );
          })}
        </svg>
        <Text>Arena Elo is from the LMSys leaderboard in Figure 6, dated 22 December 2023. People compare two anonymous chatbots. The instruct model was trained with supervised fine-tuning and then DPO (paper #13).</Text>
        <Table columns={["Finding", "What they measured"]} rows={[
          ["Multilingual, Table 4", "French MMLU 70.9 versus Llama 2's 64.3. German 71.5 versus 64.2. Spanish 72.5 versus 66.0. Italian 70.9 versus 65.1."],
          ["Long context, Figure 4", "Passkey retrieval is 100% at every context length and every position of the hidden number. Perplexity on a proof corpus falls as the context grows."],
          ["Bias, Figure 5", "BBQ accuracy 56.0% versus Llama 2 70B's 51.5%. On BOLD, sentiment is more positive, with similar variance."],
          ["Routing, Section 5", "No obvious split by topic. ArXiv, PubMed, and PhilPapers look alike. DM Mathematics, a synthetic set, is a little different. Routing follows syntax, and consecutive tokens share experts more often at layers 15 and 31."],
          ["The memory catch, Section 3", "Active parameters set the compute. Memory follows the 47B total. Routing adds overhead, and the sparse setup suits batched work. The paper's phrase \"47B tokens compared to 70B\" means parameters."],
        ]} />
        <Callout tone="warning" lead="Limits the authors leave open.">The paper does not describe the training data, the token count, the training compute, or how experts were kept balanced. The benchmarks were re-run in Mistral's own pipeline, which differs in places from the Llama 2 paper. Mixtral trails Llama 2 70B on reading comprehension and, in Table 2, on WinoGrande and HellaSwag. Loading the model still means loading 47B parameters, and a popular expert can overload one GPU.</Callout>
      </Section>
      <QuizSync slug="22-mixtral" picks={picks} answers={QUIZ.map((item) => item.answer)} />
      <Section heading="Quick quiz">
        {QUIZ.map((item, index) => (
          <Section key={item.q} heading={`${index + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, optionIndex) => (
                <Button key={option} label={option} variant={picks[index] === optionIndex ? "primary" : "quiet"} onClick={() => setPicks(picks.map((pick, pickIndex) => (pickIndex === index ? optionIndex : pick)))} />
              ))}
            </div>
            {picks[index] === null ? null : picks[index] === item.answer ? <Callout tone="success" lead="Right.">{item.why}</Callout> : <Callout tone="warning" lead="Not quite.">{item.why}</Callout>}
          </Section>
        ))}
        <Text>Explain it in your own words: starting from the Transformer&apos;s feed-forward block, what does Mixtral change, and why can a model with 47 billion parameters run at roughly the cost of a 13 billion parameter one?</Text>
      </Section>
      <Section heading="Read it yourself">
        <LinkCards links={[
          { title: "Mixtral of Experts (abstract)", site: "arxiv.org", date: "2024", href: "https://arxiv.org/abs/2401.04088" },
          { title: "Mixtral of Experts (PDF)", site: "arxiv.org", date: "2024", href: "https://arxiv.org/pdf/2401.04088" },
          { title: "Official code and Apache 2.0 weights", site: "github.com", date: "2024", href: "https://github.com/mistralai/mistral-src" },
          { title: "Mistral announcement", site: "mistral.ai", date: "2023", href: "https://mistral.ai/news/mixtral-of-experts/" },
          { title: "The Transformer, where the feed-forward block comes from", site: "Papers a Day", date: "2017", href: "/papers/05-transformer" },
          { title: "Scaling Laws", site: "Papers a Day", date: "2020", href: "/papers/09-scaling-laws" },
          { title: "DPO, used for the instruct model", site: "Papers a Day", date: "2023", href: "/papers/13-dpo" },
          { title: "Constitutional AI, the previous paper on this path", site: "Papers a Day", date: "2022", href: "/papers/21-constitutional-ai" },
        ]} />
      </Section>
    </Page>
  );
}
