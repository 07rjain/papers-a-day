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
  Frac,
  Pow,
  useState,
  useEffect,
  useRef,
} from "grok/canvas";
import type { BufferAttribute } from "three";

// The loss surface uses the paper's fitted formula (Approach 3):
// L(N, D) = 1.69 + 406.4 / N^0.34 + 410.7 / D^0.28.
// Numbers read off the demos are from that fit, not results printed in the paper.
// The budget allocator starts from a toy 1B / 20B model.

const VIDEOS = [
  {
    file: "SameComputeTwoShapes.mp4",
    title: "Same compute, two shapes",
    caption: "Compute is roughly 6 × parameters × tokens. Gopher is a wide, short box; Chinchilla is a narrow, tall one with about the same area.",
  },
  {
    file: "IsoFLOPValleys.mp4",
    title: "IsoFLOP valleys",
    caption: "Fix the compute, vary the model size: the loss makes a valley. The bottom of each valley is the compute-optimal model.",
  },
  {
    file: "TenXCompute.mp4",
    title: "Where should 10× more compute go?",
    caption: "Kaplan et al. (2020) said mostly into parameters. Chinchilla says split it evenly: about 3.2× params and 3.2× data.",
  },
];

const E0 = 1.69;
const A0 = 406.4;
const B0 = 410.7;
const AL = 0.34;
const BE = 0.28;
const lossND = (N: number, D: number) => E0 + A0 / Math.pow(N, AL) + B0 / Math.pow(D, BE);
const X0 = 10.25;
const Z0 = 11.25;
const toX = (lN: number) => 2 * (lN - X0);
const toZ = (lD: number) => 2 * (lD - Z0);
const fromX = (x: number) => x / 2 + X0;
const fromZ = (z: number) => z / 2 + Z0;
const HY = (L: number) => Math.min(3.4, (L - 1.8) * 1.7);
const surfY = (x: number, z: number) => HY(lossND(Math.pow(10, fromX(x)), Math.pow(10, fromZ(z))));
const lossColor = (L: number) => {
  const t = Math.max(0, Math.min(1, (L - 1.85) / 1.4));
  const lo = [0.29, 0.87, 0.5];
  const mid = [0.35, 0.66, 1.0];
  const hi = [0.95, 0.35, 0.55];
  const mix = (u: number[], v: number[], s: number) => u.map((k, i) => k + (v[i] - k) * s);
  return t < 0.5 ? mix(lo, mid, t / 0.5) : mix(mid, hi, (t - 0.5) / 0.5);
};

const BUDGETS = [
  { value: "21", label: "10²¹ FLOPs", C: 1e21 },
  { value: "22", label: "10²² FLOPs", C: 1e22 },
  { value: "23", label: "10²³ FLOPs", C: 1e23 },
  { value: "gopher", label: "Gopher's budget (5.76 × 10²³)", C: 5.76e23 },
  { value: "24", label: "10²⁴ FLOPs", C: 1e24 },
];

const bestLogN = (C: number) => {
  let best = 8;
  let bestLoss = 99;
  for (let l = 7.5; l <= 13; l += 0.005) {
    const N = Math.pow(10, l);
    const L = lossND(N, C / (6 * N));
    if (L < bestLoss) {
      bestLoss = L;
      best = l;
    }
  }
  return best;
};

const fmtN = (n: number) =>
  n >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1)}B` : `${(n / 1e6).toFixed(0)}M`;

function LossLandscape({
  C,
  seek,
  onState,
}: {
  C: number;
  seek: number;
  onState: (s: { lN: number; L: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ C });
  const ball = useRef({ lN: 12.3, v: 0 });
  const onStateRef = useRef(onState);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  live.current = { C };
  onStateRef.current = onState;

  useEffect(() => {
    ball.current = { lN: 12.3, v: 0 };
  }, [C, seek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let frame = 0;
    let cleanup = () => {};

    import("three")
      .then((THREE) => {
        if (disposed) return;
        const width = canvas.clientWidth || 780;
        const height = canvas.clientHeight || 420;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0b1020);
        scene.fog = new THREE.Fog(0x0b1020, 16, 30);
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.72));
        const key = new THREE.DirectionalLight(0xffffff, 0.95);
        key.position.set(5, 9, 4);
        scene.add(key);

        const segs = 72;
        const geo = new THREE.BufferGeometry();
        const count = (segs + 1) * (segs + 1);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const indices: number[] = [];
        for (let i = 0; i <= segs; i++) {
          for (let j = 0; j <= segs; j++) {
            const x = -4.5 + (9 * i) / segs;
            const z = -4.5 + (9 * j) / segs;
            const y = surfY(x, z);
            const k = i * (segs + 1) + j;
            positions[k * 3] = x;
            positions[k * 3 + 1] = y;
            positions[k * 3 + 2] = z;
            const c = lossColor(lossND(Math.pow(10, fromX(x)), Math.pow(10, fromZ(z))));
            colors[k * 3] = c[0];
            colors[k * 3 + 1] = c[1];
            colors[k * 3 + 2] = c[2];
          }
        }
        for (let i = 0; i < segs; i++) {
          for (let j = 0; j < segs; j++) {
            const a = i * (segs + 1) + j;
            const b = a + 1;
            const c = a + segs + 1;
            const d = c + 1;
            indices.push(a, c, b, b, c, d);
          }
        }
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const surf = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.55,
            metalness: 0.05,
            side: THREE.DoubleSide,
          }),
        );
        scene.add(surf);
        scene.add(
          new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.07 }),
          ),
        );

        const path: { x: number; y: number; z: number }[] = [];
        for (let lc = 19; lc <= 25; lc += 0.25) {
          const budget = Math.pow(10, lc);
          const l = bestLogN(budget);
          const lD = Math.log10(budget / 6) - l;
          const x = toX(l);
          const z = toZ(lD);
          if (Math.abs(x) > 4.5 || Math.abs(z) > 4.5) continue;
          path.push({ x, y: surfY(x, z) + 0.05, z });
        }
        const dashGeo = new THREE.BufferGeometry().setFromPoints(path.map((p) => new THREE.Vector3(p.x, p.y, p.z)));
        const dash = new THREE.Line(
          dashGeo,
          new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.16, gapSize: 0.1, transparent: true, opacity: 0.8 }),
        );
        dash.computeLineDistances();
        scene.add(dash);

        const isoMax = 160;
        const isoPos = new Float32Array(isoMax * 3);
        const isoGeo = new THREE.BufferGeometry();
        isoGeo.setAttribute("position", new THREE.BufferAttribute(isoPos, 3));
        isoGeo.setDrawRange(0, 0);
        const isoLine = new THREE.Line(isoGeo, new THREE.LineBasicMaterial({ color: 0xfacc15 }));
        scene.add(isoLine);
        const isoGlow = new THREE.Points(
          isoGeo,
          new THREE.PointsMaterial({
            color: 0xfacc15,
            size: 0.16,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        scene.add(isoGlow);

        const place = (N: number, D: number, color: number, label: string, lift: number) => {
          const x = toX(Math.log10(N));
          const z = toZ(Math.log10(D));
          const y = surfY(x, z) + 0.12;
          const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 18, 12), new THREE.MeshBasicMaterial({ color }));
          dot.position.set(x, y, z);
          scene.add(dot);
          const board = document.createElement("canvas");
          board.width = 560;
          board.height = 64;
          const ctx2 = board.getContext("2d");
          if (ctx2) {
            ctx2.font = "600 28px sans-serif";
            ctx2.fillStyle = "#e2e8f0";
            ctx2.fillText(label, 4, 42);
          }
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(board), transparent: true, depthTest: false }),
          );
          sprite.position.set(x, y + lift, z);
          sprite.scale.set(2.8, 0.34, 1);
          scene.add(sprite);
        };
        place(280e9, 300e9, 0xfb923c, "Gopher 280B / 300B tokens", 0.42);
        place(70e9, 1.4e12, 0x4ade80, "Chinchilla 70B / 1.4T", 0.48);
        place(175e9, 300e9, 0x94a3b8, "GPT-3 175B / 300B", 0.95);

        const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(0.26, 18, 12),
          new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        scene.add(ballMesh);
        scene.add(halo);

        let ang = 0.85;
        let elev = 0.58;
        let drag: { x: number; y: number } | null = null;
        canvas.style.cursor = "grab";
        const down = (event: PointerEvent) => {
          drag = { x: event.clientX, y: event.clientY };
          canvas.setPointerCapture(event.pointerId);
        };
        const move = (event: PointerEvent) => {
          if (!drag) return;
          ang -= (event.clientX - drag.x) * 0.008;
          elev = Math.max(0.2, Math.min(1.25, elev + (event.clientY - drag.y) * 0.005));
          drag = { x: event.clientX, y: event.clientY };
        };
        const up = () => {
          drag = null;
        };
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);

        const isoAttr = isoGeo.attributes.position as BufferAttribute;
        let last = performance.now();
        const loop = () => {
          if (disposed) return;
          frame += 1;
          const budget = live.current.C;
          const current = ball.current;
          const at = (l: number) => {
            const size = Math.pow(10, l);
            return lossND(size, budget / (6 * size));
          };
          const slope = (at(current.lN + 0.01) - at(current.lN - 0.01)) / 0.02;
          current.v = current.v * 0.9 - slope * 0.12;
          current.lN = Math.max(7.6, Math.min(12.9, current.lN + current.v));
          if (frame % 6 === 0) onStateRef.current({ lN: current.lN, L: at(current.lN) });

          const now = performance.now();
          const dt = (now - last) / 1000;
          last = now;
          if (!drag) ang += dt * 0.1;
          const radius = 13;
          camera.aspect = (canvas.clientWidth || width) / (canvas.clientHeight || height);
          camera.updateProjectionMatrix();
          camera.position.set(
            Math.cos(ang) * radius * Math.cos(elev),
            radius * Math.sin(elev) + 1.2,
            Math.sin(ang) * radius * Math.cos(elev),
          );
          camera.lookAt(0, 1.1, 0);

          const logTokens = Math.log10(budget / 6);
          let nPts = 0;
          for (let l = 7.6; l <= 12.9 && nPts < isoMax; l += 0.04) {
            const x = toX(l);
            const z = toZ(logTokens - l);
            if (Math.abs(x) > 4.5 || Math.abs(z) > 4.5) continue;
            isoPos[nPts * 3] = x;
            isoPos[nPts * 3 + 1] = surfY(x, z) + 0.07;
            isoPos[nPts * 3 + 2] = z;
            nPts += 1;
          }
          isoGeo.setDrawRange(0, nPts);
          isoAttr.needsUpdate = true;

          const bx = toX(current.lN);
          const bz = toZ(logTokens - current.lN);
          const visible = Math.abs(bx) <= 4.5 && Math.abs(bz) <= 4.5;
          ballMesh.visible = visible;
          halo.visible = visible;
          if (visible) {
            const by = surfY(bx, bz) + 0.2;
            ballMesh.position.set(bx, by, bz);
            halo.position.copy(ballMesh.position);
            const pulse = 1 + 0.14 * Math.sin(frame / 8);
            halo.scale.setScalar(pulse);
          }
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        setStatus("ready");
        loop();
        cleanup = () => {
          cancelAnimationFrame(raf);
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          renderer.dispose();
          geo.dispose();
          dashGeo.dispose();
          isoGeo.dispose();
        };
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} className="chin-canvas" />
      {status === "loading" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#94a3b8", fontSize: 13 }}>Loading the 3D scene…</div>
      ) : null}
      {status === "error" ? (
        <div style={{ position: "absolute", top: 16, left: 16, color: "#fca5a5", fontSize: 13 }}>
          This browser could not start the WebGL scene.
        </div>
      ) : null}
      <div className="igpt-legend" style={{ zIndex: 2 }}>
        <div>left-right = model size, front-back = training tokens (log scales)</div>
        <div>
          height and colour = loss (<span style={{ color: "#4ade80" }}>green</span> is lower, better)
        </div>
        <div>
          <span style={{ color: "#facc15" }}>yellow line</span> = every model you can afford with this budget
        </div>
        <div>dashed white = the compute-optimal path · drag to orbit</div>
      </div>
    </div>
  );
}

const TPP = [
  { name: "MT-NLG 530B", ratio: 270 / 530, c: "#94a3b8" },
  { name: "Gopher 280B", ratio: 300 / 280, c: "#fb923c" },
  { name: "GPT-3 175B", ratio: 300 / 175, c: "#94a3b8" },
  { name: "Chinchilla 70B", ratio: 1400 / 70, c: "#4ade80" },
];

function TokensPerParam() {
  return (
    <svg width="100%" viewBox="0 0 720 190" style={{ display: "block", background: "#0b1020", borderRadius: 12 }}>
      <text x={16} y={22} fill="#cbd5e1" fontSize="13">
        Training tokens per parameter (from the paper&apos;s Table 1)
      </text>
      {TPP.map((model, i) => {
        const w = (model.ratio / 20) * 470 + 4;
        const y = 40 + i * 36;
        return (
          <g key={model.name}>
            <text x={150} y={y + 17} textAnchor="end" fill="#e2e8f0" fontSize="13">
              {model.name}
            </text>
            <rect x={160} y={y} height={24} rx={6} fill={model.c} fillOpacity={0.85} width={w}>
              <animate attributeName="width" values={`0;${w};${w};0`} keyTimes="0;0.35;0.9;1" dur="6s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
            </rect>
            <text x={170 + w} y={y + 17} fill="#fff" fontSize="13">
              {model.ratio.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const MULTS = [
  { value: "10", label: "10× compute", k: 10 },
  { value: "100", label: "100×", k: 100 },
  { value: "1000", label: "1,000×", k: 1000 },
];

function Allocator() {
  const [m, setM] = useState<string>("10");
  const k = MULTS.find((item) => item.value === m)!.k;
  const N0 = 1e9;
  const D0 = 20e9;
  const kap = { N: N0 * Math.pow(k, 0.73), D: D0 * Math.pow(k, 0.27) };
  const chi = { N: N0 * Math.pow(k, 0.5), D: D0 * Math.pow(k, 0.5) };
  const Lk = lossND(kap.N, kap.D);
  const Lc = lossND(chi.N, chi.D);
  const bar = (v: number, base: number, col: string, label: string) => {
    const pct = Math.min(100, (Math.log10(v / base) / 3) * 100);
    return (
      <div style={{ margin: "6px 0" }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {label}: {fmtN(v)} ({(v / base).toFixed(1)}×)
        </div>
        <div style={{ height: 14, borderRadius: 7, background: "#1e293b", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(3, pct)}%`, height: "100%", background: col, transition: "width 0.9s cubic-bezier(.2,.9,.3,1.2)" }} />
        </div>
      </div>
    );
  };
  return (
    <div>
      <Text>
        Start from a 1B-parameter model trained on 20B tokens (toy starting point). Pick how much more compute you get, and compare how each paper says to spend it. The loss comes from the Chinchilla paper&apos;s fitted formula, so it is an estimate.
      </Text>
      <div style={{ margin: "8px 0" }}>
        <Segmented options={MULTS.map((item) => ({ value: item.value, label: item.label }))} value={m} onChange={(value: string) => setM(value)} />
      </div>
      <div className="chin-cols">
        <div style={{ padding: 12, borderRadius: 12, background: "#0b1020", color: "#e2e8f0" }}>
          <div style={{ fontWeight: 700, color: "#fb923c" }}>Kaplan et al. 2020 (N ∝ C^0.73)</div>
          {bar(kap.N, N0, "#5aa9ff", "Parameters")}
          {bar(kap.D, D0, "#4ade80", "Tokens")}
          <div style={{ marginTop: 6 }}>
            Estimated loss: <b>{Lk.toFixed(3)}</b>
          </div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "#0b1020", color: "#e2e8f0" }}>
          <div style={{ fontWeight: 700, color: "#4ade80" }}>Chinchilla 2022 (N ∝ C^0.5)</div>
          {bar(chi.N, N0, "#5aa9ff", "Parameters")}
          {bar(chi.D, D0, "#4ade80", "Tokens")}
          <div style={{ marginTop: 6 }}>
            Estimated loss: <b>{Lc.toFixed(3)}</b>
          </div>
        </div>
      </div>
      <Callout tone="success">
        Same compute, lower loss for the even split ({Lc.toFixed(3)} vs {Lk.toFixed(3)}), and the Chinchilla-style model is {(kap.N / chi.N).toFixed(1)}× smaller, so it is also cheaper every time someone uses it.
      </Callout>
    </div>
  );
}

function VideoCard({ file, title, caption }: { file: string; title: string; caption: string }) {
  return (
    <figure style={{ margin: "0 0 16px" }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 6 }}>{title}</figcaption>
      <video
        src={`/videos/11-chinchilla/${file}`}
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
    q: "What was the paper's main claim about models like GPT-3 and Gopher?",
    options: ["They were too small", "They were too big for their compute and trained on too little data", "They used the wrong architecture"],
    answer: 1,
    why: "Most big models were trained on about 300B tokens no matter their size. The paper says that for the same compute, a smaller model trained on more tokens would do better: they were 'significantly undertrained'.",
  },
  {
    q: "If your compute budget doubles, the paper says to…",
    options: ["Double the model size and keep data the same", "Grow model size and data by about the same factor (about 1.4× each)", "Keep the model and only add data"],
    answer: 1,
    why: "All three of their methods found N_opt ∝ C^a and D_opt ∝ C^b with a and b near 0.5. Since compute ≈ 6ND, doubling compute means about √2 ≈ 1.4× more parameters and 1.4× more tokens.",
  },
  {
    q: "What is an IsoFLOP profile?",
    options: ["Loss vs model size for a fixed compute budget, which forms a valley", "A plot of FLOPs per second on a GPU", "The learning-rate schedule"],
    answer: 0,
    why: "Fix the FLOPs, try many model sizes (each trained on whatever tokens that budget allows), and plot final loss. Too small underfits, too big sees too little data; the bottom of the valley is the best size.",
  },
  {
    q: "How did Chinchilla compare to Gopher?",
    options: ["Same compute, 4× smaller, and better on almost every benchmark", "4× bigger and slightly better", "Same size, trained longer, used more compute"],
    answer: 0,
    why: "Chinchilla (70B, 1.4T tokens) used about the same compute as Gopher (280B, 300B tokens). It reached 67.5% on MMLU vs Gopher's 60.0% and beat it on all but 4 of 62 BIG-bench tasks.",
  },
  {
    q: "Why did Kaplan et al. (2020) reach a different answer, according to this paper?",
    options: ["They used a fixed learning-rate schedule and token count for every run, and mostly small models", "They used a different tokenizer", "They trained on code"],
    answer: 0,
    why: "Kaplan used one cosine schedule length for all runs, so intermediate checkpoints looked worse than a properly scheduled shorter run would. That underrated training on less data and pushed the answer toward bigger models. Their runs were also mostly smaller models.",
  },
];

export default function App() {
  const [bud, setBud] = useState<string>("gopher");
  const [seek, setSeek] = useState<number>(0);
  const [st, setSt] = useState<{ lN: number; L: number }>({ lN: 12, L: 0 });
  const [picks, setPicks] = useState<(number | null)[]>(QUIZ.map(() => null));
  const C = BUDGETS.find((item) => item.value === bud)!.C;
  const N = Math.pow(10, st.lN);
  const D = C / (6 * N);
  const opt = bestLogN(C);
  const atOpt = Math.abs(st.lN - opt) < 0.05;

  return (
    <Page title="Chinchilla: most big language models were undertrained" summary="Paper #11 · Hoffmann et al., DeepMind, 2022 · arXiv 2203.15556" width="wide">
      <Callout tone="info" lead="The big idea in one line.">
        For a fixed compute budget, grow the model and its training data together, about 20 tokens per parameter, and a 4× smaller model beats the giant.
      </Callout>

      <Section heading="The plain-English version">
        <Text>
          Two days ago you met the Kaplan scaling laws: bigger models get predictably better, and Kaplan&apos;s advice for more compute was &quot;make the model much bigger, add a bit more data.&quot; Everyone followed it. GPT-3 (175B), Gopher (280B) and MT-NLG (530B) all grew huge but were trained on roughly the same 300 billion tokens.
        </Text>
        <Text>
          DeepMind redid the experiment more carefully, training over 400 models from 70 million to 16 billion parameters on 5 to 500 billion tokens. Their answer: model size and data matter equally. Double the model, double the data. By that rule the big models were far too big for the data they saw. To prove it they trained Chinchilla with the same compute as Gopher but 4× fewer parameters (70B) and about 4.7× more data (1.4 trillion tokens), and it beat Gopher, GPT-3 and MT-NLG on nearly everything. A smaller model is also cheaper to run every time someone uses it.
        </Text>
        <TokensPerParam />
      </Section>

      <Section heading="Watch: the idea, animated" caption="Rendered with Manim Community Edition">
        {VIDEOS.map((video) => (
          <VideoCard key={video.file} file={video.file} title={video.title} caption={video.caption} />
        ))}
      </Section>

      <Section heading="Demo 1: roll down the loss landscape (3D)" caption="Surface from the paper's fitted loss formula; an approximation, not a measured grid.">
        <Text>
          This surface is the paper&apos;s fitted loss for every combination of model size and training tokens. A compute budget lets you stand anywhere on the yellow line: a bigger model means fewer tokens, and vice versa. The white ball starts as a huge, under-trained model and rolls along the line to the lowest loss. Pick a budget and press Drop the ball.
        </Text>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "8px 0" }}>
          <Segmented options={BUDGETS.map((item) => ({ value: item.value, label: item.label }))} value={bud} onChange={(value: string) => setBud(value)} />
          <Button label="Drop the ball" variant="primary" onClick={() => setSeek(seek + 1)} />
        </div>
        <LossLandscape C={C} seek={seek} onState={setSt} />
        <Metrics
          metrics={[
            { value: fmtN(N), label: "Model size at the ball" },
            { value: fmtN(D), label: "Training tokens at the ball" },
            { value: (D / N).toFixed(0), label: "Tokens per parameter", tone: atOpt ? "success" : undefined },
            { value: st.L ? st.L.toFixed(3) : "…", label: "Fitted loss" },
          ]}
        />
        <Callout tone={atOpt ? "success" : "info"}>
          {atOpt
            ? `The ball settled at the bottom of this budget's valley: about ${fmtN(N)} parameters on ${fmtN(D)} tokens.`
            : "Rolling… the ball is still trading model size for data."}
        </Callout>
        <Text>
          Notice that for Gopher&apos;s budget the fitted formula puts the bottom far to the left of Gopher (orange) and close to Chinchilla (green). The formula alone lands around 30 to 40B; the paper&apos;s three methods together pointed to 40 to 70B, and they trained the 70B end. Switch budgets and watch the optimum march along the dashed path, both size and data growing together.
        </Text>
      </Section>

      <Section heading="Demo 2: spend your extra compute">
        <Allocator />
      </Section>

      <Section heading="How they worked it out">
        <Steps
          steps={[
            { title: "Approach 1: lowest loss at each budget", detail: "Train models from 70M to 10B, each with 4 schedule lengths, and read off which model is best for each FLOP count. Found a = 0.50, b = 0.50." },
            { title: "Approach 2: IsoFLOP profiles", detail: "Pick 9 fixed budgets (6 × 10¹⁸ to 3 × 10²¹ FLOPs), vary model size, fit a parabola to each valley and take its minimum. Found a = 0.49, b = 0.51." },
            { title: "Approach 3: fit one formula to everything", detail: "Fit L(N, D) = E + A/N^α + B/D^β to all runs. Found E = 1.69, A = 406.4, B = 410.7, α = 0.34, β = 0.28, giving a = 0.46, b = 0.54." },
            { title: "Test it: train Chinchilla", detail: "Same compute as Gopher (about 5.76 × 10²³ FLOPs), 70B parameters, 1.4T tokens, same architecture with small changes (AdamW, a slightly different tokenizer)." },
          ]}
        />
        <Equation>
          <span>L(N, D) = E + </span>
          <Frac num="A" den={<Pow base="N" exp="α" />} />
          <span> + </span>
          <Frac num="B" den={<Pow base="D" exp="β" />} />
        </Equation>
        <Text>E is the loss you could never beat (the entropy of text itself). The middle term is what you lose by having a finite model, the last term what you lose by seeing finite data. Compute is about C ≈ 6ND.</Text>
      </Section>

      <Section heading="What the paper actually claimed">
        <Metrics
          metrics={[
            { value: "70B vs 280B", label: "Chinchilla vs Gopher, same compute", tone: "success" },
            { value: "67.5% vs 60.0%", label: "MMLU, 5-shot (Chinchilla vs Gopher)", tone: "success" },
            { value: "65.1% vs 54.4%", label: "BIG-bench average over 62 tasks" },
            { value: "a ≈ b ≈ 0.5", label: "Kaplan had 0.73 vs 0.27" },
          ]}
        />
        <Table
          columns={["Finding", "What they measured"]}
          rows={[
            ["Big models were undertrained", "Most large models used about 300B tokens; e.g. a 175B model should get about 4.2T tokens"],
            ["Equal scaling", "All three approaches: N_opt ∝ C^a, D_opt ∝ C^b with a and b near 0.5"],
            ["About 20 tokens per parameter", "Table 3: 1B → 20.2B tokens, 10B → 205.1B, 67B → 1.5T"],
            ["Chinchilla beats bigger models", "Better than Gopher, GPT-3, Jurassic-1 and MT-NLG on a wide range of tasks; worse than Gopher on only 4 of 62 BIG-bench tasks"],
            ["Cheaper to use", "4× smaller, so less memory and compute for fine-tuning and inference"],
            ["Also on other data", "The IsoFLOP analysis on C4 and GitHub code gave the same equal-scaling answer"],
          ]}
        />
        <Callout tone="warning" lead="Limits the authors name.">
          Only two runs at the very large scale (Chinchilla and Gopher), no checks in between. They assume a clean power law, but see some curvature that suggests the optimal size might be even smaller. All runs saw less than one pass over the data, so the multi-epoch case is open. And training on 4× more data raises the risk that test text leaked into training, so they lean on benchmarks like MMLU and BIG-bench.
        </Callout>
      </Section>

      <Section heading="Quick quiz">
        {QUIZ.map((item, k) => (
          <Section key={item.q} heading={`${k + 1}. ${item.q}`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {item.options.map((option, oi) => (
                <Button
                  key={option}
                  label={option}
                  variant={picks[k] === oi ? "primary" : "quiet"}
                  onClick={() => setPicks(picks.map((pick, z) => (z === k ? oi : pick)))}
                />
              ))}
            </div>
            {picks[k] === null ? null : picks[k] === item.answer ? (
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
          Then tell me in chat, in your own words: Gopher and Chinchilla used the same compute, so why did the smaller model win, and why does that matter even after training is done?
        </Text>
      </Section>

      <Section heading="Read it yourself">
        <LinkCards
          links={[
            { title: "Training Compute-Optimal Large Language Models (arXiv abs)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/abs/2203.15556" },
            { title: "Training Compute-Optimal Large Language Models (PDF)", site: "arxiv.org", date: "2022", href: "https://arxiv.org/pdf/2203.15556" },
            { title: "Paper #9 recap: Scaling Laws for Neural Language Models", site: "papers-a-day", date: "2020", href: "/papers/09-scaling-laws" },
          ]}
        />
      </Section>
    </Page>
  );
}
